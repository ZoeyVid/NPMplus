import express from "express";
import internalRemoteVersion from "../internal/remote-version.js";
import requireLogin from "../lib/express/require-login.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

/**
 * /api/version/check
 */
router
	.route("/check")
	.all(requireLogin())

	/**
	 * GET /api/version/check
	 *
	 * Check for available updates
	 */
	.get(async (_, res) => {
		res.status(200).send(await internalRemoteVersion.get());
	});

export default router;
