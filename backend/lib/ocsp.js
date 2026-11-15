#!/usr/bin/env node

import { X509Certificate } from "node:crypto";
import { readdir, readFile, rename, rm } from "node:fs/promises";
import utils from "./utils.js";

const goodStatusPattern = /: good\n\s*This Update: (?<thisUpdate>.+)\n\s*Next Update: (?<nextUpdate>.+)/u;

const updateLineage = async (dir, force) => {
	const cert = `${dir}/cert.pem`;
	const chain = `${dir}/chain.pem`;
	const staple = `${dir}.der`;
	const ocsp = ["ocsp", "-no_nonce", "-issuer", chain, "-cert", cert, "-verify_other", chain];

	if (!force) {
		try {
			const status = await utils.execFile("openssl", [...ocsp, "-respin", staple], true);
			const { thisUpdate, nextUpdate } = goodStatusPattern.exec(status).groups;
			if (Date.now() < (Date.parse(thisUpdate) + Date.parse(nextUpdate)) / 2) return "valid staple file on disk";
		} catch {}
	}

	const leaf = new X509Certificate(await readFile(cert));
	if (leaf.validToDate < new Date()) throw new Error("certificate expired");
	const url = leaf.toLegacyObject().infoAccess?.["OCSP - URI"]?.[0];
	if (!url) throw new Error("certificate contains no OCSP URL");

	try {
		const status = await utils.execFile("openssl", [...ocsp, "-url", url, "-respout", `${staple}.tmp`], true);
		if (!goodStatusPattern.test(status)) throw new Error(status);
		await rename(`${staple}.tmp`, staple);
		return "updated";
	} finally {
		await rm(`${staple}.tmp`, { force: true });
	}
};

const updateOcspStaples = async (directory, force) => {
	try {
		return Object.fromEntries(
			await Promise.all(
				(await readdir(directory, { withFileTypes: true }))
					.filter((entry) => entry.isDirectory())
					.map(async ({ name }) => {
						try {
							return [name, await updateLineage(`${directory}/${name}`, force)];
						} catch (err) {
							return [name, `failed: ${err.message}`];
						}
					}),
			),
		);
	} catch {
		return {};
	}
};

if (import.meta.main) console.table(await updateOcspStaples(process.argv[2], true));

export default updateOcspStaples;
