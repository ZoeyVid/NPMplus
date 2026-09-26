import express from "express";
import internalProxyHost from "../../internal/proxy-host.js";
import jwtdecode from "../../lib/express/jwt-decode.js";
import apiValidator from "../../lib/validator/api.js";
import validator from "../../lib/validator/index.js";
import { getValidationSchema } from "../../schema/index.js";

const listSchema = {
	additionalProperties: false,
	properties: {
		expand: {
			$ref: "common#/properties/expand",
			items: { enum: ["owner", "access_lists", "certificate"] },
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
	.get(async (req, res) => {
		const data = await validator(listSchema, {
			expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
			query: typeof req.query.query === "string" ? req.query.query : null,
		});
		const rows = await internalProxyHost.getAll(res.locals.access, data.expand, data.query);
		res.status(200).send(rows);
	})

	/**
	 * POST /api/nginx/proxy-hosts
	 *
	 * Create a new proxy-host
	 */
	.post(async (req, res) => {
		const payload = apiValidator(getValidationSchema("/nginx/proxy-hosts", "post"), req.body);
		const result = await internalProxyHost.create(res.locals.access, payload);
		res.status(201).send(result);
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
	.get(async (req, res) => {
		const data = await validator(hostSchema, {
			host_id: req.params.host_id,
		});
		const row = await internalProxyHost.get(res.locals.access, {
			id: Number.parseInt(data.host_id, 10),
		});
		res.status(200).send(row);
	})

	/**
	 * PUT /api/nginx/proxy-hosts/123
	 *
	 * Update an existing proxy-host
	 */
	.put(async (req, res) => {
		const payload = apiValidator(getValidationSchema("/nginx/proxy-hosts/{hostID}", "put"), req.body);
		payload.id = Number.parseInt(req.params.host_id, 10);
		const result = await internalProxyHost.update(res.locals.access, payload);
		res.status(200).send(result);
	})

	/**
	 * DELETE /api/nginx/proxy-hosts/123
	 *
	 * Delete a proxy-host
	 */
	.delete(async (req, res) => {
		const result = await internalProxyHost.delete(res.locals.access, {
			id: Number.parseInt(req.params.host_id, 10),
		});
		res.status(200).send(result);
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
	.post(async (req, res) => {
		const result = await internalProxyHost.enable(res.locals.access, {
			id: Number.parseInt(req.params.host_id, 10),
		});
		res.status(200).send(result);
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
	.post(async (req, res) => {
		const result = await internalProxyHost.disable(res.locals.access, {
			id: Number.parseInt(req.params.host_id, 10),
		});
		res.status(200).send(result);
	});

export default router;
