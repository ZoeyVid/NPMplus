// Browser-level CrowdSec dashboard smoke test with intercepted API fixtures.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "cmd.exe" : "npm";
const npmArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm root -g"] : ["root", "-g"];
const globalRoot = process.env.PLAYWRIGHT_ROOT ?? execFileSync(npmCommand, npmArgs).toString().trim();
const playwrightEntry = path.join(globalRoot, "playwright", "index.mjs");
if (!existsSync(playwrightEntry)) {
	console.error("playwright is not installed globally. Install it with: npm i -g playwright");
	process.exit(1);
}
const { chromium } = await import(`file://${playwrightEntry.replace(/\\/g, "/")}`);

const iso = (ms) => new Date(Date.now() + ms).toISOString();
const decisions = [
	{
		id: 4,
		uuid: "d4",
		scope: "Ip",
		value: "203.0.113.9",
		type: "ban",
		origin: "cscli",
		scenario: "anubis-honeypot",
		duration: "24h",
		until: iso(3 * 86400 * 1000),
		simulated: false,
	},
	{
		id: 3,
		uuid: "d3",
		scope: "Ip",
		value: "198.51.100.7",
		type: "ban",
		origin: "crowdsec",
		scenario: "crowdsecurity/http-probing",
		duration: "4h",
		until: iso(2 * 3600 * 1000),
		simulated: false,
	},
	{
		id: 2,
		uuid: "d2",
		scope: "Ip",
		value: "192.0.2.55",
		type: "ban",
		origin: "capi",
		scenario: "crowdsecurity/ssh-bf",
		duration: "1h",
		until: iso(45 * 1000),
		simulated: false,
	},
	{
		id: 1,
		uuid: "d1",
		scope: "Ip",
		value: "192.0.2.10",
		type: "ban",
		origin: "cscli",
		scenario: "manual",
		duration: "1h",
		until: iso(-3600 * 1000),
		simulated: true,
	},
];
const alerts = [
	{
		id: 99,
		message: "http-probing from 198.51.100.7",
		scenario: "crowdsecurity/http-probing",
		createdAt: iso(-3600 * 1000),
		startAt: iso(-3600 * 1000),
		stopAt: iso(-3500 * 1000),
		machineId: "npmplus",
		simulated: false,
		eventsCount: 6,
		source: {
			ip: "198.51.100.7",
			scope: "Ip",
			value: "198.51.100.7",
			country: "DE",
			asNumber: "64496",
			asName: "Example ASN",
			range: "198.51.100.0/24",
			rdns: "host.example.com",
			latitude: 51.16,
			longitude: 10.45,
		},
		events: [
			{
				timestamp: iso(-3600 * 1000),
				meta: [
					{ key: "source_ip", value: "198.51.100.7" },
					{ key: "method", value: "GET" },
					{ key: "target_uri", value: "/.env" },
				],
			},
		],
	},
];
const user = {
	id: 1,
	createdOn: iso(-86400 * 1000),
	modifiedOn: iso(-3600 * 1000),
	isDisabled: false,
	email: "admin@example.com",
	name: "Smoke Admin",
	nickname: "",
	avatar: "",
	roles: ["admin"],
	permissions: { visibility: "enabled", roles: ["admin"] },
};
const proxyHosts = [
	{
		id: 7,
		createdOn: iso(-86400 * 1000),
		owner: user,
		domainNames: ["browser.example.test"],
		forwardScheme: "http",
		forwardHost: "browser-app",
		forwardPort: 8080,
		certificate: null,
		accessLists: [],
		npmplusAccessListType: "public",
		npmplusAuthRequest: "anubis",
		locations: [],
		enabled: true,
		meta: { nginxOnline: true, nginxErr: null },
	},
];

let failures = 0;
let appsecConfigured = true;
const check = (name, ok, detail = "") => {
	if (!ok) failures++;
	console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` -> ${detail}`}`);
};

const api = async (route) => {
	const request = route.request();
	const url = new URL(request.url());
	if (url.pathname.startsWith("/src/")) return route.continue();
	const apiPath = url.pathname.replace(/^\/api/, "");
	const respond = (data) =>
		route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });

	if (apiPath === "/" && request.method() === "GET")
		return respond({ status: "OK", setup: true, password: false, oidc: false });
	if (apiPath === "/tokens") return respond({ expires: iso(86400 * 1000) });
	if (apiPath === "/users/me") return respond(user);
	if (apiPath === "/users") return respond([user]);
	if (apiPath === "/nginx/proxy-hosts") return respond(proxyHosts);
	if (apiPath === "/crowdsec/decisions/delete" && request.method() === "POST") {
		const id = request.postDataJSON()?.id;
		const index = decisions.findIndex((decision) => decision.id === id);
		if (index >= 0) decisions.splice(index, 1);
		return respond({ nbDeleted: "1", auditLogged: true });
	}
	if (apiPath === "/crowdsec/decisions" && request.method() === "POST") {
		const ban = request.postDataJSON();
		decisions.unshift({
			id: 100,
			uuid: "manual-100",
			scope: "Ip",
			value: ban.value,
			type: ban.type,
			origin: "cscli",
			scenario: "manual/web-ui",
			duration: ban.duration,
			until: iso(86400 * 1000),
			simulated: false,
		});
		return respond({ created: true, auditLogged: true });
	}
	if (apiPath === "/crowdsec/decisions") {
		const local = decisions.filter((decision) => ["crowdsec", "cscli", "cscli-import"].includes(decision.origin));
		const search = (url.searchParams.get("search") || "").toLocaleLowerCase();
		const filtered = local.filter(
			(decision) => !search || JSON.stringify(decision).toLocaleLowerCase().includes(search),
		);
		const page = Number(url.searchParams.get("page") || "1");
		const pageSize = Number(url.searchParams.get("page_size") || "25");
		const start = (page - 1) * pageSize;
		return respond({
			items: filtered.slice(start, start + pageSize),
			limit: 500,
			truncated: false,
			page,
			pageSize,
			hasNext: filtered.length > start + pageSize,
			matched: Math.min(filtered.length, start + pageSize),
		});
	}
	if (apiPath === "/crowdsec/insights")
		return respond({
			windowHours: 24,
			alertCount: 7,
			activeDecisions: 3,
			localActiveDecisions: 3,
			sampled: false,
			activity: Array.from({ length: 24 }, (_, index) => ({
				start: iso((index - 23) * 3600 * 1000),
				count: index === 23 ? 7 : index % 5,
			})),
			locations: [
				{ latitude: 51.16, longitude: 10.45, country: "DE", count: 5 },
				{ latitude: 37.09, longitude: -95.71, country: "US", count: 3 },
				{ latitude: 1.35, longitude: 103.82, country: "SG", count: 2 },
			],
			signals: [{ id: "bans-3", severity: "info", type: "active-bans", count: 3 }],
			topScenarios: [{ name: "crowdsecurity/http-probing", count: 4 }],
			topCountries: [
				{ name: "DE", count: 5 },
				{ name: "US", count: 3 },
				{ name: "SG", count: 2 },
			],
			topAsns: [{ name: "Example Telecommunications and Hosting Provider ASN", count: 7 }],
			topIps: [{ name: "203.0.113.9", count: 4 }],
			topTargets: [{ name: "very-long-subdomain-for-responsive-testing.example.internal/.env", count: 4 }],
		});
	if (apiPath === "/crowdsec/history/alerts")
		return respond({
			items: alerts,
			page: 1,
			pageSize: 25,
			hasNext: false,
			matched: 1,
			windowHours: 24,
			truncated: false,
		});
	if (apiPath === "/crowdsec/metrics")
		return respond({
			available: true,
			appsecConfigured,
			appsecFailureAction: "passthrough",
			appsecDropUnreadableBody: false,
			appsecMetricsPresent: appsecConfigured,
			activeDecisions: 42103,
			localActiveDecisions: 3,
			communityActiveDecisions: 42100,
			decisionOrigins: [
				{ name: "capi", count: 42000 },
				{ name: "lists", count: 100 },
				{ name: "cscli", count: 2 },
				{ name: "crowdsec", count: 1 },
			],
			alerts: 7,
			appsecRequests: 12,
			appsecBlocked: 3,
			appsecPassed: 9,
			appsecBlockRate: 0.25,
			bouncerRequests: 20,
			bouncerDecisionHits: 12,
			machineRequests: 8,
			parserHits: 10,
			parserSuccessRate: 0.9,
			whitelistHits: 1,
			averageLapiMs: 500,
			averageParsingMs: 2,
		});
	if (apiPath === "/crowdsec/anubis")
		return respond({
			configured: true,
			honeypot: {
				status: "ready",
				decisionsAvailable: true,
				activeCount: 1,
				truncated: false,
				items: decisions.filter((decision) => decision.scenario === "anubis-honeypot"),
			},
			container: { up: true, error: null },
			recent: ["203.0.113.9"],
		});
	if (apiPath === "/crowdsec/alerts")
		return respond(alerts.filter((alert) => url.searchParams.get("value") === alert.source.ip));
	console.log(`  [fixture default] ${request.method()} ${request.url()} (path=${apiPath})`);
	return respond([]);
};

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const browserErrors = [];
page.on("console", (message) => {
	if (message.type() !== "error") return;
	browserErrors.push(message.text());
	console.log(`  [console error] ${message.text().slice(0, 160)}`);
});
page.on("pageerror", (error) => {
	browserErrors.push(String(error));
	console.log(`  [page error] ${String(error).slice(0, 160)}`);
});
await page.route("**/api/**", (route) => api(route));
await page.addInitScript((expires) => localStorage.setItem("auth", expires), iso(86400 * 1000));
await page.goto("http://localhost:5173/crowdsec", { waitUntil: "networkidle" });

await page.getByRole("heading", { name: "Security overview" }).waitFor({ timeout: 15000 });
check("security dashboard has one sticky toolbar", (await page.locator(".sticky-top").count()) === 1);
check("dashboard exposes five focused tabs", (await page.getByRole("tab").count()) === 5);
check("dashboard header reports AppSec state", (await page.getByText("AppSec active", { exact: true }).count()) >= 1);
check(
	"honeypot status distinguishes log readiness from active bans",
	(await page.getByText("Honeypot logging ready", { exact: true }).count()) >= 1,
);
check("manual action is named clearly", (await page.getByRole("button", { name: "Add IP ban" }).count()) === 1);
const dashboardButtonLabels = await page
	.locator("button")
	.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") || button.textContent?.trim()));
check(
	"browser alert control communicates its current state",
	(await page.getByRole("button", { name: /Browser alerts (off|unavailable|blocked)/ }).count()) === 1,
	JSON.stringify(dashboardButtonLabels),
);
check(
	"dashboard header uses the animated hexagon mark",
	(await page
		.getByRole("heading", { name: "Security overview" })
		.locator('img[src="/images/crowdsec-logo-animated.svg"]')
		.count()) === 1,
);

const overviewTab = page.getByRole("tab", { name: "Overview" });
await overviewTab.focus();
await overviewTab.press("ArrowRight");
check(
	"dashboard tabs support arrow-key navigation",
	(await page.getByRole("tab", { name: "Attack activity" }).getAttribute("aria-selected")) === "true",
);
await overviewTab.click();
check(
	"attack map uses geographic land shapes",
	(await page.locator('svg[aria-label*="plotted across"] path[class*="worldLand"]').count()) === 2 &&
		(await page.locator('svg[aria-label*="plotted across"] path[class*="worldLand"]').last().getAttribute("d"))
			?.length > 30_000,
);
check("attack map renders animated origin markers", (await page.locator('[class*="meteor"]').count()) >= 3);
check(
	"attack map identifies the data as observed origins",
	(await page.getByText("Observed origins", { exact: true }).count()) === 1,
);
await page.emulateMedia({ reducedMotion: "reduce" });
check(
	"attack-map motion respects reduced-motion preferences",
	(await page.locator('[class*="mapScan"]').evaluate((element) => getComputedStyle(element).animationName)) ===
		"none",
);
await page.emulateMedia({ reducedMotion: "no-preference" });

await page.getByRole("button", { name: /Community blocklist entries/i }).click();
const communityModal = page.getByRole("dialog");
const communityText = await communityModal.innerText();
check(
	"community KPI opens aggregate details",
	communityText.includes("42,100") || communityText.includes("42100"),
	communityText,
);
check(
	"community modal explains enforcement remains active",
	/still downloaded and enforced/i.test(communityText),
	communityText,
);
check(
	"community modal has no CAPI IPs or unban action",
	!communityText.includes("192.0.2.55") && !/Unban/i.test(communityText),
	communityText,
);
await communityModal.getByRole("button", { name: /close/i }).first().click();

await page.getByRole("tab", { name: "Active bans" }).click();
const localTable = page.locator("#crowdsec-active-bans tbody");
await localTable.locator("tr").first().waitFor();
const localText = await localTable.innerText();
check(
	"active bans lists only this instance",
	localText.includes("203.0.113.9") && localText.includes("198.51.100.7"),
	localText,
);
check(
	"CAPI decision is hidden from the local table",
	!localText.includes("192.0.2.55") && !localText.includes("capi"),
	localText,
);
check(
	"unban actions exist only for local rows",
	(await localTable.getByRole("button", { name: /Unban/i }).count()) === 3,
);

await page.getByRole("tab", { name: "Overview" }).click();
await page.getByRole("button", { name: /Honeypot bans/i }).click();
const anubisModal = page.getByRole("dialog");
const anubisText = await anubisModal.innerText();
check(
	"Anubis KPI opens health and catch details",
	anubisText.includes("Anubis is up") && anubisText.includes("203.0.113.9"),
	anubisText,
);
await anubisModal.getByRole("button", { name: /close/i }).first().click();

await page.getByRole("tab", { name: "WAF" }).click();
const wafText = await page.locator("#crowdsec-tab-panel").innerText();
check(
	"WAF tab shows protection state and traffic outcomes",
	/web application firewall/i.test(wafText) &&
		/inspected requests/i.test(wafText) &&
		wafText.includes("25.0%") &&
		/false positives and compatibility/i.test(wafText),
	wafText.slice(0, 500),
);
check(
	"WAF traffic visualization has an accessible summary",
	(await page.getByRole("img", { name: /AppSec inspected 12 requests/i }).count()) === 1,
);
await page.screenshot({ path: ".smoke/ui-security-dashboard-waf.png", fullPage: true });

appsecConfigured = false;
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("tab", { name: "WAF" }).click();
const disabledWafText = await page.locator("#crowdsec-tab-panel").innerText();
check(
	"WAF tab distinguishes globally disabled AppSec",
	/appsec disabled/i.test(disabledWafText) && disabledWafText.includes("--update --enable-appsec"),
	disabledWafText.slice(0, 300),
);
appsecConfigured = true;
await page.reload({ waitUntil: "networkidle" });

await page.getByRole("tab", { name: "System" }).click();
const systemText = await page.locator("body").innerText();
check(
	"technical metrics moved to the System tab",
	/parser success/i.test(systemText) && systemText.includes("500.0 ms"),
	systemText.slice(0, 300),
);
check(
	"system metrics are informational cards rather than misleading buttons",
	(await page.getByRole("button", { name: /Parser success/i }).count()) === 0,
);

await page.getByRole("tab", { name: "Attack activity" }).click();
await page.locator("#crowdsec-alert-history tbody tr").first().waitFor();
const attackRows = await page.locator("#crowdsec-alert-history tbody tr").count();
check("attack history lives inside the dashboard", attackRows === 1, `${attackRows} rows`);

await page.getByRole("tab", { name: "Overview" }).click();
await page.screenshot({ path: ".smoke/ui-security-dashboard.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
check(
	"security dashboard fits a narrow viewport",
	await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
);
const narrowTabLayout = await page.getByRole("tab").evaluateAll((tabs) => {
	const boxes = tabs.map((tab) => tab.getBoundingClientRect());
	return {
		rows: new Set(boxes.map((box) => Math.round(box.top))).size,
		allVisible: boxes.every((box) => box.left >= 0 && box.right <= window.innerWidth && box.height >= 44),
	};
});
check(
	"all five tabs form three unclipped rows on mobile",
	narrowTabLayout.rows === 3 && narrowTabLayout.allVisible,
	JSON.stringify(narrowTabLayout),
);
await page.getByRole("tab", { name: "WAF" }).click();
check(
	"WAF monitoring fits a narrow viewport",
	await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
);
await page.screenshot({ path: ".smoke/ui-security-dashboard-waf-mobile.png", fullPage: true });
await page.getByRole("tab", { name: "Overview" }).click();
await page.screenshot({ path: ".smoke/ui-security-dashboard-mobile.png", fullPage: true });
await page.setViewportSize({ width: 320, height: 720 });
check(
	"security dashboard and tabs fit a 320px viewport",
	await page.evaluate(() => {
		const tabs = [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.getBoundingClientRect());
		return (
			document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
			tabs.every((box) => box.left >= 0 && box.right <= window.innerWidth && box.height >= 44)
		);
	}),
);
check(
	"the manual-ban control does not clip at 320px",
	await page
		.getByRole("button", { name: "Add IP ban" })
		.evaluate((button) => button.scrollWidth <= button.clientWidth),
);
await page.screenshot({ path: ".smoke/ui-security-dashboard-320.png", fullPage: true });

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("http://localhost:5173/nginx/proxy", { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Proxy Hosts", exact: true }).waitFor();
check("proxy-host list shows when Anubis is enabled", (await page.getByText("Anubis enabled").count()) === 1);
await page.getByRole("button", { name: "Add Proxy Host" }).click();
const proxyModal = page.getByRole("dialog");
const appsecToggle = proxyModal.getByRole("checkbox", { name: /CrowdSec AppSec protection/i });
check("new proxy hosts enable their AppSec preference by default", await appsecToggle.isChecked());
const authRequest = proxyModal.getByLabel(/Authentication \/ Bot Protection/i);
check("new proxy hosts leave Anubis off by default", (await authRequest.inputValue()) === "none");
await authRequest.selectOption("anubis");
check("Anubis can be selected per proxy host", (await authRequest.inputValue()) === "anubis");
check(
	"Anubis guidance distinguishes browser sites from APIs",
	(await proxyModal.getByText(/Leave it off for APIs, webhooks, and licensing services/).count()) === 1,
);
await page.screenshot({ path: ".smoke/ui-proxy-host-protection.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await authRequest.scrollIntoViewIfNeeded();
check(
	"proxy-host protection control fits a narrow viewport",
	await proxyModal.evaluate((dialog) => {
		const box = dialog.getBoundingClientRect();
		return box.left >= 0 && box.right <= window.innerWidth && dialog.scrollWidth <= dialog.clientWidth;
	}),
);
await page.screenshot({ path: ".smoke/ui-proxy-host-protection-mobile.png", fullPage: true });
await appsecToggle.uncheck();
check("proxy-host AppSec protection can be turned off", !(await appsecToggle.isChecked()));
await proxyModal.getByRole("button", { name: /close/i }).click();
check("changed dashboard and host flows have no browser errors", browserErrors.length === 0, browserErrors.join(" | "));
console.log(failures === 0 ? "ALL UI SMOKE CHECKS PASSED" : `${failures} FAILURES`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
