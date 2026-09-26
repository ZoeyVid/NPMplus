import express from "express";
import internalRedirectionHost from "../../internal/redirection-host.js";
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
			items: { enum: ["owner", "certificate"] },
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
	},
};

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

/**
 * /api/nginx/redirection-hosts
 */
router
	.route("/")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/redirection-hosts
	 *
	 * Retrieve all redirection-hosts
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(listSchema, {
				expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
				query: typeof req.query.query === "string" ? req.query.query : null,
			});
			const rows = await internalRedirectionHost.getAll(res.locals.access, data.expand, data.query);
			res.status(200).send(rows);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * POST /api/nginx/redirection-hosts
	 *
	 * Create a new redirection-host
	 */
	.post(async (req, res, next) => {
		try {
			const payload = apiValidator(getValidationSchema("/nginx/redirection-hosts", "post"), req.body);
			const result = await internalRedirectionHost.create(res.locals.access, payload);
			res.status(201).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Specific redirection-host
 *
 * /api/nginx/redirection-hosts/123
 */
router
	.route("/:host_id")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/redirection-hosts/123
	 *
	 * Retrieve a specific redirection-host
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(hostSchema, {
				host_id: req.params.host_id,
			});
			const row = await internalRedirectionHost.get(res.locals.access, {
				id: Number.parseInt(data.host_id, 10),
			});
			res.status(200).send(row);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * PUT /api/nginx/redirection-hosts/123
	 *
	 * Update an existing redirection-host
	 */
	.put(async (req, res, next) => {
		try {
			const payload = apiValidator(getValidationSchema("/nginx/redirection-hosts/{hostID}", "put"), req.body);
			payload.id = Number.parseInt(req.params.host_id, 10);
			const result = await internalRedirectionHost.update(res.locals.access, payload);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * DELETE /api/nginx/redirection-hosts/123
	 *
	 * Delete a redirection-host
	 */
	.delete(async (req, res, next) => {
		try {
			const result = await internalRedirectionHost.delete(res.locals.access, {
				id: Number.parseInt(req.params.host_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Enable redirection-host
 *
 * /api/nginx/redirection-hosts/123/enable
 */
router
	.route("/:host_id/enable")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/redirection-hosts/123/enable
	 */
	.post(async (req, res, next) => {
		try {
			const result = await internalRedirectionHost.enable(res.locals.access, {
				id: Number.parseInt(req.params.host_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Disable redirection-host
 *
 * /api/nginx/redirection-hosts/123/disable
 */
router
	.route("/:host_id/disable")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/redirection-hosts/123/disable
	 */
	.post(async (req, res, next) => {
		try {
			const result = await internalRedirectionHost.disable(res.locals.access, {
				id: Number.parseInt(req.params.host_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

export default router;
