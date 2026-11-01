import express from "express";
import requireLogin from "../lib/express/require-login.js";
import validate from "../lib/express/validate.js";
import PACKAGE from "../package.json" with { type: "json" };
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
	.get(requireLogin(), validate, (req, res) => {
		compiledSchema.info.version = PACKAGE.version;
		compiledSchema.servers[0].url = `${req.protocol}://${req.host}/api`;
		res.status(200)
			.type("json")
			.send(JSON.stringify(compiledSchema, null, req.app.get("json spaces")));
	});

export default router;
