import type { CrowdsecDecision } from "src/api/backend";

export type CrowdsecOriginFilter = "all" | "local" | "community";

export type CrowdsecSortKey = "id" | "origin" | "scenario" | "target" | "type";
export type CrowdsecSortDirection = "asc" | "desc";

// origins that identify decisions this instance produced or triggered itself:
// "crowdsec" = detected by the local agent from local logs, "cscli" = manual
// bans and the anubis-honeypot bridge. everything else ("CAPI", "lists", ...)
// comes from CrowdSec central or subscribed blocklists.
export const LOCAL_ORIGINS = ["crowdsec", "cscli"];

export const decisionTarget = (decision: CrowdsecDecision) =>
	decision.scope === "Ip" || !decision.scope ? decision.value : `${decision.scope}: ${decision.value}`;

// structured search tokens (key:value) narrow the field they name, the
// remaining words stay a free-text contains match over all fields.
// examples: "origin:crowdsec ssh" or "type:ban 192.0.2."
const FIELD_TOKEN_RE = /^(origin|scenario|type|ip|scope):(.*)$/;
const WHITESPACE_RE = /\s+/;
const QUOTE_RE = /^["']|["']$/g;

export const filterCrowdsecDecisions = (
	decisions: CrowdsecDecision[],
	search: string,
	origin: CrowdsecOriginFilter = "all",
) => {
	let matches = decisions;
	if (origin === "local") matches = matches.filter((decision) => LOCAL_ORIGINS.includes(decision.origin));
	if (origin === "community") matches = matches.filter((decision) => !LOCAL_ORIGINS.includes(decision.origin));

	const tokens = search.trim().toLocaleLowerCase().split(WHITESPACE_RE).filter(Boolean);
	if (tokens.length === 0) return matches;

	const fieldFilters: { field: string; needle: string }[] = [];
	const words: string[] = [];
	for (const token of tokens) {
		const fieldMatch = FIELD_TOKEN_RE.exec(token);
		if (fieldMatch) {
			const needle = fieldMatch[2].replace(QUOTE_RE, "");
			if (needle) fieldFilters.push({ field: fieldMatch[1], needle });
		} else {
			words.push(token);
		}
	}

	return matches.filter((decision) => {
		for (const { field, needle } of fieldFilters) {
			let haystack: string;
			switch (field) {
				case "ip":
					haystack = decision.value;
					break;
				case "scope":
					haystack = decision.scope;
					break;
				default:
					haystack = decision[field as "origin" | "scenario" | "type"] ?? "";
			}
			if (!haystack.toLocaleLowerCase().includes(needle)) return false;
		}
		if (words.length === 0) return true;
		return [decisionTarget(decision), decision.scenario, decision.origin, decision.type].some((fieldValue) =>
			words.some((word) => fieldValue.toLocaleLowerCase().includes(word)),
		);
	});
};

export interface AttackMixSegment {
	// empty name marks the residual "other" slice covering alerts not in the top list
	name: string;
	count: number;
	share: number;
	// palette index; -1 marks the residual slice rendered in secondary grey
	color: number;
}

// donut segments from the top-scenario counts; alerts not covered by the top
// list collapse into a residual "other" slice so the shares always sum to 1
export const attackMixSegments = (items: { name: string; count: number }[], total: number): AttackMixSegment[] => {
	if (total <= 0) return [];
	const segments = items
		.filter((item) => item.name && item.count > 0)
		.map((item, index) => ({ name: item.name, count: item.count, share: item.count / total, color: index }));
	const named = segments.reduce((sum, item) => sum + item.count, 0);
	const other = total - named;
	if (other > 0) segments.push({ name: "", count: other, share: other / total, color: -1 });
	return segments;
};

export const sortCrowdsecDecisions = (
	decisions: CrowdsecDecision[],
	key: CrowdsecSortKey,
	direction: CrowdsecSortDirection,
) => {
	const factor = direction === "asc" ? 1 : -1;
	return [...decisions].sort((a, b) => {
		if (key === "id") return (a.id - b.id) * factor;

		const value = (decision: CrowdsecDecision) => {
			switch (key) {
				case "target":
					return decisionTarget(decision);
				case "scenario":
					return decision.scenario;
				case "origin":
					return decision.origin;
				case "type":
					return decision.type;
				default:
					return "";
			}
		};

		const compared = value(a).localeCompare(value(b), undefined, { numeric: true, sensitivity: "base" });
		return (compared || a.id - b.id) * factor;
	});
};
