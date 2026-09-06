# NPMplus Security Fork — maintained by mangyan1

NPMplus gives you a web dashboard for publishing services securely through Nginx. This security-focused fork is maintained by [mangyan1](https://github.com/mangyan1) and adds a guided server installer, CrowdSec protection, automatic backups, safe updates with rollback, and additional security fixes.

It is based on [ZoeyVid/NPMplus](https://github.com/ZoeyVid/NPMplus) and the original [Nginx Proxy Manager](https://github.com/NginxProxyManager/nginx-proxy-manager).

[Project website](https://mangyan1.github.io/NPMplus/) · [Install NPMplus](#new-installation) · [See the main features](#main-features) · [Releases](https://github.com/mangyan1/NPMplus/releases)

The current versioned build is **v2.15.1-mangyan1.rc.4**. It is a release candidate for test servers; no stable fork release has been published yet. Every versioned release includes a pinned installer and SHA-256 checksum on the [Releases page](https://github.com/mangyan1/NPMplus/releases).

## Before you start

You need:

- A Debian 12/13 or Ubuntu 22.04+ server.
- A user account that can run `sudo`.
- An AMD64-v2 or ARM64 server.
- Ports `80/tcp`, `443/tcp`, and `443/udp` available for your websites.
- A domain pointed to your server when you are ready to publish a website.

The installer can install Docker if it is missing. It asks before making important changes.

## New installation

For the current release candidate, copy this entire command, paste it into a **test server** terminal, and press Enter:

```bash
wget -qO setup-npmplus.sh https://github.com/mangyan1/NPMplus/releases/download/v2.15.1-mangyan1.rc.4/setup-npmplus.sh &&
wget -qO setup-npmplus.sh.sha256 https://github.com/mangyan1/NPMplus/releases/download/v2.15.1-mangyan1.rc.4/setup-npmplus.sh.sha256 &&
sha256sum -c setup-npmplus.sh.sha256 &&
sudo bash setup-npmplus.sh
```

This command installs the named version instead of silently following later changes. Advanced testers who deliberately want the newest rolling development build can use the [develop installer](https://raw.githubusercontent.com/mangyan1/NPMplus/develop/setup-npmplus.sh).

Select **Install NPMplus**, then answer the questions shown by the installer. If you are unsure, press Enter to accept the displayed default. The recommended defaults enable CrowdSec, CrowdSec AppSec web-application protection, the firewall bouncer, and Anubis. Anubis's global catch-all challenge defaults off so APIs, licensing servers, webhooks, monitors, and other non-browser clients continue to work. AppSec can still be turned off for an individual proxy host if an application has a confirmed compatibility problem.

RC4 remains unchanged while it is tested on real websites. The rolling `develop` installer adds post-RC4 boot hardening: a pre-Docker packet guard blocks external ports 80/443 until verified CrowdSec host/Docker-forwarding rules and healthy public services are ready. A deliberately optional Cloudflare origin lock can also reject direct public traffic while preserving private-LAN access.

After installation, one short local command opens the maintenance menu for safe updates, CrowdSec checks, reboot diagnostics, reconfiguration, and uninstalling. You do not need to memorize a different command for each task.

For the easiest first login, provide an administrator email and password when the installer asks. The password is handled as a temporary secret and is not saved in `compose.yaml`.

## Open the dashboard

The dashboard uses HTTPS on port 81. New installations publish this port only on the server's loopback interface (`127.0.0.1:81`), so it is not reachable directly from the internet.

On the server itself, the dashboard is at:

<https://localhost:81>

From your own computer, open a terminal and run:

```bash
ssh -L 8181:127.0.0.1:81 YOUR_USER@YOUR_SERVER_IP
```

`127.0.0.1` is where port 81 listens on the server (do not use `localhost` here: the published port is IPv4-only, so a name that resolves to IPv6 fails). `8181` is the local port on your computer. Leave that terminal open and visit:

<https://localhost:8181>

Your browser may show a certificate warning because the local dashboard certificate is self-signed.

If you allow private-LAN dashboard access, the installer automatically detects and displays the VM's private address and permitted private subnet. Docker's port remains private on loopback; a small host listener makes it available at the private address through a subnet-limited UFW rule. You can then visit `https://VM_LAN_IP:81` from that LAN. Do not forward port 81 on your router.

If you did not provide an administrator email and password during installation, get the one-time setup token from the server:

```bash
sudo docker exec npmplus cat /data/npmplus/setup-token
```

Enter that token in the setup page. It is removed after the first administrator is created.

## Maintain or troubleshoot NPMplus

After installation, reopen the matching maintenance menu with one short command:

```bash
sudo /opt/npmplus/setup-npmplus.sh
```

To move to a newer release later, use the installation command shown on that release's page. A `develop` installation should download the current [develop installer](https://raw.githubusercontent.com/mangyan1/NPMplus/develop/setup-npmplus.sh) before maintenance so it receives the latest host-management logic.

Choose the action you need from the numbered menu:

- **Safe update** creates a snapshot, installs the new images, checks the complete stack, and automatically restores the previous working version if the update fails.
- **Check or repair CrowdSec** tests the containers, API, credentials, and registration, then offers a repair when a key is rejected.
- **Startup/reboot diagnostic report** collects read-only service, network, Docker, container, port, and resource details into a private report under `/tmp`.
- **Reconfigure installation** reruns the advanced installation questions.
- **Uninstall** takes a final backup, clearly describes what will be removed, and requires typed confirmation.

An ordinary menu update keeps your existing AppSec choice. Advanced users can enable AppSec on an existing installer-managed server with this one-time command:

```bash
wget -qO setup-npmplus.sh https://raw.githubusercontent.com/mangyan1/NPMplus/develop/setup-npmplus.sh &&
sudo bash setup-npmplus.sh --update --enable-appsec
```

For an existing rolling-`develop` installation with the installer-managed firewall bouncer, enable protected startup with:

```bash
wget -qO setup-npmplus.sh https://raw.githubusercontent.com/mangyan1/NPMplus/develop/setup-npmplus.sh &&
sudo bash setup-npmplus.sh --update --enable-strict-boot
```

If every public hostname on this IP is Cloudflare orange-clouded, you may also add the origin lock. DNS-only records on ports 80/443 will stop working, so this remains explicit rather than automatic:

```bash
wget -qO setup-npmplus.sh https://raw.githubusercontent.com/mangyan1/NPMplus/develop/setup-npmplus.sh &&
sudo bash setup-npmplus.sh --update --enable-strict-boot --enable-cloudflare-origin-lock
```

The origin lock blocks direct probes before Nginx, so those packets will not appear as CrowdSec dashboard attacks. Leave it off while evaluating RC4's direct-scan visibility; RC4 itself is unchanged.

## Check that it is running

```bash
sudo docker compose -f /opt/npmplus/compose.yaml ps
```

Every listed service should say `Up`. The `npmplus` service should become `healthy` after startup.

The installer enables Docker and configures the stack to return automatically after a server restart. With protected startup enabled, a pre-Docker guard blocks external web traffic, CrowdSec starts, the host bouncer must prove that both host and Docker-forwarded traffic are covered, and the guard is removed only after the public services pass health checks. A supplied initial administrator password is removed after first use, and NPMplus is recreated without the temporary secret mount before that file is deleted. This prevents the container from depending on a `/run` file that disappears during reboot.

## What the installer handles

- One interactive menu for installation, updates, diagnostics, and uninstalling.
- NPMplus and its web dashboard.
- Recommended CrowdSec, AppSec WAF, and firewall-bouncer protection, with AppSec compatibility exceptions per proxy host.
- Protected startup that fails closed before opening public listeners when CrowdSec enforcement is unavailable.
- Optional Cloudflare-only origin filtering for ports 80/443, with private/local networks retained for administration and testing.
- Optional Anubis bot protection and honeypot bans.
- Optional Caddy HTTP-to-HTTPS redirect service.
- Safe monthly updates with automatic rollback.
- Daily backups with the latest seven archives retained.
- CrowdSec credential checks and automatic repair.
- Optional UFW firewall and unattended operating-system security updates.
- Loopback-only dashboard access and non-root services by default.
- Read-only root filesystems, dropped Linux capabilities, `no-new-privileges`, and health checks for the optional CrowdSec, Anubis, and Caddy services.

Backups are stored under `/var/backups/npmplus`. The latest update snapshot is stored under `/var/backups/npmplus-last-good`.

## If something goes wrong

Show recent logs:

```bash
sudo docker compose -f /opt/npmplus/compose.yaml logs --tail=200
```

If an update refuses to start, it usually means a service is already stopped or unhealthy. The updater does this to avoid creating a bad rollback snapshot.

Run the same setup command and select a diagnostic option when you need help. For recovery and backup restoration, see the [setup and operations guide](docs/setup-npmplus.md).

When requesting help, share the command output but remove public IP addresses, domains, email addresses, and secrets first.

## Main features

- Proxy hosts, redirects, streams, access lists, certificates, and a modern admin dashboard.
- HTTP/3, modern TLS, mTLS, OIDC, `auth_request`, load balancing, and multiple access lists.
- Integrated CrowdSec and Anubis security dashboard with a compact overview, clickable KPI details, a scenario attack-mix donut with a per-interval activity strip, a WAF verdict card showing blocked traffic, top attacker IP/scenario/country/ASN/target filters, a lightweight animated geographic attack map, explicit CrowdSec/Anubis/honeypot status, bouncer enforcement status proving bans are served to the proxy, paginated local alert and ban views, engine metrics, optional browser alerts while the page is open, manual bans, exact-decision unban, and audit logging. The map renders at most 12 aggregated origins with inline SVG and CSS—no WebGL, map-tile downloads, or browser-side IP lookup. CrowdSec community blocklists remain fully enforced but are summarized as metrics instead of flooding the page with remote IP entries.
- Dedicated AppSec WAF monitoring shows whether protection is configured, inspected/passed/blocked request totals, block rate, and the active compatibility policy.
- Security headers, strict browser policy, protected session cookies, rate limits, and safer defaults.
- Daily container CVE monitoring, pull-request image gates, and a patched Caddy build from the stable release source.
- Support for Let's Encrypt and other ACME certificate authorities.
- Optional GoAccess statistics and API documentation in the dashboard.

See [Changes in this fork](ADVANCED.md#changes-in-this-fork-vs-zoeyvidnpmplus) for the detailed security and feature list.

## Releases and security reports

Release tags build AMD64 and ARM64 images in this repository, attach build provenance and an SBOM, and scan the exact images before publishing them to GitHub Container Registry. Publication also resolves and scans the exact Caddy, CrowdSec, and Anubis images selected by the installer. A release candidate updates only the `rc` channel; only a final release can update `latest`.

Each GitHub release includes a version-pinned `setup-npmplus.sh` and its SHA-256 checksum. The final image and installer files also receive GitHub identity-backed artifact attestations. After downloading an asset, advanced users can verify it with `gh attestation verify setup-npmplus.sh --repo mangyan1/NPMplus`; verify a release image with `gh attestation verify oci://ghcr.io/mangyan1/npmplus:<tag> --repo mangyan1/NPMplus`. Release candidates are for test systems first. Report suspected vulnerabilities privately by following [the security policy](SECURITY.md), not through a public issue.

## Existing NPMplus or Nginx Proxy Manager installation

Do not run the new-install command over an existing manual deployment. Read the [compatibility and migration notes](ADVANCED.md#compatibility-to-upstream) and make a backup first. Migrating back to the original project is not supported.

## Advanced configuration

Most users do not need manual Compose editing or custom Nginx configuration.

This fork is intentionally focused on reverse proxying and security. It does not automate PHP-FPM deployment: application stacks should own their PHP runtime, files, updates, and health checks. The legacy inbuilt and external PHP-FPM instructions remain advanced compatibility guidance only.

- [Host setup, updates, backups, recovery, and diagnostics](docs/setup-npmplus.md)
- [Advanced and manual configuration reference](ADVANCED.md)
- [Example Compose file](compose.yaml)

Guides written for other Nginx Proxy Manager versions may not match NPMplus. Ask before adding custom Nginx directives that duplicate built-in features.

## Get help

- [Questions and discussions](https://github.com/ZoeyVid/NPMplus/discussions)
- [Report a problem in this fork](https://github.com/mangyan1/NPMplus/issues)
- [NPMplus Discord](https://discord.gg/y8DhYhv427)

Please report fork-specific problems here before opening an upstream issue.

## License and attribution

This fork is distributed under the GNU Affero General Public License version 3 or later. It is based on the MIT-licensed Nginx Proxy Manager. By using NPMplus, you agree to the terms of Let's Encrypt or your selected certificate authority.

NPMplus is maintained by ZoeyVid. This fork is maintained by [mangyan1](https://github.com/mangyan1) and retains attribution to the original Nginx Proxy Manager creator and upstream contributors.
