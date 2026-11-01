import express from "express";
import internalAuditLog from "../internal/audit-log.js";
import idParam from "../lib/express/id-param.js";
import jwtdecode from "../lib/express/jwt-decode.js";
import validate from "../lib/express/validate.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router.param("event_id", idParam);

/**
 * /api/audit-log
 */
router
	.route("/")

	/**
	 * GET /api/audit-log
	 *
	 * Retrieve all logs
	 */
	.get(jwtdecode(), validate, async (_, res) => {
		const rows = await internalAuditLog.getAll(res.locals.access, res.locals.query);
		res.status(200).send(rows);
	});

/**
 * Specific audit log entry
 *
 * /api/audit-log/123
 */
router
	.route("/:event_id")

	/**
	 * GET /api/audit-log/123
	 *
	 * Retrieve a specific entry
	 */
	.get(jwtdecode(), validate, async (_, res) => {
		const item = await internalAuditLog.get(res.locals.access, {
			id: Number(res.locals.params.event_id),
			expand: res.locals.query.expand,
		});
		res.status(200).send(item);
	});

export default router;
