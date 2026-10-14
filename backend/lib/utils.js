import { execFile as nodeExecFile } from "node:child_process";
import crypto from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { Liquid } from "liquidjs";
import { debug, global as logger } from "../logger.js";
import errs from "./error.js";

const nodeExecFilePromises = promisify(nodeExecFile);

const writeHash = async () => {
	const referencedEnvVars = new Set();
	const templateFiles = await readdir(`${import.meta.dirname}/../templates`);

	for (const fileName of templateFiles) {
		const content = await readFile(`${import.meta.dirname}/../templates/${fileName}`, "utf8");
		const matches = content.match(/env\.[A-Z0-9_]+/g) || [];

		for (const match of matches) {
			referencedEnvVars.add(match.replace("env.", ""));
		}
	}

	let hashInput = "";
	for (const varName of [...referencedEnvVars].sort()) {
		hashInput += process.env[varName] || "";
	}
	hashInput += process.env.TV;

	await writeFile("/data/npmplus/env.sha512sum", crypto.hash("sha512", hashInput));
};

/**
 * @param   {String} cmd
 * @param   {Array}  args
 * @returns {Promise}
 */
const execFile = async (cmd, args) => {
	debug(logger, `CMD: ${cmd} ${args ? args.join(" ") : ""}`);

	try {
		const { stdout, stderr } = await nodeExecFilePromises(cmd, args);
		return `${stdout || ""}${stderr || ""}`.trim();
	} catch (err) {
		if (err && typeof err === "object") {
			throw new errs.CommandError(`${err.stdout || ""}${err.stderr || ""}`.trim(), { cause: err });
		}
		throw err;
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
		if (typeof v.directive !== "undefined" && typeof v.address !== "undefined" && v.directive && v.address) {
			return `${v.directive} ${v.address};`;
		}
		return "";
	});

	return renderEngine;
};

export default { writeHash, execFile, getRenderEngine };
