import { createPrivateKey, X509Certificate } from "node:crypto";
import { mkdir, open, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { domainToASCII } from "node:url";
import { ZipArchive } from "archiver";
import dayjs from "dayjs";
import dnsPlugins from "../certbot/dns-plugins.json" with { type: "json" };
import { installPlugin } from "../lib/certbot.js";
import error from "../lib/error.js";
import { pickCertificateFields } from "../lib/helpers.js";
import utils from "../lib/utils.js";
import apiValidator from "../lib/validator/api.js";
import { ssl as logger } from "../logger.js";
import certificateModel from "../models/certificate.js";
import deadHostModel from "../models/dead_host.js";
import proxyHostModel from "../models/proxy_host.js";
import redirectionHostModel from "../models/redirection_host.js";
import streamModel from "../models/stream.js";
import pjson from "../package.json" with { type: "json" };
import { getValidationSchema } from "../schema/index.js";
import internalAuditLog from "./audit-log.js";
import internalNginx from "./nginx.js";

const cnPattern = /\bCN=(?<cn>[^\n]+)/iu;
const renewalServerPattern = /^server = (?<server>.+)$/mu;

const getNiceName = (domainNames) => {
	const niceName = domainNames.join(", ");
	if (niceName.length <= 255) return niceName;
	const shown = [];
	for (const domain of domainNames) {
		if ([...shown, domain, "..."].join(", ").length > 255) break;
		shown.push(domain);
	}
	return [...shown, "..."].join(", ");
};

const internalCertificate = {
	allowedSslFiles: ["certificate", "certificate_key"],
	intervalTimeout: 1000 * 60 * 60 * Number.parseInt(process.env.CERTBOT_RUN_INTERVAL, 10),
	interval: null,
	intervalProcessing: false,

	initTimer: () => {
		if (internalCertificate.interval) return;
		logger.info("Certbot Renewal Timer initialized");
		internalCertificate.interval = setInterval(
			internalCertificate.processExpiringHosts,
			internalCertificate.intervalTimeout,
		);
		// And do this now as well
		void internalCertificate.processExpiringHosts();
	},

	/**
	 * Triggered by a timer, this will check for expiring hosts and renew their tls certs if required
	 */
	processExpiringHosts: async () => {
		if (internalCertificate.intervalProcessing) {
			return;
		}

		internalCertificate.intervalProcessing = true;
		logger.info("Renewing Certbot TLS certs close to expiry...");

		try {
			try {
				const result = await utils.execFile("certbot", [
					"--config",
					"/etc/certbot.ini",
					"renew",
					"--server",
					process.env.ACME_SERVER,
					"--quiet",
				]);

				if (result) logger.info(`Renew Result: ${result}`);
			} catch (err) {
				logger.warn(`Certbot completed with errors: ${err}`);
			}

			try {
				await internalNginx.reload();
			} catch (err) {
				logger.error(err);
			}

			const certificates = await certificateModel.query().where("provider", "letsencrypt");

			if (certificates && certificates.length > 0) {
				const updatePromises = certificates.map(async (certificate) => {
					try {
						const certInfo = await internalCertificate.getCertificateInfoFromFile(
							`${internalCertificate.getLiveCertPath(certificate.id)}/fullchain.pem`,
						);

						await certificateModel
							.query()
							.where("id", certificate.id)
							.andWhere("provider", "letsencrypt")
							.patch({
								nice_name: getNiceName(certificate.domain_names),
								expires_on: dayjs.unix(certInfo.dates.to).format("YYYY-MM-DD HH:mm:ss"),
							});
					} catch (err) {
						// Don't want to stop the train here, just log the error
						logger.error(err);
					}
				});

				await Promise.all(updatePromises);
				logger.info("Renew Complete");
			}
		} catch (err) {
			logger.error(err);
		} finally {
			internalCertificate.intervalProcessing = false;
		}
	},

	/**
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @returns {Promise}
	 */
	create: async (access, data) => {
		access.can("certificates:manage");
		data.owner_user_id = access.token.getUserId(1);

		if (!data.npmplus_dns_challenge) {
			delete data.npmplus_dns_provider;
			delete data.npmplus_dns_provider_credentials;
			delete data.npmplus_propagation_seconds;
		}

		if (data.provider === "letsencrypt") {
			data.nice_name = getNiceName(data.domain_names);
		}

		// this command really should clean up and delete the cert if it can't fully succeed
		const certificate = await certificateModel.query().insertAndFetch(data);

		try {
			if (certificate.provider === "letsencrypt") {
				// Request a new Cert with Certbot. Let the fun begin.
				if (certificate.npmplus_dns_challenge) {
					await internalCertificate.requestCertbotWithDnsChallenge(certificate);
				} else {
					await internalCertificate.requestCertbot(certificate);
				}

				// At this point, the letsencrypt cert should exist on disk.
				// Lets get the expiry date from the file and update the row silently
				const certInfo = await internalCertificate.getCertificateInfoFromFile(
					`${internalCertificate.getLiveCertPath(certificate.id)}/fullchain.pem`,
				);
				const savedRow = await certificateModel.query().patchAndFetchById(certificate.id, {
					expires_on: dayjs.unix(certInfo.dates.to).format("YYYY-MM-DD HH:mm:ss"),
				});

				await internalCertificate.addCreatedAuditLog(access, certificate.id, savedRow);

				return savedRow;
			}
		} catch (err) {
			// Delete the certificate here. This is a hard delete, since it never existed properly
			await certificateModel.query().deleteById(certificate.id);
			throw err;
		}

		const savedRow = await internalCertificate.get(access, { id: certificate.id });

		// Add to audit log
		await internalCertificate.addCreatedAuditLog(access, certificate.id, savedRow);

		return savedRow;
	},

	addCreatedAuditLog: async (access, certificate_id, meta) => {
		await internalAuditLog.add(access, {
			action: "created",
			object_type: "certificate",
			object_id: certificate_id,
			meta,
		});
	},

	/**
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @param  {Number}  data.id
	 * @param  {String}  [data.email]
	 * @param  {String}  [data.name]
	 * @return {Promise}
	 */
	update: async (access, data) => {
		access.can("certificates:manage");
		const row = await internalCertificate.get(access, { id: data.id });

		const savedRow = await certificateModel.query().patchAndFetchById(row.id, data);

		// Add to audit log
		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "certificate",
			object_id: row.id,
			meta: savedRow,
		});

		return savedRow;
	},

	/**
	 * @param  {Access}   access
	 * @param  {Object}   data
	 * @param  {Number}   data.id
	 * @return {Promise}
	 */
	get: async (access, data) => {
		access.can("certificates:view");
		const query = certificateModel.query().where("id", data.id).first();

		if (access.visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}

		const row = await query;
		if (!row?.id) {
			throw new error.ItemNotFoundError(data.id);
		}

		return row;
	},

	/**
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @param   {Number}  data.id
	 * @returns {Promise}
	 */
	download: async (access, data, dir) => {
		access.can("certificates:manage");
		const certificate = await internalCertificate.get(access, data);

		let zipDirectory;
		let fileNames;
		if (certificate.provider === "letsencrypt") {
			zipDirectory = internalCertificate.getLiveCertPath(data.id);
			fileNames = ["fullchain.pem", "privkey.pem"];
		} else if (certificate.provider === "mtls") {
			const mtlsFile = internalCertificate.getMtlsCertFile(data.id);
			zipDirectory = path.dirname(mtlsFile);
			fileNames = [path.basename(mtlsFile)];
		} else {
			zipDirectory = internalCertificate.getCustomCertPath(data.id);
			fileNames = ["fullchain.pem", "privkey.pem"];
		}

		try {
			await stat(zipDirectory);
		} catch (err) {
			throw new error.ItemNotFoundError(`Certificate ${certificate.nice_name} does not exists`, { cause: err });
		}

		const certFiles = [];
		for (const fileName of fileNames) {
			try {
				certFiles.push([fileName, await realpath(path.join(zipDirectory, fileName))]);
			} catch (err) {
				throw new error.ItemNotFoundError(`Certificate ${certificate.nice_name} is missing ${fileName}`, {
					cause: err,
				});
			}
		}

		const opName = path.join(dir, `npm-${data.id}-${Date.now()}.zip`);

		await internalCertificate.zipFiles(certFiles, opName);
		logger.debug("zip completed : ", opName);
		return {
			fileName: opName,
		};
	},

	/**
	 * @param   {Array[]}  source
	 * @param   {String}  out
	 * @returns {Promise}
	 */
	zipFiles: async (source, out) => {
		const archive = new ZipArchive({ zlib: { level: 9 } });
		archive.on("warning", (err) => archive.destroy(err));
		const written = pipeline(archive, (await open(out, "w")).createWriteStream());

		for (const [name, filePath] of source) archive.file(filePath, { name });

		await Promise.all([written, archive.finalize()]);
	},

	/**
	 * @param {Access}  access
	 * @param {Object}  data
	 * @param {Number}  data.id
	 * @param {String}  [data.reason]
	 * @returns {Promise}
	 */
	delete: async (access, data) => {
		access.can("certificates:manage");
		const row = await internalCertificate.get(access, { id: data.id });

		if (row.id === Number(process.env.DEFAULT_CERT_ID)) {
			throw new error.ValidationError("Certificate is still in use by the default host");
		}

		for (const hostModel of [proxyHostModel, redirectionHostModel, deadHostModel, streamModel]) {
			if (
				(await hostModel
					.query()
					.where("certificate_id", row.id)
					.orWhere("npmplus_mtls_certificate_id", row.id)
					.resultSize()) > 0
			) {
				throw new error.ValidationError("Certificate is still in use");
			}
		}

		await certificateModel.query().deleteById(row.id);

		// Add to audit log
		await internalAuditLog.add(access, {
			action: "deleted",
			object_type: "certificate",
			object_id: row.id,
			meta: row,
		});

		if (row.provider === "letsencrypt") {
			// Revoke the cert
			await internalCertificate.revokeCertbot(row);
		} else if (row.provider === "mtls") {
			await rm(internalCertificate.getMtlsCertFile(row.id), { force: true });
		} else {
			await rm(`/data/tls/custom/npm-${row.id}`, { force: true, recursive: true });
			await rm(`/data/tls/custom/npm-${row.id}.der`, { force: true });
		}
		return row;
	},

	/**
	 * All Certs
	 *
	 * @param   {Access}  access
	 * @param   {Array}   [expand]
	 * @param   {String}  [searchQuery]
	 * @returns {Promise}
	 */
	getAll: (access, expand, searchQuery) => {
		access.can("certificates:view");

		const query = certificateModel
			.query()
			.groupBy("id")
			.allowGraph(
				"[owner,proxy_hosts,redirection_hosts,dead_hosts,streams,mtls_proxy_hosts,mtls_redirection_hosts,mtls_dead_hosts,mtls_streams]",
			)
			.orderBy("nice_name", "ASC");

		if (access.visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}

		// Query is used for searching
		if (typeof searchQuery === "string") {
			query.where(function () {
				this.where("nice_name", "like", `%${searchQuery}%`);
			});
		}

		if (expand) query.withGraphFetched(`[${expand.join(", ")}]`);

		return query;
	},

	/**
	 * Report use
	 *
	 * @param   {Number}  userId
	 * @param   {String}  visibility
	 * @returns {Promise}
	 */
	getCount: (userId, visibility) => {
		const query = certificateModel.query();

		if (visibility !== "all") {
			query.andWhere("owner_user_id", userId);
		}

		return query.resultSize();
	},

	/**
	 * @param   {Object} certificate
	 * @returns {Promise}
	 */
	writeCustomCert: async (certificate) => {
		if (certificate.provider === "letsencrypt") {
			throw new Error("Refusing to write certbot certs here");
		}

		logger.info("Writing Custom Certificate:", certificate.id);

		if (certificate.provider === "mtls") {
			await writeFile(internalCertificate.getMtlsCertFile(certificate.id), certificate.certificate);
			return;
		}

		const dir = internalCertificate.getCustomCertPath(certificate.id);

		await mkdir(dir, { recursive: true });
		await writeFile(`${dir}/fullchain.pem`, certificate.certificate);
		await writeFile(`${dir}/privkey.pem`, certificate.certificate_key);
		const certs = certificate.certificate.match(/-----BEGIN CERTIFICATE-----.+?-----END CERTIFICATE-----\s*/gsu);
		await writeFile(`${dir}/cert.pem`, certs[0]);
		await writeFile(`${dir}/chain.pem`, certs.slice(1).join(""));
	},

	/**
	 * @param   {Access}   access
	 * @param   {Object}   data
	 * @param   {Array}    data.domain_names
	 * @returns {Promise}
	 */
	createQuickCertificate: (access, data) =>
		internalCertificate.create(
			access,
			apiValidator(getValidationSchema("/nginx/certificates", "post"), {
				provider: "letsencrypt",
				domain_names: data.domain_names,
				...pickCertificateFields(data),
			}),
		),

	/**
	 * Validates that the certs provided are good.
	 * Nothing is changed or stored.
	 *
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @param   {Object}  data.files
	 * @returns {Object}
	 */
	validate: (access, data) => {
		access.can("certificates:manage");
		const finalData = {};
		for (const [name, [file]] of Object.entries(data.files)) {
			if (internalCertificate.allowedSslFiles.includes(name)) {
				const content = file.buffer.toString();
				if (name === "certificate_key") {
					finalData[name] = internalCertificate.checkPrivateKey(content);
				} else {
					finalData[name] = internalCertificate.getCertificateInfo(content, true);
				}
			}
		}

		if (
			finalData.certificate &&
			finalData.certificate_key &&
			!new X509Certificate(data.files.certificate[0].buffer).checkPrivateKey(
				createPrivateKey(data.files.certificate_key[0].buffer),
			)
		) {
			throw new error.ValidationError("Certificate Key does not match the Certificate");
		}

		return finalData;
	},

	/**
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @param   {Number}  data.id
	 * @param   {Object}  data.files
	 * @returns {Promise}
	 */
	upload: async (access, data) => {
		const row = await internalCertificate.get(access, { id: data.id });
		if (row.provider !== "other" && row.provider !== "mtls") {
			throw new error.ValidationError("Cannot upload certificates for this type of provider");
		}
		const isMtls = row.provider === "mtls";

		const validations = internalCertificate.validate(access, data);
		if (validations.certificate === undefined) throw new error.ValidationError("Certificate file was not provided");
		if (!isMtls && validations.certificate_key === undefined) {
			throw new error.ValidationError("Certificate Key file was not provided");
		}

		const certs = {};
		for (const [name, [file]] of Object.entries(data.files)) {
			if ((isMtls ? ["certificate"] : internalCertificate.allowedSslFiles).includes(name)) {
				certs[name] = file.buffer.toString();
			}
		}

		const certificate = await internalCertificate.update(access, {
			id: data.id,
			expires_on: dayjs.unix(validations.certificate.dates.to).format("YYYY-MM-DD HH:mm:ss"),
			domain_names: validations.certificate.cn,
		});

		await internalCertificate.writeCustomCert({ ...certificate, ...certs });
		await internalNginx.reload();
		return certificate;
	},

	/**
	 * Uses the openssl command to validate the private key.
	 * It will save the file to disk first, then run commands on it, then delete the file.
	 *
	 * @param {String}  privateKey    This is the entire key contents as a string
	 */
	checkPrivateKey: (privateKey) => {
		try {
			createPrivateKey(privateKey);
			return true;
		} catch (err) {
			throw new error.ValidationError(`Certificate Key is not valid (${err.message})`, undefined, { cause: err });
		}
	},

	/**
	 * Uses the openssl command to both validate and get info out of the certificate.
	 * It will save the file to disk first, then run commands on it, then delete the file.
	 *
	 * @param {String}  certificate      This is the entire cert contents as a string
	 * @param {Boolean} [throwExpired]  Throw when the certificate is out of date
	 */
	getCertificateInfo: (certificate, throwExpired) => {
		const certData = {};

		try {
			const cert = new X509Certificate(certificate);

			if (cert.subjectAltName) {
				certData.cn = cert.subjectAltName
					.split(", ")
					.map((entry) => entry.slice(entry.indexOf(":") + 1).trim());
			} else {
				const cnMatch = cnPattern.exec(cert.subject);
				if (cnMatch?.groups.cn) {
					certData.cn = [cnMatch.groups.cn.trim()];
				} else {
					certData.cn = [];
				}
			}

			if (cert.issuer) {
				certData.issuer = cert.issuer.replaceAll("\n", ", ");
			}

			const validFrom = Math.floor(cert.validFromDate.getTime() / 1000);
			const validTo = Math.floor(cert.validToDate.getTime() / 1000);

			if (Number.isNaN(validFrom) || Number.isNaN(validTo)) {
				throw new error.ValidationError("Could not determine dates from certificate");
			}

			const now = Math.floor(Date.now() / 1000);
			if (throwExpired && validTo < now) {
				throw new error.ValidationError("Certificate has expired");
			}

			certData.dates = {
				from: validFrom,
				to: validTo,
			};

			return certData;
		} catch (err) {
			throw new error.ValidationError(`Certificate is not valid (${err.message})`, undefined, { cause: err });
		}
	},

	/**
	 * Uses the openssl command to both validate and get info out of the certificate.
	 * It will save the file to disk first, then run commands on it, then delete the file.
	 *
	 * @param {String}  certificateFile The file location on disk
	 * @param {Boolean} [throwExpired]  Throw when the certificate is out of date
	 */
	getCertificateInfoFromFile: async (certificateFile, throwExpired) => {
		const certContent = await readFile(certificateFile);
		return internalCertificate.getCertificateInfo(certContent, throwExpired);
	},

	/**
	 * Request a certificate using the http challenge
	 * @param   {Object}  certificate   the certificate row
	 * @returns {Promise}
	 */
	requestCertbot: async (certificate) => {
		logger.info(
			`Requesting Certbot certificates for Cert #${certificate.id}: ${certificate.domain_names.join(", ")}`,
		);

		certificate.domain_names = certificate.domain_names.map((v) => v.replace(/^\[|\]$/gu, ""));
		const { ips = [], domains = [] } = Object.groupBy(certificate.domain_names, (entry) =>
			net.isIP(entry) === 0 ? "domains" : "ips",
		);

		const result = await utils.execFile("certbot", [
			"--config",
			"/etc/certbot.ini",
			"certonly",
			"--server",
			process.env.ACME_SERVER,
			"--cert-name",
			`npm-${certificate.id}`,
			...(domains.length > 0 ? ["--domains", domains.map(domainToASCII).join(",")] : []),
			...ips.flatMap((ip) => ["--ip-address", ip]),
			...(certificate.npmplus_reuse_key ? ["--reuse-key"] : ["--no-reuse-key"]),
			"--authenticator",
			"webroot",
		]);
		logger.success(result);
		return result;
	},

	/**
	 * @param   {Object}   certificate  the certificate row
	 * @returns {Promise}
	 */
	requestCertbotWithDnsChallenge: async (certificate) => {
		const dnsPlugin = dnsPlugins[certificate.npmplus_dns_provider];
		if (!dnsPlugin) {
			throw new error.ValidationError(`Unknown DNS provider '${certificate.npmplus_dns_provider}'`);
		}
		await installPlugin(certificate.npmplus_dns_provider);

		logger.info(
			`Requesting Certbot certificates via ${dnsPlugin.name} for Cert #${certificate.id}: ${certificate.domain_names.join(", ")}`,
		);

		const credentialsLocation = `/tmp/certbot-credentials/credentials-${certificate.id}`;
		await writeFile(credentialsLocation, certificate.npmplus_dns_provider_credentials, { mode: 0o600 });

		try {
			const result = await utils.execFile("certbot", [
				"--config",
				"/etc/certbot.ini",
				"certonly",
				"--server",
				process.env.ACME_SERVER,
				"--cert-name",
				`npm-${certificate.id}`,
				"--domains",
				certificate.domain_names.map(domainToASCII).join(","),
				...(certificate.npmplus_reuse_key ? ["--reuse-key"] : ["--no-reuse-key"]),
				"--authenticator",
				dnsPlugin.full_plugin_name,
				`--${dnsPlugin.full_plugin_name}-credentials`,
				credentialsLocation,
				...(certificate.npmplus_propagation_seconds > 0
					? [`--${dnsPlugin.full_plugin_name}-propagation-seconds`, certificate.npmplus_propagation_seconds]
					: []),
			]);
			logger.info(result);
			return result;
		} catch (err) {
			await rm(credentialsLocation, { force: true });
			throw err;
		}
	},

	/**
	 * @param   {Access}  access
	 * @param   {Object}  data
	 * @param   {Number}  data.id
	 * @returns {Promise}
	 */
	renew: async (access, data) => {
		access.can("certificates:manage");
		const certificate = await internalCertificate.get(access, data);

		if (certificate.provider === "letsencrypt") {
			await internalCertificate.renewCertbot(certificate);
			const certInfo = await internalCertificate.getCertificateInfoFromFile(
				`${internalCertificate.getLiveCertPath(certificate.id)}/fullchain.pem`,
			);

			const updatedCertificate = await certificateModel.query().patchAndFetchById(certificate.id, {
				nice_name: getNiceName(certificate.domain_names),
				expires_on: dayjs.unix(certInfo.dates.to).format("YYYY-MM-DD HH:mm:ss"),
			});

			try {
				await internalNginx.reload();
			} finally {
				// Add to audit log
				await internalAuditLog.add(access, {
					action: "updated",
					object_type: "certificate",
					object_id: updatedCertificate.id,
					meta: updatedCertificate,
				});
			}

			return updatedCertificate;
		}

		throw new error.ValidationError("Only Certbot certificates can be renewed");
	},

	/**
	 * @param   {Object}  certificate   the certificate row
	 * @returns {Promise}
	 */
	renewCertbot: async (certificate) => {
		const dnsPlugin = certificate.npmplus_dns_challenge ? dnsPlugins[certificate.npmplus_dns_provider] : null;
		if (certificate.npmplus_dns_challenge && !dnsPlugin) {
			throw new error.ValidationError(`Unknown DNS provider '${certificate.npmplus_dns_provider}'`);
		}

		logger.info(
			`Renewing Certbot certificates ${dnsPlugin ? `via ${dnsPlugin.name} ` : ""}for Cert #${certificate.id}: ${certificate.domain_names.join(", ")}`,
		);

		const oldCertPath = await realpath(`${internalCertificate.getLiveCertPath(certificate.id)}/cert.pem`);
		const oldServer = (await readFile(`/data/tls/certbot/renewal/npm-${certificate.id}.conf`, "utf8")).match(
			renewalServerPattern,
		)?.groups.server;

		const renewResult = await utils.execFile("certbot", [
			"--config",
			"/etc/certbot.ini",
			"renew",
			"--server",
			process.env.ACME_SERVER,
			"--cert-name",
			`npm-${certificate.id}`,
			"--new-key",
			"--force-renewal",
		]);
		logger.info(renewResult);

		try {
			const revokeResult = await utils.execFile("certbot", [
				"--config",
				"/etc/certbot.ini",
				"revoke",
				"--server",
				oldServer,
				"--cert-path",
				oldCertPath,
				"--reason",
				"superseded",
				"--no-delete-after-revoke",
			]);
			logger.info(revokeResult);
		} catch {
			// do nothing
		}

		return renewResult;
	},

	/**
	 * @param   {Object}  certificate    the certificate row
	 * @returns {Promise}
	 */
	revokeCertbot: async (certificate) => {
		logger.info(
			`Revoking Certbot certificates for Cert #${certificate.id}: ${certificate.domain_names.join(", ")}`,
		);

		try {
			const result = await utils.execFile("certbot", [
				"--config",
				"/etc/certbot.ini",
				"revoke",
				"--cert-name",
				`npm-${certificate.id}`,
				"--reason",
				"unspecified",
				"--no-delete-after-revoke",
			]);
			logger.info(result);
		} catch (err) {
			logger.error(err.message);
		}

		try {
			const result = await utils.execFile("certbot", [
				"--config",
				"/etc/certbot.ini",
				"delete",
				"--cert-name",
				`npm-${certificate.id}`,
			]);
			logger.info(result);
		} catch (err) {
			logger.error(err.message);
		}

		await rm(`/data/tls/certbot/live/npm-${certificate.id}.der`, { force: true });
		await rm(`/tmp/certbot-credentials/credentials-${certificate.id}`, { force: true });
	},

	/**
	 *
	 * @param   {Object}    payload
	 * @param   {string[]}  payload.domains
	 * @returns
	 */
	testHttpsChallenge: async (access, payload) => {
		access.can("certificates:view");

		// Create a test challenge file
		await writeFile("/data/tls/certbot/acme-challenge/.well-known/acme-challenge/test-challenge", "Success", {
			encoding: "utf8",
		});

		const results = [];

		for (const domain of payload.domains) {
			results.push({
				domain,
				status: await internalCertificate.performTestForDomain(domain),
			});
		}

		return results;
	},

	performTestForDomain: async (domain) => {
		logger.info(`Testing http challenge for ${domain}`);
		let result;
		try {
			const response = await fetch("https://www.site24x7.com/tools/restapi-tester", {
				method: "POST",
				headers: {
					"User-Agent": `NPMplus/${pjson.version}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: `method=G&url=${encodeURI(`http://${domainToASCII(domain)}/.well-known/acme-challenge/test-challenge`)}&bodytype=T&locationid=10`,
			});

			try {
				result = await response.json();

				if (!response.ok) {
					logger.warn(
						`Failed to test HTTP challenge for domain ${domain} because HTTP status code ${response.status} was returned: ${result.message}`,
					);
				}
			} catch (err) {
				if (!response.ok) {
					logger.warn(
						`Failed to test HTTP challenge for domain ${domain} because HTTP status code ${response.status} was returned`,
					);
				} else {
					logger.warn(
						`Failed to test HTTP challenge for domain ${domain} because response failed to be parsed: ${err.message}`,
					);
				}
			}
		} catch (err) {
			logger.warn(`Failed to test HTTP challenge for domain ${domain}`, err);
		}

		if (!result) {
			// Some error occurred while trying to get the data
			return "failed";
		}
		if (result.error) {
			logger.info(
				`HTTP challenge test failed for domain ${domain} because error was returned: ${result.error.msg}`,
			);
			return `other:${result.error.msg}`;
		}
		if (`${result.responsecode}` === "200" && result.htmlresponse === "Success") {
			// Server exists and has responded with the correct data
			return "ok";
		}
		if (`${result.responsecode}` === "200") {
			// Server exists but has responded with wrong data
			logger.info(
				`HTTP challenge test failed for domain ${domain} because of invalid returned data:`,
				result.htmlresponse,
			);
			return "wrong-data";
		}
		if (`${result.responsecode}` === "404") {
			// Server exists but responded with a 404
			logger.info(`HTTP challenge test failed for domain ${domain} because code 404 was returned`);
			return "404";
		}
		if (
			`${result.responsecode}` === "0" ||
			(typeof result.reason === "string" && result.reason.toLowerCase() === "host unavailable")
		) {
			// Server does not exist at domain
			logger.info(`HTTP challenge test failed for domain ${domain} the host was not found`);
			return "no-host";
		}
		// Other errors
		logger.info(`HTTP challenge test failed for domain ${domain} because code ${result.responsecode} was returned`);
		return `other:${result.responsecode}`;
	},

	getLiveCertPath: (certificateId) => `/data/tls/certbot/live/npm-${certificateId}`,

	getCustomCertPath: (certificateId) => `/data/tls/custom/npm-${certificateId}`,

	getMtlsCertFile: (certificateId) => `/data/tls/mtls/npm-${certificateId}.pem`,
};

export default internalCertificate;
