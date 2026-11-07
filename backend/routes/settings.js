import express from "express";
import internalSetting from "../internal/setting.js";
import jwtdecode from "../lib/express/jwt-decode.js";
import validate from "../lib/express/validate.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

/**
 * /api/settings
 */
router
	.route("/")

	/**
	 * GET /api/settings
	 *
	 * Retrieve all settings
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const rows = await internalSetting.getAll(res.locals.access);
		res.status(200).send(rows);
	});

/**
 * Specific setting
 *
 * /api/settings/something
 */
router
	.route("/:setting_id")

	/**
	 * GET /settings/something
	 *
	 * Retrieve a specific setting
	 */
	.get(jwtdecode, validate, async (_, res) => {
		const row = await internalSetting.get(res.locals.access, {
			id: res.locals.params.setting_id,
		});
		res.status(200).send(row);
	})

	/**
	 * PUT /api/settings/something
	 *
	 * Update and existing setting
	 */
	.put(jwtdecode, validate, async (_, res) => {
		const result = await internalSetting.update(res.locals.access, {
			...res.locals.body,
			id: res.locals.params.setting_id,
		});
		res.status(200).send(result);
	});

export default router;
