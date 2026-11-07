import express from "express";
import internalRedirectionHost from "../../internal/redirection-host.js";
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
 * /api/nginx/redirection-hosts
 */
router
	.route("/")

	/**
	 * GET /api/nginx/redirection-hosts
	 *
	 * Retrieve all redirection-hosts
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const rows = await internalRedirectionHost.getAll(res.locals.access, res.locals.query.expand);
		res.status(200).send(rows);
	})

	/**
	 * POST /api/nginx/redirection-hosts
	 *
	 * Create a new redirection-host
	 */
	.post(jwtdecode, validate, async (_, res) => {
		const result = await internalRedirectionHost.create(res.locals.access, res.locals.body);
		res.status(201).send(result);
	});

/**
 * Specific redirection-host
 *
 * /api/nginx/redirection-hosts/123
 */
router
	.route("/:host_id")

	/**
	 * GET /api/nginx/redirection-hosts/123
	 *
	 * Retrieve a specific redirection-host
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const row = await internalRedirectionHost.get(res.locals.access, {
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(row);
	})

	/**
	 * PUT /api/nginx/redirection-hosts/123
	 *
	 * Update an existing redirection-host
	 */
	.put(jwtdecode, validate, async (_, res) => {
		const result = await internalRedirectionHost.update(res.locals.access, {
			...res.locals.body,
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(result);
	})

	/**
	 * DELETE /api/nginx/redirection-hosts/123
	 *
	 * Delete a redirection-host
	 */
	.delete(jwtdecode, validate, async (_, res) => {
		const result = await internalRedirectionHost.delete(res.locals.access, {
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(result);
	});

/**
 * Enable redirection-host
 *
 * /api/nginx/redirection-hosts/123/enable
 */
router
	.route("/:host_id/enable")

	/**
	 * POST /api/nginx/redirection-hosts/123/enable
	 */
	.post(jwtdecode, validate, async (_, res) => {
		const result = await internalRedirectionHost.enable(res.locals.access, {
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(result);
	});

/**
 * Disable redirection-host
 *
 * /api/nginx/redirection-hosts/123/disable
 */
router
	.route("/:host_id/disable")

	/**
	 * POST /api/nginx/redirection-hosts/123/disable
	 */
	.post(jwtdecode, validate, async (_, res) => {
		const result = await internalRedirectionHost.disable(res.locals.access, {
			id: Number(res.locals.params.host_id),
		});
		res.status(200).send(result);
	});

export default router;
