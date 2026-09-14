import express from "express";
import internalReport from "../internal/report.js";
import requireLogin from "../lib/express/require-login.js";
import { debug, express as logger } from "../logger.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router
	.route("/hosts")
	.all(requireLogin())

	/**
	 * GET /reports/hosts
	 */
	.get(async (req, res, next) => {
		try {
			const data = await internalReport.getHostsReport(res.locals.access);
			res.status(200).send(data);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.originalUrl}: ${err}`);
			next(err);
		}
	});

export default router;
