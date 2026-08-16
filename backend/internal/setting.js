import { writeFile } from "node:fs/promises";
import errs from "../lib/error.js";
import settingModel from "../models/setting.js";
import internalAuditLog from "./audit-log.js";
import internalNginx from "./nginx.js";

const internalSetting = {
	/**
	 * @param  {Access}  access
	 * @param  {Object}  data
	 * @param  {String}  data.id
	 * @return {Promise}
	 */
	update: async (access, data) => {
		await access.can("settings:update", data.id);

		const existingRow = await internalSetting.get(access, { id: data.id });
		if (existingRow.id !== data.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`Setting could not be updated, IDs do not match: ${existingRow.id} !== ${data.id}`,
			);
		}

		await settingModel.query().where({ id: data.id }).patch(data);

		const row = await internalSetting.get(access, {
			id: data.id,
		});

		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "setting",
			meta: {
				id: row.id,
				value: row.value,
			},
		});
		if (row.id === "default-site") {
			// write the html if we need to
			if (row.value === "html") {
				await writeFile("/data/html/index.html", row.meta.html, { encoding: "utf8" });
			}

			try {
				await internalNginx.deleteConfig("default");
				await internalNginx.generateConfig("default", row);
				await internalNginx.test();
				await internalNginx.reload();
			} catch (err) {
				await internalNginx.deleteConfig("default");
				await internalNginx.test();
				await internalNginx.reload();
				throw new errs.ValidationError("Could not reconfigure Nginx. Please check logs.", err);
			}
		}
		return row;
	},

	/**
	 * @param  {Access}   access
	 * @param  {Object}   data
	 * @param  {String}   data.id
	 * @return {Promise}
	 */
	get: async (access, data) => {
		await access.can("settings:get", data.id);

		const row = await settingModel.query().where("id", data.id).first();
		if (row) {
			return row;
		}
		throw new errs.ItemNotFoundError(data.id);
	},

	/**
	 * This will only count the settings
	 *
	 * @param   {Access}  access
	 * @returns {*}
	 */
	getCount: async (access) => {
		await access.can("settings:list");

		const row = await settingModel.query().count("id as count").first();
		return Number.parseInt(row.count, 10);
	},

	/**
	 * All settings
	 *
	 * @param   {Access}  access
	 * @returns {Promise}
	 */
	getAll: async (access) => {
		await access.can("settings:list");
		return settingModel.query().orderBy("description", "ASC");
	},
};

export default internalSetting;
