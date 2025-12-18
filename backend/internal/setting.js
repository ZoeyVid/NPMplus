import fs from "node:fs";
import errs from "../lib/error.js";
import settingModel from "../models/setting.js";
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
		const row = await internalSetting.get(access, { id: data.id });

		if (row.id !== data.id) {
			// Sanity check that something crazy hasn't happened
			throw new errs.InternalValidationError(
				`Setting could not be updated, IDs do not match: ${row.id} !== ${data.id}`,
			);
		}

		await settingModel.query().where({ id: data.id }).patch(data);
		const updatedRow = await internalSetting.get(access, {
			id: data.id,
		});

		if (updatedRow.id === "default-site") {
			// write the html if we need to
			if (updatedRow.value === "html") {
				fs.writeFileSync("/data/html/index.html", updatedRow.meta.html, { encoding: "utf8" });
			}

			// Configure nginx
			try {
				await internalNginx.deleteConfig("default");
				await internalNginx.generateConfig("default", updatedRow);
				await internalNginx.test();
				await internalNginx.reload();
			} catch (err) {
				await internalNginx.deleteConfig("default");
				await internalNginx.test();
				await internalNginx.reload();
				// I'm being slack here I know..
				throw new errs.ValidationError("Could not reconfigure Nginx. Please check logs.");
			}
		}
		return updatedRow;
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