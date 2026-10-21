import { execFile as nodeExecFile } from "node:child_process";
import { promisify } from "node:util";
import { Liquid } from "liquidjs";
import { global as logger } from "../logger.js";
import errs from "./error.js";

const nodeExecFilePromises = promisify(nodeExecFile);

/**
 * @param   {String} cmd
 * @param   {Array}  args
 * @returns {Promise}
 */
const execFile = async (cmd, args) => {
	logger.debug(`CMD: ${cmd} ${args ? args.join(" ") : ""}`);

	try {
		const { stdout, stderr } = await nodeExecFilePromises(cmd, args);
		return `${stdout || ""}${stderr || ""}`.trim();
	} catch (err) {
		throw new errs.CommandError(`${err.stdout || ""}${err.stderr || ""}`.trim(), { cause: err });
	}
};

/**
 * @returns {Object} Liquid render engine
 */
const getRenderEngine = () => {
	const renderEngine = new Liquid({
		root: `${import.meta.dirname}/../templates/`,
	});

	/**
	 * nginxAccessRule expects the object given to have 2 properties:
	 *
	 * directive  string
	 * address    string
	 */
	renderEngine.registerFilter("nginxAccessRule", (v) => {
		if (v.directive && v.address) return `${v.directive} ${v.address};`;
		return "";
	});

	return renderEngine;
};

export default { execFile, getRenderEngine };
