import express from "express";
import fs from "node:fs";
import internalProxyHost from "../../internal/proxy-host.js";
import internalProxyHostAccessList from "../../internal/proxy-host-access-list.js";
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
		},
		query: {
			$ref: "common#/properties/query",
		},
	},
};

const hostSchema = {
	required: ["host_id"],
	additionalProperties: false,
	properties: {
		host_id: {
			$ref: "common#/properties/id",
		},
		expand: {
			$ref: "common#/properties/expand",
		},
	},
};

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

/**
 * /api/nginx/proxy-hosts
 */
router
	.route("/")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/proxy-hosts
	 *
	 * Retrieve all proxy-hosts
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(listSchema, {
				expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
				query: typeof req.query.query === "string" ? req.query.query : null,
			});
			const rows = await internalProxyHost.getAll(res.locals.access, data.expand, data.query);
			res.status(200).send(rows.map((row) => internalProxyHostAccessList.maskAccessListItems(row)));
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * POST /api/nginx/proxy-hosts
	 *
	 * Create a new proxy-host
	 */
	.post(async (req, res, next) => {
		try {
			const payload = apiValidator(getValidationSchema("/nginx/proxy-hosts", "post"), req.body);
			const result = await internalProxyHost.create(res.locals.access, payload);
			res.status(201).send(result);
		} catch (err) {
			debug(
				logger,
				`${req.method.toUpperCase()} ${req.originalUrl}: ${err} ${JSON.stringify(err.debug, null, 2)}`,
			);
			next(err);
		}
	});

/**
 * Specific proxy-host
 *
 * /api/nginx/proxy-hosts/123
 */
router
	.route("/:host_id")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/proxy-hosts/123
	 *
	 * Retrieve a specific proxy-host
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(hostSchema, {
				host_id: req.params.host_id,
				expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
			});
			const row = await internalProxyHost.get(res.locals.access, {
				id: Number.parseInt(data.host_id, 10),
				expand: data.expand,
			});
			res.status(200).send(internalProxyHostAccessList.maskAccessListItems(row));
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * PUT /api/nginx/proxy-hosts/123
	 *
	 * Update an existing proxy-host
	 */
	.put(async (req, res, next) => {
		try {
			const payload = apiValidator(getValidationSchema("/nginx/proxy-hosts/{hostID}", "put"), req.body);
			payload.id = Number.parseInt(req.params.host_id, 10);
			const result = await internalProxyHost.update(res.locals.access, payload);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * DELETE /api/nginx/proxy-hosts/123
	 *
	 * Delete a proxy-host
	 */
	.delete(async (req, res, next) => {
		try {
			const result = await internalProxyHost.delete(res.locals.access, {
				id: Number.parseInt(req.params.host_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Enable proxy-host
 *
 * /api/nginx/proxy-hosts/123/enable
 */
router
	.route("/:host_id/enable")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/proxy-hosts/123/enable
	 */
	.post(async (req, res, next) => {
		try {
			const result = await internalProxyHost.enable(res.locals.access, {
				id: Number.parseInt(req.params.host_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Disable proxy-host
 *
 * /api/nginx/proxy-hosts/123/disable
 */
router
	.route("/:host_id/disable")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/proxy-hosts/123/disable
	 */
	.post(async (req, res, next) => {
		try {
			const result = await internalProxyHost.disable(res.locals.access, {
				id: Number.parseInt(req.params.host_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Proxy-host logs
 *
 * /api/nginx/proxy-hosts/123/logs
 */
router
	.route("/:host_id/logs")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * GET /api/nginx/proxy-hosts/123/logs
	 *
	 * Retrieve logs for a specific proxy-host
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(
				{
					required: ["host_id"],
					additionalProperties: false,
					properties: {
						host_id: {
							$ref: "common#/properties/id",
						},
						type: {
							type: "string",
							enum: ["access", "error"],
						},
					},
				},
				{
					host_id: req.params.host_id,
					type: req.query.type || "access",
				},
			);

			const hostId = Number.parseInt(data.host_id, 10);
			const logType = data.type === "error" ? "error" : "access";
			const logFile = `/data/logs/proxy-host-${hostId}_${logType}.log`;

			// Check access permission
			await res.locals.access.can("proxy_hosts:get", hostId);

			let logs = "";
			if (fs.existsSync(logFile)) {
				const content = fs.readFileSync(logFile, { encoding: "utf8" });
				const lines = content.split("\n");
				// Return last 1000 lines to avoid huge payloads
				const maxLines = 1000;
				if (lines.length > maxLines) {
					logs = lines.slice(-maxLines).join("\n");
				} else {
					logs = content;
				}
			}

			res.status(200).send({ logs });
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

export default router;
