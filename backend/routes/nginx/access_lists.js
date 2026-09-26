import express from "express";
import internalAccessList from "../../internal/access-list.js";
import jwtdecode from "../../lib/express/jwt-decode.js";
import apiValidator from "../../lib/validator/api.js";
import validator from "../../lib/validator/index.js";
import { getValidationSchema } from "../../schema/index.js";

const listSchema = {
	additionalProperties: false,
	properties: {
		expand: {
			$ref: "common#/properties/expand",
			items: { enum: ["owner", "items", "clients"] },
		},
		query: {
			$ref: "common#/properties/query",
		},
	},
};

const accessListSchema = {
	required: ["list_id"],
	additionalProperties: false,
	properties: {
		list_id: {
			$ref: "common#/properties/id",
		},
		expand: {
			$ref: "common#/properties/expand",
			items: { enum: ["items", "clients"] },
		},
	},
};

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

/**
 * /api/nginx/access-lists
 */
router
	.route("/")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/access-lists
	 *
	 * Retrieve all access-lists
	 */
	.get(async (req, res) => {
		const data = await validator(listSchema, {
			expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
			query: typeof req.query.query === "string" ? req.query.query : null,
		});
		const rows = await internalAccessList.getAll(res.locals.access, data.expand, data.query);
		res.status(200).send(rows);
	})

	/**
	 * POST /api/nginx/access-lists
	 *
	 * Create a new access-list
	 */
	.post(async (req, res) => {
		const payload = apiValidator(getValidationSchema("/nginx/access-lists", "post"), req.body);
		const result = await internalAccessList.create(res.locals.access, payload);
		res.status(201).send(result);
	});

/**
 * Specific access-list
 *
 * /api/nginx/access-lists/123
 */
router
	.route("/:list_id")
	.all(jwtdecode())

	/**
	 * GET /api/nginx/access-lists/123
	 *
	 * Retrieve a specific access-list
	 */
	.get(async (req, res) => {
		const data = await validator(accessListSchema, {
			list_id: req.params.list_id,
			expand: typeof req.query.expand === "string" ? req.query.expand.split(",") : null,
		});
		const row = await internalAccessList.get(res.locals.access, {
			id: Number.parseInt(data.list_id, 10),
			expand: data.expand,
		});
		res.status(200).send(row);
	})

	/**
	 * PUT /api/nginx/access-lists/123
	 *
	 * Update and existing access-list
	 */
	.put(async (req, res) => {
		const payload = apiValidator(getValidationSchema("/nginx/access-lists/{listID}", "put"), req.body);
		payload.id = Number.parseInt(req.params.list_id, 10);
		const result = await internalAccessList.update(res.locals.access, payload);
		res.status(200).send(result);
	})

	/**
	 * DELETE /api/nginx/access-lists/123
	 *
	 * Delete and existing access-list
	 */
	.delete(async (req, res) => {
		const result = await internalAccessList.delete(res.locals.access, {
			id: Number.parseInt(req.params.list_id, 10),
		});
		res.status(200).send(result);
	});

export default router;
