import express from "express";
import jwtdecode from "../lib/express/jwt-decode.js";
import validate from "../lib/express/validate.js";
import { compiledSchema } from "../schema/index.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router
	.route("/")

	/**
	 * GET /schema
	 */
	.get(jwtdecode, validate, (req, res) => {
		res.status(200)
			.type("json")
			.send(JSON.stringify(compiledSchema, null, req.app.get("json spaces")));
	});

export default router;
