# Changelog

All notable changes to the NPMplus Security Fork are documented here. The fork uses release identifiers based on the bundled NPMplus version followed by a fork-specific sequence.

## Unreleased

### Added

- Added archive discovery to the setup script so migrations no longer need timestamp typing: `--restore` without a file searches `/var/backups/npmplus`, `/tmp` (the documented scp landing spot), and the current directory for archives and lists them newest-first, and an explicit `--restore` argument accepts any filename (the layout check is the gate), a directory (newest archive inside), or an unquoted glob. `--backup` now prints the ready-to-paste `scp` command with the real archive name plus a pull variant for copying from another LAN machine. Local coverage proves the /tmp discovery, directory, glob, renamed-archive, scp-hint, and nothing-found refusal paths; the picker only offers real `npmplus-*.tar.gz` archives, never unrelated files that merely share the prefix.
- Added an on-demand backup action to the setup script (`--backup`, menu option "Create a backup now") for creating a fresh archive immediately - before a migration, after configuration changes, or whenever the newest state matters more than the daily 02:17 schedule. It runs the same helper as the daily cron and prints the new archive's path and size.
- Added a restore action to the setup script (`--restore [FILE]`, menu option "Restore a backup from an archive") that applies a daily-backup archive onto an installation: it validates the archive layout, snapshots the replaced state, restores the database, certificates, access lists, CrowdSec state, and optional Anubis policy, re-registers CrowdSec keys the LAPI rejects, and waits for the stack to become healthy. Data is restored while the current machine's Compose configuration (image digests, LAN binding, ports, admin secret) is kept, so a server migration is: fresh install on the new machine, copy an archive over, restore. The restore path is distro-agnostic, archives move freely between Debian and Ubuntu servers, and CI proves the full round trip on both distributions.
- Made the restore replay a SQLite write-ahead log carried by the archive: a WAL-mode database's live main file is stale without its `-wal`, so restoring only the main file silently dropped the newest writes. The consistent hot copy remains preferred; the live-file fallback now replays its `-wal`/`-shm` companions on the next open (found by an end-to-end local restore test against the real image).
- Redesigned the CrowdSec overview around a scenario attack-mix donut with a clickable legend and a per-interval activity strip that highlights the current interval.
- Added a WAF verdict card to the CrowdSec overview showing AppSec blocked requests and the pass/blocked traffic split, with click-through to the WAF tab.
- Added bouncer enforcement status to the local-bans card: decision hits served to the proxy bouncer (`cs_lapi_decisions_ok_total`) prove bans are enforced, and a bouncer that never queries CrowdSec is called out instead of failing silently.
- Added top attacker IP filters and a top attacker IP list in the attacks detail modal.

### Fixed

- Fixed `command not found` errors during a restore's CrowdSec key healing: the four key helpers were defined after the early `--restore` dispatch, so bash could not resolve them. They are now defined before the restore code, and smoke coverage asserts every restore-called helper is defined before the dispatch. Cross-distro restores (Debian to Ubuntu and back) were always intended and remain supported.
- Updated the pinned checksum for Docker's official installer after its upstream script changed, so fresh Debian and Ubuntu installs no longer reject the verified `get.docker.com` download.
- Fixed a bash syntax error in the on-demand backup action's freshness check: it derived the archive's timestamp from the archive path (whose dots made it a non-numeric operand), printed a scary `syntax error: operand expected` while still reporting success, and the check never actually ran. The verification now keeps find's mtime and path fields separate and fails closed on any shell error. Smoke coverage now asserts the backup output contains no shell errors so a masked failure like this cannot pass silently again.
- Fixed the CrowdSec overview attack-mix legend colliding with the neighbouring WAF and attack-map cards on narrow desktop columns: the legend now truncates long scenario names with an ellipsis inside its card, the donut shrinks instead of overflowing, and large center totals step their font size down so they never touch the label. Also resized the site-menu icons so they no longer overhang the menu titles.
- Preset the OS alongside the distro when installing CrowdSec's packagecloud repository so the installer works on every supported distro; packagecloud only auto-detects when both are unset.
- Made the CrowdSec apt suite pick a published suite per distro, including a published fallback on Debian trixie, and repaired unpublished suite entries.
- Made the CrowdSec doctor explain an enrolled-but-empty CAPI pull and print the current Prometheus settings when the decision gauge is missing.
- Probed CrowdSec metrics from inside the NPMplus container and explained a missing community blocklist count instead of a bare dash.
- Refused CrowdSec key re-registration while the LAPI is unreachable so unclean state is not overwritten.
- Adopted the legacy installer bouncer safely, removed the stale bouncer backend override, and allowed the documented backup-free uninstall path.
- Removed a protected-service discovery race, stabilized the protected startup probe, and guarded public ports before Docker starts.
- Made the daily upstream-sync workflow report merge conflicts through the job log and step summary instead of hard-failing when the repository has issues disabled, and merged the latest upstream develop while keeping the fork's dependency pins under the seven-day supply-chain policy.

### Security

- Hardened public startup behind CrowdSec availability so services do not come up unprotected.

### Changed

- Restored upstream NPMplus runtime Certbot DNS-plugin installation so Cloudflare and other DNS challenges work out of the box; pinned pip and Certbot stay in the image and the pip packaging-tool scan findings are carried under a reviewed, expiring `.trivy/npmplus.yaml` baseline.

## v2.15.1-mangyan1.rc.4 - 2026-09-05

Fourth public release candidate of the security-focused fork.

### Fixed

- Made the installer-managed LAN dashboard listener survive reboots with `FreeBind` and explicit network-online ordering, and migrated existing RC3 listeners during safe update.
- Fixed the host CrowdSec firewall-bouncer configuration rejected by current packages because its required logging mode was absent.
- Added Ubuntu firewall-bouncer service-mode support.
- Made fresh installation fail visibly when the firewall bouncer does not validate or start, instead of silently continuing without kernel-level enforcement.

### Changed

- Added a bounded systemd startup gate so the host firewall bouncer waits for the containerized CrowdSec LAPI after reboot.
- Updated Compose hardening syntax to the current `no-new-privileges=true` form and added CI coverage for both reboot defects and their upgrade repairs.
- Expanded the CrowdSec doctor and boot trace to report the LAN listener and firewall-bouncer configuration, status, and boot logs.

See the [release notes](.github/release-notes/v2.15.1-mangyan1.rc.4.md) for installation and validation guidance.

## v2.15.1-mangyan1.rc.3 - 2026-09-05

Third public release candidate of the security-focused fork.

### Fixed

- Fixed a reboot failure caused by an old NPMplus container retaining the deleted one-time administrator-password mount from `/run`.
- Made fresh installations remove bootstrap credentials safely by recreating NPMplus from the sanitized Compose configuration before deleting the temporary secret, and added automatic repair of affected existing installations during safe update.
- Made the integrated and standalone CrowdSec doctor report Docker startup failures before secondary key checks.

### Changed

- Hardened CrowdSec, Anubis, and Caddy containers with read-only root filesystems, dropped Linux capabilities, `no-new-privileges`, bounded temporary storage, and service health checks.
- Updated the custom Caddy build dependencies, disabled its administration endpoint and configuration persistence, and moved its runtime to an unprivileged user.
- Expanded CI to cover installation, Docker restart, failed-update rollback, database integrity, uninstall, clean reinstall, and another restart.

### Security

- Added release gates for the exact recommended Caddy, CrowdSec, and Anubis images on AMD64 and ARM64, plus identity-backed attestations for release assets and container images.

See the [release notes](.github/release-notes/v2.15.1-mangyan1.rc.3.md) for installation and validation guidance.

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
