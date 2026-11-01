import express from "express";
import internalReport from "../internal/report.js";
import requireLogin from "../lib/express/require-login.js";
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
	.get(requireLogin(), validate, async (_, res) => {
		const data = await internalReport.getHostsReport(res.locals.access);
		res.status(200).send(data);
	});

export default router;
