import type { AnubisStatus, CrowdsecMetrics } from "src/api/backend";

export type DashboardTab = "overview" | "activity" | "bans" | "waf" | "system";
export type KpiKind = "attacks" | "local" | "community" | "anubis";

export interface StatusPresentation {
	label: string;
	tone: "green" | "orange" | "red" | "secondary";
}

export const anubisServiceStatus = (anubis?: AnubisStatus): StatusPresentation => {
	if (!anubis) return { label: "crowdsec.status.checking", tone: "orange" };
	if (!anubis.configured) return { label: "crowdsec.anubis.service-disabled", tone: "secondary" };
	if (anubis.container.up === true) return { label: "crowdsec.anubis.container-up", tone: "green" };
	if (anubis.container.up === false) return { label: "crowdsec.anubis.container-down", tone: "red" };
	return { label: "crowdsec.status.checking", tone: "orange" };
};

export const honeypotStatus = (anubis?: AnubisStatus): StatusPresentation => {
	if (!anubis) return { label: "crowdsec.anubis.honeypot-checking", tone: "orange" };
	if (!anubis.configured || anubis.honeypot.status === "disabled")
		return { label: "crowdsec.anubis.honeypot-disabled", tone: "secondary" };
	if (anubis.container.up === false || anubis.honeypot.status === "unavailable")
		return { label: "crowdsec.anubis.honeypot-unavailable", tone: "red" };
	if (anubis.honeypot.status === "waiting") return { label: "crowdsec.anubis.honeypot-waiting", tone: "orange" };
	return { label: "crowdsec.anubis.honeypot-ready", tone: "green" };
};

export const appsecStatus = (metrics?: CrowdsecMetrics): StatusPresentation => {
	if (!metrics) return { label: "crowdsec.appsec.status-checking", tone: "orange" };
	if (metrics.appsecConfigured === false) return { label: "crowdsec.appsec.status-disabled", tone: "secondary" };
	if (metrics.appsecConfigured === true && !metrics.available)
		return { label: "crowdsec.appsec.status-monitoring-unavailable", tone: "orange" };
	if (metrics.appsecMetricsPresent) return { label: "crowdsec.appsec.status-active", tone: "green" };
	if (metrics.appsecConfigured === true) return { label: "crowdsec.appsec.status-ready", tone: "orange" };
	return { label: "crowdsec.appsec.status-unknown", tone: "secondary" };
};