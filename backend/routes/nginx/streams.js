import express from "express";
import internalStream from "../../internal/stream.js";
import idParam from "../../lib/express/id-param.js";
import jwtdecode from "../../lib/express/jwt-decode.js";
import validate from "../../lib/express/validate.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router.param("stream_id", idParam);

/**
 * /api/nginx/streams
 */
router
	.route("/") // preferred so it doesn't apply to nonexistent routes

	/**
	 * GET /api/nginx/streams
	 *
	 * Retrieve all streams
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const rows = await internalStream.getAll(res.locals.access, res.locals.query.expand);
		res.status(200).send(rows);
	})

	/**
	 * POST /api/nginx/streams
	 *
	 * Create a new stream
	 */
	.post(jwtdecode, validate, async (_, res) => {
		const result = await internalStream.create(res.locals.access, res.locals.body);
		res.status(201).send(result);
	});

/**
 * Specific stream
 *
 * /api/nginx/streams/123
 */
router
	.route("/:stream_id") // preferred so it doesn't apply to nonexistent routes

	/**
	 * GET /api/nginx/streams/123
	 *
	 * Retrieve a specific stream
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const row = await internalStream.get(res.locals.access, {
			id: Number(res.locals.params.stream_id),
		});
		res.status(200).send(row);
	})

	/**
	 * PUT /api/nginx/streams/123
	 *
	 * Update an existing stream
	 */
	.put(jwtdecode, validate, async (_, res) => {
		const result = await internalStream.update(res.locals.access, {
			...res.locals.body,
			id: Number(res.locals.params.stream_id),
		});
		res.status(200).send(result);
	})

	/**
	 * DELETE /api/nginx/streams/123
	 *
	 * Delete a stream
	 */
	.delete(jwtdecode, validate, async (_, res) => {
		const result = await internalStream.delete(res.locals.access, {
			id: Number(res.locals.params.stream_id),
		});
		res.status(200).send(result);
	});

/**
 * Enable stream
 *
 * /api/nginx/streams/123/enable
 */
router
	.route("/:stream_id/enable")

	/**
	 * POST /api/nginx/streams/123/enable
	 */
	.post(jwtdecode, validate, async (_, res) => {
		const result = await internalStream.enable(res.locals.access, {
			id: Number(res.locals.params.stream_id),
		});
		res.status(200).send(result);
	});

/**
 * Disable stream
 *
 * /api/nginx/streams/123/disable
 */
router
	.route("/:stream_id/disable")

	/**
	 * POST /api/nginx/streams/123/disable
	 */
	.post(jwtdecode, validate, async (_, res) => {
		const result = await internalStream.disable(res.locals.access, {
			id: Number(res.locals.params.stream_id),
		});
		res.status(200).send(result);
	});

export default router;
