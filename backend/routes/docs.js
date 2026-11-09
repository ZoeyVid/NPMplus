import express from "express";
import swaggerUi from "swagger-ui-express";
import jwtdecode from "../lib/express/jwt-decode.js";
import validate from "../lib/express/validate.js";
import { compiledSchema } from "../schema/index.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router.use("/", jwtdecode, swaggerUi.serve);

router
	.route("/")

	/**
	 * GET / (Now serves the Swagger UI interface)
	 */
	.get(validate, (_, res) => {
		res.status(200).send(
			swaggerUi.generateHTML(compiledSchema, {
				customSiteTitle: "NPMplus – API",
				swaggerOptions: {
					defaultModelRendering: "model",
					filter: true,
					showCommonExtensions: true,
					displayRequestDuration: true,
					requestSnippetsEnabled: true,
					plugins: [{ components: { authorizeBtn: () => null, authorizeOperationBtn: () => null } }],
				},
			}),
		);
	});

export default router;
