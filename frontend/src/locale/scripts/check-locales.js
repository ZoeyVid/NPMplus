#!/usr/bin/env node

// This file does a few things to ensure that the Locales are present and valid:
// - Ensures that the name of the locale exists in the language list
// - Ensures that each locale contains the translations defined in any other locale

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const localeDir = join(dirname(fileURLToPath(import.meta.url)), "src/locale");

if (!existsSync(join(localeDir, "lang"))) {
	console.log(
		"\x1b[31m%s\x1b[0m",
		"ERROR: `src/locale/lang` does not exist, run `pnpm formatjs compile-folder src/locale/src src/locale/lang` first",
	);
	process.exit(1);
}

const readJson = (file) => JSON.parse(readFileSync(join(localeDir, file), "utf8"));

// Local all locale data
const locales = [
	["en", "en-US"],
	["bg", "bg-BG"],
	["cs", "cs-CZ"],
	["de", "de-DE"],
	["es", "es-ES"],
	["et", "et-EE"],
	["fr", "fr-FR"],
	["ga", "ga-IE"],
	["hu", "hu-HU"],
	["id", "id-ID"],
	["it", "it-IT"],
	["ja", "ja-JP"],
	["ko", "ko-KR"],
	["nl", "nl-NL"],
	["no", "no-NO"],
	["pl", "pl-PL"],
	["pt", "pt-PT"],
	["ru", "ru-RU"],
	["sk", "sk-SK"],
	["tr", "tr-TR"],
	["uk", "uk-UA"],
	["vi", "vi-VN"],
	["zh", "zh-CN"],
].map(([code, fullCode]) => ({ code, fullCode, data: readJson(`src/${code}.json`) }));

// get list og language names and locales
const langList = readJson("src/lang-list.json");

const allKeys = new Set(locales.flatMap(({ data }) => Object.keys(data)));

// store a list of all validation errors
const allErrors = [];
const allWarnings = [];

// Verify all locale data
for (const { code, fullCode, data } of locales) {
	if (langList[`locale-${fullCode}`] === undefined)
		allErrors.push(`ERROR: \`locale-${fullCode}\` language does not exist in lang-list.json`);
	// Checks for any keys missing from this locale, that
	// have been defined in any other locales
	for (const key of allKeys) {
		if (data[key] === undefined) allWarnings.push(`WARN: \`${code}\` does not contain item: \`${key}\``);
	}
}

for (const error of allErrors) console.log("\x1b[31m%s\x1b[0m", error);
for (const warning of allWarnings) console.log("\x1b[33m%s\x1b[0m", warning);

if (allErrors.length) process.exit(1);

console.log("\x1b[32m%s\x1b[0m", "Locale check passed");
