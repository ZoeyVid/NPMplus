import express from "express";
import requireLogin from "../lib/express/require-login.js";
import { debug, express as logger } from "../logger.js";
import PACKAGE from "../package.json" with { type: "json" };
import { getCompiledSchema } from "../schema/index.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router
	.route("/")
	.all(requireLogin())

	/**
	 * GET /schema
	 */
	.get(async (req, res, next) => {
		try {
			const swaggerJSON = await getCompiledSchema();
			swaggerJSON.info.version = PACKAGE.version;
			swaggerJSON.servers[0].url = `${req.protocol}://${req.host}/api`;
			res.status(200)
				.type("json")
				.send(JSON.stringify(swaggerJSON, null, req.app.get("json spaces")));
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

export default router;
