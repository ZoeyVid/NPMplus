import express from "express";
import swaggerUi from "swagger-ui-express";
import requireLogin from "../lib/express/require-login.js";
import validate from "../lib/express/validate.js";
import PACKAGE from "../package.json" with { type: "json" };
import { compiledSchema } from "../schema/index.js";

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
	.get(validate, (req, res) => {
		compiledSchema.info.version = PACKAGE.version;
		compiledSchema.servers[0].url = `${req.protocol}://${req.host}/api`;
		res.status(200).send(
			swaggerUi.generateHTML(compiledSchema, { swaggerOptions: { supportedSubmitMethods: [] } }),
		);
	});

export default router;
