import express from "express";
import internalDeadHost from "../../internal/dead-host.js";
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
 * /api/nginx/dead-hosts
 */
router
	.route("/")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/dead-hosts
	 *
	 * Retrieve all dead-hosts
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(listSchema, {
				expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
				query: typeof req.query.query === "string" ? req.query.query : null,
			});
			const rows = await internalDeadHost.getAll(res.locals.access, data.expand, data.query);
			res.status(200).send(rows);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * POST /api/nginx/dead-hosts
	 *
	 * Create a new dead-host
	 */
	.post(async (req, res, next) => {
		try {
			const payload = apiValidator(getValidationSchema("/nginx/dead-hosts", "post"), req.body);
			const result = await internalDeadHost.create(res.locals.access, payload);
			res.status(201).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Specific dead-host
 *
 * /api/nginx/dead-hosts/123
 */
router
	.route("/:host_id")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/dead-hosts/123
	 *
	 * Retrieve a specific dead-host
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(hostSchema, {
				host_id: req.params.host_id,
				expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
			});
			const row = await internalDeadHost.get(res.locals.access, {
				id: Number.parseInt(data.host_id, 10),
				expand: data.expand,
			});
			res.status(200).send(row);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * PUT /api/nginx/dead-hosts/123
	 *
	 * Update an existing dead-host
	 */
	.put(async (req, res, next) => {
		try {
			const payload = apiValidator(getValidationSchema("/nginx/dead-hosts/{hostID}", "put"), req.body);
			payload.id = Number.parseInt(req.params.host_id, 10);
			const result = await internalDeadHost.update(res.locals.access, payload);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * DELETE /api/nginx/dead-hosts/123
	 *
	 * Delete a dead-host
	 */
	.delete(async (req, res, next) => {
		try {
			const result = await internalDeadHost.delete(res.locals.access, {
				id: Number.parseInt(req.params.host_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Enable dead-host
 *
 * /api/nginx/dead-hosts/123/enable
 */
router
	.route("/:host_id/enable")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/dead-hosts/123/enable
	 */
	.post(async (req, res, next) => {
		try {
			const result = await internalDeadHost.enable(res.locals.access, {
				id: Number.parseInt(req.params.host_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Disable dead-host
 *
 * /api/nginx/dead-hosts/123/disable
 */
router
	.route("/:host_id/disable")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/dead-hosts/123/disable
	 */
	.post(async (req, res, next) => {
		try {
			const result = await internalDeadHost.disable(res.locals.access, {
				id: Number.parseInt(req.params.host_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

export default router;
