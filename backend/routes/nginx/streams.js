import express from "express";
import internalStream from "../../internal/stream.js";
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

const streamSchema = {
	required: ["stream_id"],
	additionalProperties: false,
	properties: {
		stream_id: {
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
 * /api/nginx/streams
 */
router
	.route("/")
	.all(jwtdecode()) // preferred so it doesn't apply to nonexistent routes

	/**
	 * GET /api/nginx/streams
	 *
	 * Retrieve all streams
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(listSchema, {
				expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
				query: typeof req.query.query === "string" ? req.query.query : null,
			});
			const rows = await internalStream.getAll(res.locals.access, data.expand, data.query);
			res.status(200).send(rows);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * POST /api/nginx/streams
	 *
	 * Create a new stream
	 */
	.post(async (req, res, next) => {
		try {
			const payload = apiValidator(getValidationSchema("/nginx/streams", "post"), req.body);
			const result = await internalStream.create(res.locals.access, payload);
			res.status(201).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Specific stream
 *
 * /api/nginx/streams/123
 */
router
	.route("/:stream_id")
	.all(jwtdecode()) // preferred so it doesn't apply to nonexistent routes

	/**
	 * GET /api/nginx/streams/123
	 *
	 * Retrieve a specific stream
	 */
	.get(async (req, res, next) => {
		try {
			const data = await validator(streamSchema, {
				stream_id: req.params.stream_id,
				expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
			});
			const row = await internalStream.get(res.locals.access, {
				id: Number.parseInt(data.stream_id, 10),
				expand: data.expand,
			});
			res.status(200).send(row);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * PUT /api/nginx/streams/123
	 *
	 * Update an existing stream
	 */
	.put(async (req, res, next) => {
		try {
			const payload = apiValidator(getValidationSchema("/nginx/streams/{streamID}", "put"), req.body);
			payload.id = Number.parseInt(req.params.stream_id, 10);
			const result = await internalStream.update(res.locals.access, payload);
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	})

	/**
	 * DELETE /api/nginx/streams/123
	 *
	 * Delete a stream
	 */
	.delete(async (req, res, next) => {
		try {
			const result = await internalStream.delete(res.locals.access, {
				id: Number.parseInt(req.params.stream_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Enable stream
 *
 * /api/nginx/streams/123/enable
 */
router
	.route("/:stream_id/enable")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/streams/123/enable
	 */
	.post(async (req, res, next) => {
		try {
			const result = await internalStream.enable(res.locals.access, {
				id: Number.parseInt(req.params.stream_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

/**
 * Disable stream
 *
 * /api/nginx/streams/123/disable
 */
router
	.route("/:stream_id/disable")
	.all(jwtdecode())

	/**
	 * POST /api/nginx/streams/123/disable
	 */
	.post(async (req, res, next) => {
		try {
			const result = await internalStream.disable(res.locals.access, {
				id: Number.parseInt(req.params.stream_id, 10),
			});
			res.status(200).send(result);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

export default router;
