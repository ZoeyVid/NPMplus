import express from "express";
import internalAccessList from "../../internal/access-list.js";
import idParam from "../../lib/express/id-param.js";
import jwtdecode from "../../lib/express/jwt-decode.js";
import validate from "../../lib/express/validate.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router.param("list_id", idParam);

/**
 * /api/nginx/access-lists
 */
router
	.route("/")

	/**
	 * GET /api/nginx/access-lists
	 *
	 * Retrieve all access-lists
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const rows = await internalAccessList.getAll(res.locals.access, res.locals.query.expand);
		res.status(200).send(rows);
	})

	/**
	 * POST /api/nginx/access-lists
	 *
	 * Create a new access-list
	 */
	.post(jwtdecode, validate, async (_, res) => {
		const result = await internalAccessList.create(res.locals.access, res.locals.body);
		res.status(201).send(result);
	});

/**
 * Specific access-list
 *
 * /api/nginx/access-lists/123
 */
router
	.route("/:list_id")

	/**
	 * GET /api/nginx/access-lists/123
	 *
	 * Retrieve a specific access-list
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const row = await internalAccessList.get(res.locals.access, {
			id: Number(res.locals.params.list_id),
			expand: res.locals.query.expand,
		});
		res.status(200).send(row);
	})

	/**
	 * PUT /api/nginx/access-lists/123
	 *
	 * Update and existing access-list
	 */
	.put(jwtdecode, validate, async (_, res) => {
		const result = await internalAccessList.update(res.locals.access, {
			...res.locals.body,
			id: Number(res.locals.params.list_id),
		});
		res.status(200).send(result);
	})

	/**
	 * DELETE /api/nginx/access-lists/123
	 *
	 * Delete and existing access-list
	 */
	.delete(jwtdecode, validate, async (_, res) => {
		const result = await internalAccessList.delete(res.locals.access, {
			id: Number(res.locals.params.list_id),
		});
		res.status(200).send(result);
	});

export default router;
