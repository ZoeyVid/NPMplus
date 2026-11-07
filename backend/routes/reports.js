import express from "express";
import internalReport from "../internal/report.js";
import jwtdecode from "../lib/express/jwt-decode.js";
import validate from "../lib/express/validate.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router
	.route("/hosts")

	/**
	 * GET /reports/hosts
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const data = await internalReport.getHostsReport(res.locals.access);
		res.status(200).send(data);
	});

export default router;
