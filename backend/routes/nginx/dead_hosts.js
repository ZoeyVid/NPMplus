import express from "express";
import internalDeadHost from "../../internal/dead-host.js";
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
 * /api/nginx/dead-hosts
 */
router
	.route("/")

	/**
	 * GET /api/nginx/dead-hosts
	 *
	 * Retrieve all dead-hosts
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const rows = await internalDeadHost.getAll(res.locals.access, res.locals.query.expand);
		res.status(200).send(rows);
	})

	/**
	 * POST /api/nginx/dead-hosts
	 *
	 * Create a new dead-host
	 */
	.post(jwtdecode, validate, async (_, res) => {
		const result = await internalDeadHost.create(res.locals.access, res.locals.body);
		res.status(201).send(result);
	});

/**
 * Specific dead-host
 *
 * /api/nginx/dead-hosts/123
 */
router
	.route("/:host_id")

	/**
	 * GET /api/nginx/dead-hosts/123
	 *
	 * Retrieve a specific dead-host
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const row = await internalDeadHost.get(res.locals.access, {
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(row);
	})

	/**
	 * PUT /api/nginx/dead-hosts/123
	 *
	 * Update an existing dead-host
	 */
	.put(jwtdecode, validate, async (_, res) => {
		const result = await internalDeadHost.update(res.locals.access, {
			...res.locals.body,
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(result);
	})

	/**
	 * DELETE /api/nginx/dead-hosts/123
	 *
	 * Delete a dead-host
	 */
	.delete(jwtdecode, validate, async (_, res) => {
		const result = await internalDeadHost.delete(res.locals.access, {
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(result);
	});

/**
 * Enable dead-host
 *
 * /api/nginx/dead-hosts/123/enable
 */
router
	.route("/:host_id/enable")

	/**
	 * POST /api/nginx/dead-hosts/123/enable
	 */
	.post(jwtdecode, validate, async (_, res) => {
		const result = await internalDeadHost.enable(res.locals.access, {
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(result);
	});

/**
 * Disable dead-host
 *
 * /api/nginx/dead-hosts/123/disable
 */
router
	.route("/:host_id/disable")

	/**
	 * POST /api/nginx/dead-hosts/123/disable
	 */
	.post(jwtdecode, validate, async (_, res) => {
		const result = await internalDeadHost.disable(res.locals.access, {
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(result);
	});

export default router;
