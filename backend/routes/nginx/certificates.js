import { mkdtempDisposable } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import dnsPlugins from "../../certbot/dns-plugins.json" with { type: "json" };
import internalCertificate from "../../internal/certificate.js";
import errs from "../../lib/error.js";
import idParam from "../../lib/express/id-param.js";
import jwtdecode from "../../lib/express/jwt-decode.js";
import requireLogin from "../../lib/express/require-login.js";
import validate from "../../lib/express/validate.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router.param("certificate_id", idParam);

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

/**
 * /api/nginx/certificates
 */
router
	.route("/")

	/**
	 * GET /api/nginx/certificates
	 *
	 * Retrieve all certificates
	 */
	.get(jwtdecode(), validate, async (_, res) => {
		const rows = await internalCertificate.getAll(res.locals.access, res.locals.query.expand);
		res.status(200).send(rows);
	})

	/**
	 * POST /api/nginx/certificates
	 *
	 * Create a new certificate
	 */
	.post(jwtdecode(), validate, async (req, res) => {
		req.setTimeout(900000); // 15 minutes timeout
		const result = await internalCertificate.create(res.locals.access, res.locals.body);
		res.status(201).send(result);
	});

/**
 * /api/nginx/certificates/dns-providers
 */
router
	.route("/dns-providers")

	/**
	 * GET /api/nginx/certificates/dns-providers
	 *
	 * Get list of all supported DNS providers
	 */
	.get(requireLogin(), validate, (_, res) => {
		res.status(200).send(
			Object.entries(dnsPlugins)
				.map(([id, { name, credentials }]) => ({ id, name, credentials }))
				.sort((a, b) => a.name.localeCompare(b.name)),
		);
	});

/**
 * Test HTTP challenge for domains
 *
 * /api/nginx/certificates/test-http
 */
router
	.route("/test-http")

	/**
	 * POST /api/nginx/certificates/test-http
	 *
	 * Test HTTP challenge for domains
	 */
	.post(jwtdecode(), validate, async (req, res) => {
		req.setTimeout(60000); // 1 minute timeout

		const result = await internalCertificate.testHttpsChallenge(res.locals.access, res.locals.body);
		res.status(200).send(result);
	});

/**
 * Validate Certs before saving
 *
 * /api/nginx/certificates/validate
 */
router
	.route("/validate")

	/**
	 * POST /api/nginx/certificates/validate
	 *
	 * Validate certificates
	 */
	.post(jwtdecode(), validate, uploadCerts, (req, res) => {
		if (!req.files?.certificate) throw new errs.ValidationError("certificate file is required");

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

	/**
	 * GET /api/nginx/certificates/123
	 *
	 * Retrieve a specific certificate
	 */
	.get(jwtdecode(), validate, async (_, res) => {
		const row = await internalCertificate.get(res.locals.access, {
			id: Number(res.locals.params.certificate_id),
		});
		res.status(200).send(row);
	})

	/**
	 * DELETE /api/nginx/certificates/123
	 *
	 * Update and existing certificate
	 */
	.delete(jwtdecode(), validate, async (_, res) => {
		const result = await internalCertificate.delete(res.locals.access, {
			id: Number(res.locals.params.certificate_id),
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

	/**
	 * POST /api/nginx/certificates/123/upload
	 *
	 * Upload certificates
	 */
	.post(jwtdecode(), validate, uploadCerts, async (req, res) => {
		if (!req.files?.certificate) throw new errs.ValidationError("certificate file is required");

		const result = await internalCertificate.upload(res.locals.access, {
			id: Number(res.locals.params.certificate_id),
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

	/**
	 * POST /api/nginx/certificates/123/renew
	 *
	 * Renew certificate
	 */
	.post(jwtdecode(), validate, async (req, res) => {
		req.setTimeout(900000); // 15 minutes timeout
		const result = await internalCertificate.renew(res.locals.access, {
			id: Number(res.locals.params.certificate_id),
		});
		res.status(200).send(result);
	});

/**
 * Download Certs
 *
 * /api/nginx/certificates/123/download
 */
router
	.route("/:certificate_id/download")

	/**
	 * GET /api/nginx/certificates/123/download
	 *
	 * Download certificate
	 */
	.get(jwtdecode(), validate, downloadLimiter, async (_, res) => {
		await using dir = await mkdtempDisposable(path.join(tmpdir(), "npm-"));
		const result = await internalCertificate.download(
			res.locals.access,
			{ id: Number(res.locals.params.certificate_id) },
			dir.path,
		);
		await new Promise((resolve, reject) =>
			res.status(200).download(result.fileName, (err) => (err && !res.headersSent ? reject(err) : resolve())),
		);
	});

export default router;
