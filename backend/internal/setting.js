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
		access.canAdmin();

		const existingRow = await internalSetting.get(access, { id: data.id });

		const merged = { ...existingRow, ...data };
		if (["html", "redirect"].includes(merged.value) && !merged.meta?.[merged.value]) {
			throw new errs.ValidationError(`meta.${merged.value} is required for ${merged.value}`);
		}

		await settingModel.query().where({ id: data.id }).patch(data);

		const row = await internalSetting.get(access, {
			id: data.id,
		});

		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "setting",
			meta: row,
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
				throw new errs.ValidationError("Could not reconfigure Nginx. Please check logs.", undefined, {
					cause: err,
				});
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
		access.canAdmin();

		const row = await settingModel.query().where("id", data.id).first();
		if (!row?.id) {
			throw new errs.ItemNotFoundError(data.id);
		}

		return row;
	},

	/**
	 * All settings
	 *
	 * @param   {Access}  access
	 * @returns {Promise}
	 */
	getAll: (access) => {
		access.canAdmin();
		return settingModel.query().orderBy("description", "ASC");
	},
};

export default internalSetting;
