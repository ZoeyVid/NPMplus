#!/usr/bin/env node

// This file does a few things to ensure that the Locales are present and valid:
// - Ensures that the name of the locale exists in the language list
// - Ensures that each locale contains the translations used in the application
// - Ensures that there are no unused translations in the locale files

const allLocales = [
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
	["vi", "vi-VN"],
	["zh", "zh-CN"],
];

const ignoreUnused = [/^.*$/];

const { spawnSync } = require("node:child_process");

const tmp = require("tmp");

// get all translations used in frontend code
const tmpobj = tmp.fileSync({ postfix: ".json" });
const extract = spawnSync("pnpm", ["formatjs", "extract", "src/**/*.tsx", "--out-file", tmpobj.name]);

if (extract.error || extract.status !== 0) {
	console.log("\x1b[31m%s\x1b[0m", extract.error ?? extract.stderr.toString().trim());
	process.exit(1);
}

const allLocalesInProject = require(tmpobj.name);

// get list og language names and locales
const langList = require("./src/locale/src/lang-list.json");

// store a list of all validation errors
const allErrors = [];
const allWarnings = [];
const allKeys = new Set();

const checkLangList = (fullCode) => {
	const key = `locale-${fullCode}`;
	if (langList[key] === undefined) allErrors.push(`ERROR: \`${key}\` language does not exist in lang-list.json`);
};

const compareLocale = (locale) => {
	// Check that locale contains the items used in the codebase
	Object.keys(allLocalesInProject).forEach((key) => {
		if (locale.data[key] === undefined) allErrors.push(`ERROR: \`${locale[0]}\` does not contain item: \`${key}\``);
	});
	// Check that locale does not contain items not used in the codebase
	Object.keys(locale.data).forEach((key) => {
		if (!ignoreUnused.some((regex) => regex.test(key)) && allLocalesInProject[key] === undefined) {
			allErrors.push(`ERROR: \`${locale[0]}\` contains unused item: \`${key}\``);
		}

		// Add this key to allKeys
		allKeys.add(key);
	});
};

// Checks for any keys missing from this locale, that
// have been defined in any other locales
const checkForMissing = (locale) => {
	allKeys.forEach((key) => {
		if (locale.data[key] === undefined)
			allWarnings.push(`WARN: \`${locale[0]}\` does not contain item: \`${key}\``);
	});
};

// Local all locale data
allLocales.forEach((locale) => {
	checkLangList(locale[1]);
	locale.data = require(`./src/locale/src/${locale[0]}.json`);
});

// Verify all locale data
allLocales.forEach(compareLocale);
allLocales.forEach(checkForMissing);

allErrors.forEach((err) => {
	console.log("\x1b[31m%s\x1b[0m", err);
});
allWarnings.forEach((warn) => {
	console.log("\x1b[33m%s\x1b[0m", warn);
});

if (allErrors.length) process.exit(1);

console.log("\x1b[32m%s\x1b[0m", "Locale check passed");
process.exit(0);
