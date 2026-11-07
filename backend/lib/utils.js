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

const nginxUnsafePattern = /[;{}#"'\\]|\p{Cc}/u;
const controlCharPattern = /\p{Cc}/u;
const quoteEscapePattern = /["\\]/gu;

const assertNginxValue = (value, pattern = nginxUnsafePattern) => {
	if (pattern.test(value)) {
		throw new errs.ValidationError(`${JSON.stringify(value)} can not be used in the nginx config`);
	}
	return value;
};

const nginxQuote = (value) => `"${assertNginxValue(value, controlCharPattern).replaceAll(quoteEscapePattern, "\\$&")}"`;

const quotedPattern = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gu;
const commentPattern = /#.*/u;

const reindent = (text) => {
	let depth = 0;
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
		.map((line) => {
			const code = line.replace(quotedPattern, "").replace(commentPattern, "");
			const net = code.split("{").length - code.split("}").length;
			depth += net;
			return line && "  ".repeat(Math.max(0, depth - Math.max(0, net))) + line;
		})
		.join("\n");
};

/**
 * @returns {Object} Liquid render engine
 */
const getRenderEngine = () => {
	const renderEngine = new Liquid({
		root: `${import.meta.dirname}/../templates/`,
		outputEscape: assertNginxValue,
	});

	/**
	 * nginxAccessRule expects the object given to have 2 properties:
	 *
	 * directive  string
	 * address    string
	 */
	renderEngine.registerFilter("nginxAccessRule", {
		raw: true,
		handler: (v) => {
			if (v.directive && v.address) return `${assertNginxValue(v.directive)} ${assertNginxValue(v.address)};`;
			return "";
		},
	});

	return renderEngine;
};

export default { assertNginxValue, execFile, getRenderEngine, nginxQuote, reindent };
