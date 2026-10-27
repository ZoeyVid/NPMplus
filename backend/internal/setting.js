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
		const status = merged.meta?.status;
		if (status !== undefined && (!Number.isInteger(status) || status < 400 || status > 599)) {
			throw new errs.ValidationError("meta.status needs to be between 400 and 599");
		}

		if (merged.id === "default-site") {
			try {
				await internalNginx.generateConfig("default", merged);
				await internalNginx.reload();
			} catch (err) {
				await internalNginx.generateConfig("default", existingRow);
				await internalNginx.reload();
				throw new errs.ValidationError("Could not reconfigure Nginx. Please check logs.", undefined, {
					cause: err,
				});
			}

			// write the html if we need to
			if (merged.value === "html") {
				await writeFile("/data/html/index.html", merged.meta.html, { encoding: "utf8" });
			}
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
