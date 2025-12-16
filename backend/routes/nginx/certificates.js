import express from "express";
import rateLimit from "express-rate-limit";
import internalCertificate from "../../internal/certificate.js";
import dnsPlugins from "../../certbot/dns-plugins.json" with { type: "json" };
import errs from "../../lib/error.js";
import jwtdecode from "../../lib/express/jwt-decode.js";
import apiValidator from "../../lib/validator/api.js";
import validator from "../../lib/validator/index.js";
import { debug, express as logger } from "../../logger.js";
import { getValidationSchema } from "../../schema/index.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});
// Rate limiter for certificate downloads: max 10 downloads per 15 minutes per IP
const downloadLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // limit each IP to 10 download requests per windowMs
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	message: { error: "Too many download requests from this IP, please try again later." },
	validate: {
		trustProxy: false,
	},
});

/**
 * /api/nginx/certificates
 */
router
	.route("/")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * GET /api/nginx/certificates
	 *
	 * Retrieve all certificates
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(
				{
					additionalProperties: false,
					properties: {
						expand: {
							$ref: "common#/properties/expand",
						},
						query: {
							$ref: "common#/properties/query",
						},
					},
				},
				{
					expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
					query: typeof req.query.query === "string" ? req.query.query : null,
				},
			);
			const rows = await internalCertificate.getAll(res.locals.access, data.expand, data.query);
			res.status(200).send(rows);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	})

	/**
	 * POST /api/nginx/certificates
	 *
	 * Create a new certificate
	 */
	.post(async (req, res, next) => {
		try {
			const payload = await apiValidator(getValidationSchema("/nginx/certificates", "post"), req.body);
			req.setTimeout(900000); // 15 minutes timeout
			const result = await internalCertificate.create(res.locals.access, payload);
			res.status(201).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * /api/nginx/certificates/dns-providers
 */
router
	.route("/dns-providers")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * GET /api/nginx/certificates/dns-providers
	 *
	 * Get list of all supported DNS providers
	 */
	.get(async (req, res, next) => {
		try {
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
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * Test HTTP challenge for domains
 *
 * /api/nginx/certificates/test-http
 */
router
	.route("/test-http")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * POST /api/nginx/certificates/test-http
	 *
	 * Test HTTP challenge for domains
	 */
	.post(async (req, res, next) => {
		try {
			const payload = await apiValidator(getValidationSchema("/nginx/certificates/test-http", "post"), req.body);
			req.setTimeout(60000); // 1 minute timeout

			const result = await internalCertificate.testHttpsChallenge(res.locals.access, payload);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * Validate Certs before saving
 *
 * /api/nginx/certificates/validate
 */
router
	.route("/validate")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * POST /api/nginx/certificates/validate
	 *
	 * Validate certificates
	 */
	.post(async (req, res, next) => {
		if (!req.files) {
			res.status(400).send({ error: "No files were uploaded" });
			return;
		}

		try {
			const result = await internalCertificate.validate({
				files: req.files,
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * Specific certificate
 *
 * /api/nginx/certificates/123
 */
router
	.route("/:certificate_id")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * GET /api/nginx/certificates/123
	 *
	 * Retrieve a specific certificate
	 */
	.get(async (req, res, next) => {
		try {
			const certificateId = Number.parseInt(req.params.certificate_id, 10); // lgtm[js/sensitive-get-query]
			if (Number.isNaN(certificateId) || certificateId < 1) {
				throw new errs.ValidationError("certificate_id must be an integer greater than 0");
			}

			let expand = null;
			if (typeof req.query.expand === "string") {
				expand = req.query.expand.split(",");
			}

			const row = await internalCertificate.get(res.locals.access, {
				id: certificateId,
				expand: expand,
			});
			res.status(200).send(row);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	})

	/**
	 * PUT /api/nginx/certificates/123
	 *
	 * Updates a specific certificate
	 */
	.put(async (req, res, next) => {
		try {
			const data = { id: req.params.certificate_id, ...req.body };
			const payload = await apiValidator(getValidationSchema("/nginx/certificates/test-http", "post"), data);

			const result = internalCertificate.update(res.locals.access, payload);
			res.status(201).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	})

	/**
	 * DELETE /api/nginx/certificates/123
	 *
	 * Update and existing certificate
	 */
	.delete(async (req, res, next) => {
		try {
			const result = await internalCertificate.delete(res.locals.access, {
				id: Number.parseInt(req.params.certificate_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * Upload Certs
 *
 * /api/nginx/certificates/123/upload
 */
router
	.route("/:certificate_id/upload")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * POST /api/nginx/certificates/123/upload
	 *
	 * Upload certificates
	 */
	.post(async (req, res, next) => {
		if (!req.files) {
			res.status(400).send({ error: "No files were uploaded" });
			return;
		}

		try {
			const result = await internalCertificate.upload(res.locals.access, {
				id: Number.parseInt(req.params.certificate_id, 10),
				files: req.files,
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * Renew certbot Certs
 *
 * /api/nginx/certificates/123/renew
 */
router
	.route("/:certificate_id/renew")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * POST /api/nginx/certificates/123/renew
	 *
	 * Renew certificate
	 */
	.post(async (req, res, next) => {
		req.setTimeout(900000); // 15 minutes timeout
		try {
			const result = await internalCertificate.renew(res.locals.access, {
				id: Number.parseInt(req.params.certificate_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

/**
 * Download certbot Certs
 *
 * /api/nginx/certificates/download
 */
router
	.route("/download")
	.options((_req, res) => {
		res.sendStatus(204);
	})
	.all(downloadLimiter)
	.all(jwtdecode())

	/**
	 * POST /api/nginx/certificates/download
	 *
	 * Download certificate
	 */
	.post(async (req, res, next) => {
		try {
			const payload = await apiValidator(getValidationSchema("/nginx/certificates/download", "post"), req.body);
			const result = await internalCertificate.download(res.locals.access, {
				id: Number.parseInt(payload.id, 10),
			});
			res.status(200).download(result.fileName);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

export default router;