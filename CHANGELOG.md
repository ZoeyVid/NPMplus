# Changelog

All notable changes to the NPMplus Security Fork are documented here. The fork uses release identifiers based on the bundled NPMplus version followed by a fork-specific sequence.

## Unreleased

### Added

- Redesigned the CrowdSec overview around a scenario attack-mix donut with a clickable legend and a per-interval activity strip that highlights the current interval.
- Added a WAF verdict card to the CrowdSec overview showing AppSec blocked requests and the pass/blocked traffic split, with click-through to the WAF tab.
- Added bouncer enforcement status to the local-bans card: decision hits served to the proxy bouncer (`cs_lapi_decisions_ok_total`) prove bans are enforced, and a bouncer that never queries CrowdSec is called out instead of failing silently.
- Added top attacker IP filters and a top attacker IP list in the attacks detail modal.

### Fixed

- Preset the OS alongside the distro when installing CrowdSec's packagecloud repository so the installer works on every supported distro; packagecloud only auto-detects when both are unset.
- Made the CrowdSec apt suite pick a published suite per distro, including a published fallback on Debian trixie, and repaired unpublished suite entries.
- Made the CrowdSec doctor explain an enrolled-but-empty CAPI pull and print the current Prometheus settings when the decision gauge is missing.
- Probed CrowdSec metrics from inside the NPMplus container and explained a missing community blocklist count instead of a bare dash.
- Refused CrowdSec key re-registration while the LAPI is unreachable so unclean state is not overwritten.
- Adopted the legacy installer bouncer safely, removed the stale bouncer backend override, and allowed the documented backup-free uninstall path.
- Removed a protected-service discovery race, stabilized the protected startup probe, and guarded public ports before Docker starts.

### Security

- Hardened public startup behind CrowdSec availability so services do not come up unprotected.

### Changed

- Restored upstream NPMplus runtime Certbot DNS-plugin installation so Cloudflare and other DNS challenges work out of the box; pinned pip and Certbot stay in the image and the pip packaging-tool scan findings are carried under a reviewed, expiring `.trivy/npmplus.yaml` baseline.

## v2.15.1-mangyan1.rc.2 - 2026-09-05

Second public release candidate of the security-focused fork.

### Fixed

- Repaired fresh Anubis honeypot file mounts and native CrowdSec conflict handling.
- Made Docker startup wait for usable DNS and corrected LAN-only administrator access through the host listener.
- Simplified private-LAN installer questions and made host-networking guidance clearer.

### Changed

- Added explicit per-host Anubis protection controls and left the global catch-all challenge off by default for API, webhook, and licensing compatibility.
- Reduced the frontend entry bundle from about 1.05 MB to 463 KB by splitting the CrowdSec attack map and importing only supported locale flags.
- Clarified version-pinned release installation before the rolling `develop` channel.

### Security

- Kept CrowdSec community protection enabled while showing remote blocklist entries only as aggregate dashboard metrics.
- Moved GoAccess executable code to administrator-protected same-origin assets, removed executable inline-script permission, and disabled caching of report data.
- Filtered documented, expiring upstream container exceptions out of open SARIF alerts without weakening the failing vulnerability gate.

See the [release notes](.github/release-notes/v2.15.1-mangyan1.rc.2.md) for installation and validation guidance.

## v2.15.1-mangyan1.rc.1 - 2026-09-04

First public release candidate of the security-focused fork.

### Added

- One-command interactive installation and maintenance for Debian and Ubuntu.
- Transactional updates with health checks, rollback snapshots, daily backups, reboot diagnostics, and CrowdSec credential repair.
- CrowdSec AppSec, firewall-bouncer, Anubis, and honeypot integrations with dashboard monitoring.
- A compact security dashboard with local alerts, local bans, attack geography, engine health, AppSec metrics, and protected manual actions.
- Fork-owned multi-architecture release images, SBOM/provenance attestations, exact-image vulnerability gates, and checksum-protected installer assets.

### Security

- Loopback-only administration and security-service listeners by default.
- Temporary administrator bootstrap secrets instead of credentials stored in Compose.
- Digest-pinned deployment images and reviewed, expiring vulnerability exceptions for unmodified upstream components.
- Hardened session, browser, API, container, and host-maintenance defaults.

### Changed

- Documentation and project website are focused on a simple reverse-proxy and security appliance workflow.
- PHP-FPM deployment is intentionally left to the proxied application stacks.

See the [release notes](.github/release-notes/v2.15.1-mangyan1.rc.1.md) for installation and validation guidance.
