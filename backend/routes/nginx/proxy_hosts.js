import express from "express";
import internalProxyHost from "../../internal/proxy-host.js";
import idParam from "../../lib/express/id-param.js";
import jwtdecode from "../../lib/express/jwt-decode.js";
import validate from "../../lib/express/validate.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router.param("host_id", idParam);

/**
 * /api/nginx/proxy-hosts
 */
router
	.route("/")

	/**
	 * GET /api/nginx/proxy-hosts
	 *
	 * Retrieve all proxy-hosts
	 */
	.get(jwtdecode(), validate, async (_, res) => {
		const rows = await internalProxyHost.getAll(res.locals.access, res.locals.query.expand);
		res.status(200).send(rows);
	})

	/**
	 * POST /api/nginx/proxy-hosts
	 *
	 * Create a new proxy-host
	 */
	.post(jwtdecode(), validate, async (_, res) => {
		const result = await internalProxyHost.create(res.locals.access, res.locals.body);
		res.status(201).send(result);
	});

/**
 * Specific proxy-host
 *
 * /api/nginx/proxy-hosts/123
 */
router
	.route("/:host_id")

	/**
	 * GET /api/nginx/proxy-hosts/123
	 *
	 * Retrieve a specific proxy-host
	 */
	.get(jwtdecode(), validate, async (_, res) => {
		const row = await internalProxyHost.get(res.locals.access, {
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(row);
	})

	/**
	 * PUT /api/nginx/proxy-hosts/123
	 *
	 * Update an existing proxy-host
	 */
	.put(jwtdecode(), validate, async (_, res) => {
		const result = await internalProxyHost.update(res.locals.access, {
			...res.locals.body,
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(result);
	})

	/**
	 * DELETE /api/nginx/proxy-hosts/123
	 *
	 * Delete a proxy-host
	 */
	.delete(jwtdecode(), validate, async (_, res) => {
		const result = await internalProxyHost.delete(res.locals.access, {
			id: Number(res.locals.params.host_id),
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

	/**
	 * POST /api/nginx/proxy-hosts/123/enable
	 */
	.post(jwtdecode(), validate, async (_, res) => {
		const result = await internalProxyHost.enable(res.locals.access, {
			id: Number(res.locals.params.host_id),
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

	/**
	 * POST /api/nginx/proxy-hosts/123/disable
	 */
	.post(jwtdecode(), validate, async (_, res) => {
		const result = await internalProxyHost.disable(res.locals.access, {
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(result);
	});

export default router;
