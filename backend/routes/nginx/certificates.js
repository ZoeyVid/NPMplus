import { rm } from "node:fs/promises";
import path from "node:path";
import express from "express";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import dnsPlugins from "../../certbot/dns-plugins.json" with { type: "json" };
import internalCertificate from "../../internal/certificate.js";
import errs from "../../lib/error.js";
import jwtdecode from "../../lib/express/jwt-decode.js";
import apiValidator from "../../lib/validator/api.js";
import validator from "../../lib/validator/index.js";
import { debug, express as logger } from "../../logger.js";
import { getValidationSchema } from "../../schema/index.js";

const listSchema = {
	additionalProperties: false,
	properties: {
		expand: {
			$ref: "common#/properties/expand",
			items: {
				enum: [
					"owner",
					"proxy_hosts",
					"redirection_hosts",
					"dead_hosts",
					"streams",
					"mtls_proxy_hosts",
					"mtls_redirection_hosts",
					"mtls_dead_hosts",
					"mtls_streams",
				],
			},
		},
		query: {
			$ref: "common#/properties/query",
		},
	},
};

const certificateSchema = {
	required: ["certificate_id"],
	additionalProperties: false,
	properties: {
		certificate_id: {
			$ref: "common#/properties/id",
		},
	},
};

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

const downloadLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	limit: 10,
	message: { error: { message: "Too many requests, please try again later." } },
	standardHeaders: "draft-8",
	legacyHeaders: false,
	ipv6Subnet: 48,
});

const uploadCerts = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024, fields: 0 } }).fields([
	{ name: "certificate", maxCount: 1 },
	{ name: "certificate_key", maxCount: 1 },
]);
const parseCertFiles = (req, res, next) =>
	uploadCerts(req, res, (err) => {
		if (err) return res.status(400).send({ error: "only certificate and certificate_key files are allowed" });
		next();
	});

/**
 * /api/nginx/certificates
 */
router
	.route("/")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/certificates
	 *
	 * Retrieve all certificates
	 */
	.get(async (req, res) => {
		const data = await validator(listSchema, {
			expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
			query: typeof req.query.query === "string" ? req.query.query : null,
		});
		const rows = await internalCertificate.getAll(res.locals.access, data.expand, data.query);
		res.status(200).send(rows);
	})

	/**
	 * POST /api/nginx/certificates
	 *
	 * Create a new certificate
	 */
	.post(async (req, res) => {
		const payload = apiValidator(getValidationSchema("/nginx/certificates", "post"), req.body);
		req.setTimeout(900000); // 15 minutes timeout
		const result = await internalCertificate.create(res.locals.access, payload);
		res.status(201).send(result);
	});

/**
 * /api/nginx/certificates/dns-providers
 */
router
	.route("/dns-providers")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/certificates/dns-providers
	 *
	 * Get list of all supported DNS providers
	 */
	.get((_, res) => {
		if (!res.locals.access.token.getUserId()) {
			throw new errs.PermissionError("Login required");
		}
		const clean = Object.keys(dnsPlugins).map((key) => ({
			id: key,
			name: dnsPlugins[key].name,
			credentials: dnsPlugins[key].credentials,
		}));

		clean.sort((a, b) => a.name.localeCompare(b.name));
		res.status(200).send(clean);
	});

/**
 * Test HTTP challenge for domains
 *
 * /api/nginx/certificates/test-http
 */
router
	.route("/test-http")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/certificates/test-http
	 *
	 * Test HTTP challenge for domains
	 */
	.post(async (req, res) => {
		const payload = apiValidator(getValidationSchema("/nginx/certificates/test-http", "post"), req.body);
		req.setTimeout(60000); // 1 minute timeout

		const result = await internalCertificate.testHttpsChallenge(res.locals.access, payload);
		res.status(200).send(result);
	});

/**
 * Validate Certs before saving
 *
 * /api/nginx/certificates/validate
 */
router
	.route("/validate")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/certificates/validate
	 *
	 * Validate certificates
	 */
	.post(parseCertFiles, (req, res) => {
		if (!req.files?.certificate) return res.status(400).send({ error: "certificate file is required" });

		const result = internalCertificate.validate(res.locals.access, {
			files: req.files,
		});
		res.status(200).send(result);
	});

/**
 * Specific certificate
 *
 * /api/nginx/certificates/123
 */
router
	.route("/:certificate_id")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/certificates/123
	 *
	 * Retrieve a specific certificate
	 */
	.get(async (req, res) => {
		const data = await validator(certificateSchema, {
			certificate_id: req.params.certificate_id,
		});
		const row = await internalCertificate.get(res.locals.access, {
			id: Number.parseInt(data.certificate_id, 10),
		});
		res.status(200).send(row);
	})

	/**
	 * DELETE /api/nginx/certificates/123
	 *
	 * Update and existing certificate
	 */
	.delete(async (req, res) => {
		const result = await internalCertificate.delete(res.locals.access, {
			id: Number.parseInt(req.params.certificate_id, 10),
		});
		res.status(200).send(result);
	});

/**
 * Upload Certs
 *
 * /api/nginx/certificates/123/upload
 */
router
	.route("/:certificate_id/upload")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/certificates/123/upload
	 *
	 * Upload certificates
	 */
	.post(parseCertFiles, async (req, res) => {
		if (!req.files?.certificate) return res.status(400).send({ error: "certificate file is required" });

		const result = await internalCertificate.upload(res.locals.access, {
			id: Number.parseInt(req.params.certificate_id, 10),
			files: req.files,
		});
		res.status(200).send(result);
	});

/**
 * Renew certbot Certs
 *
 * /api/nginx/certificates/123/renew
 */
router
	.route("/:certificate_id/renew")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/certificates/123/renew
	 *
	 * Renew certificate
	 */
	.post(async (req, res) => {
		req.setTimeout(900000); // 15 minutes timeout
		const result = await internalCertificate.renew(res.locals.access, {
			id: Number.parseInt(req.params.certificate_id, 10),
		});
		res.status(200).send(result);
	});

/**
 * Download certbot Certs
 *
 * /api/nginx/certificates/123/download
 */
router
	.route("/:certificate_id/download")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/certificates/123/download
	 *
	 * Download certificate
	 */
	.get(downloadLimiter, async (req, res, next) => {
		const result = await internalCertificate.download(res.locals.access, {
			id: Number.parseInt(req.params.certificate_id, 10),
		});
		res.status(200).download(result.fileName, async (err) => {
			try {
				await rm(path.dirname(result.fileName), { recursive: true, force: true });
			} catch (rmErr) {
				debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${rmErr}`);
			}
			if (err && !res.headersSent) next(err);
		});
	});

export default router;
