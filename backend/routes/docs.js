import express from "express";
import swaggerUi from "swagger-ui-express";
import requireLogin from "../lib/express/require-login.js";
import PACKAGE from "../package.json" with { type: "json" };
import { getCompiledSchema } from "../schema/index.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router.use("/", requireLogin(), swaggerUi.serve);

router
	.route("/")

	/**
	 * GET / (Now serves the Swagger UI interface)
	 */
	.get(async (req, res) => {
		const swaggerJSON = await getCompiledSchema();
		swaggerJSON.info.version = PACKAGE.version;
		swaggerJSON.servers[0].url = `${req.protocol}://${req.host}/api`;
		res.status(200).send(swaggerUi.generateHTML(swaggerJSON));
	});

export default router;
