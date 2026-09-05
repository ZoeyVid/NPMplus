# NPMplus security remediation report

## RC2 post-publication security scan — 2026-09-05

### Scope and verdict

This review scanned the exact published `v2.15.1-mangyan1.rc.2` source commit
(`6ec590823bf6b9ca2ba4bbc8a2efca01a0bb6bcc`), release installer, multi-architecture
application image, and the auxiliary images selected by that installer on the scan
date. The published NPMplus image index is
`sha256:50d2821958357106342191007a10fcd330c68bb63c37c6f8b4e34315ea7fc04a`.

The **RC2 NPMplus application image is clean in the available vulnerability data**:
Trivy 0.74.0 reported zero OS, Node, or Python findings at every severity for both
the amd64 and arm64 manifests. Both complete pnpm dependency graphs also reported
zero advisories, the CodeQL analysis for the RC2 commit passed, and no genuine
repository secret was found. This does not make the complete installation
vulnerability-free. The installer also deploys upstream CrowdSec and Anubis images
with previously accepted HIGH matches, and this review found two release-hardening
gaps plus one fixable MEDIUM match in the fork-built Caddy image.

RC2 is reasonable for the intended **test-server** use with the installer defaults,
but it should not be promoted to stable without reviewing RC2-02 through RC2-05.
RC2-01 is upstream-blocked and already has an expiring exception process; it should
remain visible in release notes rather than being represented as a clean full-stack
scan.

### Remediation status after the RC2 scan

- **RC2-01 remains upstream-blocked and explicitly tracked.** CrowdSec and Anubis
  protections remain enabled. Their separate, documented exceptions still expire on
  2026-10-04, and the release workflow now scans the exact recommended-stack digests
  before publication.
- **RC2-02 is resolved in setup script v1.30.** Fresh and updated installer-managed
  CrowdSec, Anubis, and Caddy services use read-only root filesystems, dropped
  capabilities, `no-new-privileges`, bounded tmpfs mounts where needed, and service
  health checks. CrowdSec and Anubis both initialized successfully in local hardened
  runtime tests. Caddy runs as UID/GID 65534 with only `NET_BIND_SERVICE` restored.
- **RC2-03 is resolved in the fork Caddy source.** The stable Caddy 2.11.4 source is
  patched only for cel-go 0.29 API compatibility, then built with cel-go 0.29.2 and
  x/crypto 0.56.0. The image served the expected redirect under its full sandbox and
  Trivy 0.74.0 reported zero MEDIUM/HIGH/CRITICAL findings.
- **RC2-04 is resolved in the release workflow.** Release publication now depends on
  AMD64 and ARM64 scans of the exact Caddy, CrowdSec, and Anubis digests selected for
  the installer. Those digests are written into the release notes.
- **RC2-05 is resolved for artifact identity and Actions pinning.** The release image,
  installer assets, and Caddy image receive GitHub artifact attestations. Repository
  SHA-pinning enforcement is enabled and every referenced action is already pinned.
  Active rulesets block deletion/force-push of `develop` and deletion/update of `v*`
  tags without imposing a pull-request-only workflow on the repository owner.
- **RC2-06 remains a documented, low-risk compatibility exception.** GoAccess 1.10.x
  still emits three runtime `new Function` sites in its generated report client. The
  relaxation stays limited to the authenticated, `no-store` `/goaccess` route and is
  not present in the main application CSP. Removing it today breaks the optional
  report; replacement remains the safe prerequisite.

The lifecycle defect found after RC2 is also fixed: a fresh bootstrap now recreates
NPMplus without its one-time `/run` secret mount before deleting the source file, and
an update repairs affected existing containers before taking a rollback baseline.
Smoke CI asserts the mount is absent, restarts Docker, verifies the full stack, injects
a failed update and verifies database/config rollback, then exercises uninstall and
clean reinstall. A Docker-daemon restart is the closest reliable reboot simulation on
a GitHub-hosted runner because rebooting the runner would terminate the job itself.

| Target | Exact artifact scanned | Result | Contextual assessment |
| --- | --- | --- | --- |
| NPMplus amd64 | `sha256:e33dc5ed824688c035ceae0dedde79221b4cf39aa1090ee5971744fac9f95095` | 0 findings at all severities | Clean in current Trivy data |
| NPMplus arm64 | `sha256:e20601a532fb0473656977a7cfdbdad8dd77dd3b91f1fb35cca7e41dbc9819d8` | 0 findings at all severities | Clean in current Trivy data |
| Fork Caddy amd64 | `sha256:1127389c820e2ee35ce525755593c201e2a918ff08478bda17d7d497241336c7` | 1 MEDIUM and 3 UNKNOWN; 0 HIGH/CRITICAL | MEDIUM path appears inactive in the fixed redirect configuration; update is available |
| CrowdSec amd64 | `sha256:dd16bad0a1622fe1653a85e91678223d28f3bb5459d8c9604dcd0c397da06975` | 18 HIGH occurrences, 0 CRITICAL | 9 unique accepted upstream IDs; reduced but not eliminated exposure |
| Anubis amd64 | `sha256:2babd956e4eb6daa06a41a9b3cbde394a0b2dae1872395f02a380436637c1bfa` | 11 HIGH occurrences, 0 CRITICAL | 11 unique accepted upstream IDs; indirectly processes untrusted requests |

### RC2-01 — Upstream CrowdSec and Anubis HIGH matches remain in the installed stack

- Severity: **Medium operational priority**, although Trivy labels the individual
  occurrences HIGH.
- Location: `setup-npmplus.sh:22-23`, `setup-npmplus.sh:1894-1943`,
  `.trivy/crowdsec.yaml`, and `.trivy/anubis.yaml`.
- Evidence: CrowdSec contains 18 HIGH occurrences representing 9 unique IDs.
  Anubis 1.27.0 contains 11 HIGH occurrences representing 11 unique IDs. The
  detailed IDs and affected components remain the same as CVE-R02 and CVE-R03
  below. No CRITICAL match was reported. Each accepted ID has a documented
  exception that expires on 2026-10-04.
- Impact: most matches are denial-of-service or parser issues in Go libraries.
  CrowdSec AppSec and Anubis receive information derived from Internet requests,
  so loopback listeners do not prove that every vulnerable path is unreachable.
- Existing mitigation: ports 6060, 7422, 8080, and 8923 are published only on host
  loopback. The standard CrowdSec deployment uses SQLite, not the affected optional
  PostgreSQL path, and does not enable the bundled notification plugins. Anubis is
  enabled per proxy host rather than globally by default. A scheduled workflow
  scans both images daily and fails when an unreviewed HIGH/CRITICAL match appears
  or an exception expires.
- Fix: update to upstream images rebuilt with the fixed Go modules as soon as they
  are released, then remove the matching exception entries. Do not disable
  CrowdSec, AppSec, the firewall bouncer, or Anubis merely to obtain a green scan.
- False-positive note: optional PostgreSQL, notification, gRPC, and xDS paths are
  not all enabled by this deployment. Other HTTP/parser resource-exhaustion paths
  may still be relevant. For example, the gRPC-Go DATA-frame advisory is fixed in
  1.83.1, while the scanned upstream binaries contain older versions.

References: [CrowdSec releases](https://github.com/crowdsecurity/crowdsec/releases),
[Anubis releases](https://github.com/TecharoHQ/anubis/releases), and
[CVE-2026-84304](https://github.com/advisories/GHSA-vp52-pcj8-j9qc).

### RC2-02 — Auxiliary services do not receive the main container's runtime sandbox

- Severity: **Medium defense-in-depth risk**.
- Location: `setup-npmplus.sh:1894-1962`.
- Evidence: the generated NPMplus service drops all capabilities, adds only six
  required capabilities, enables `no-new-privileges`, and drops application
  processes to UID/GID 1000 after initialization. The generated CrowdSec, Anubis,
  and Caddy services do not set capability, privilege, or read-only-root controls.
  Image inspection confirms that Caddy and CrowdSec run as container root; Anubis
  runs as UID 1000.
- Impact: a successful exploit in an auxiliary network service would retain more
  container privileges than necessary. Container root is not automatically host
  root, and none of these services mounts the Docker socket, but reducing available
  capabilities limits post-exploitation options and the impact of a container
  runtime weakness.
- Fix: run the redirect-only Caddy service as `65534:65534`, use a read-only root
  filesystem, drop all capabilities, add only `NET_BIND_SERVICE`, and enable
  `no-new-privileges`. Apply `cap_drop: [ALL]` and `no-new-privileges` to Anubis.
  Test CrowdSec initialization and upgrades with `cap_drop: [ALL]` and
  `no-new-privileges`, retaining only a capability demonstrated to be required.
  Add Compose health checks for the auxiliary services.
- Verification of the proposed Caddy control: the exact RC2 Caddy image successfully
  served its 301 redirect as UID/GID 65534 with a read-only root filesystem, all
  capabilities dropped except `NET_BIND_SERVICE`, and `no-new-privileges` enabled.
- False-positive note: Trivy's generic Dockerfile rule labels a missing `USER` as
  HIGH. The contextual severity is lower because the image has no host volume,
  performs one static redirect, and remains container-isolated. The main NPMplus
  image's same generic warning is mitigated differently: its trusted startup phase
  must prepare mounted data and then explicitly drops privileges.

### RC2-03 — Caddy contains one fixable MEDIUM CEL library advisory

- Rule ID: `GHSA-gcjh-h69q-9w9g`
- Severity: **Low practical risk in this configuration; MEDIUM scanner severity**.
- Location: `caddy/Dockerfile:2-17` and `caddy/Caddyfile:1-9`.
- Evidence: the Caddy binary contains `github.com/google/cel-go` 0.28.1; 0.29.0
  fixes exposure of Go fields marked `json:"-"` when an application allows
  user-supplied CEL expressions through `NativeTypes(ParseStructTag("json"))`.
  Trivy also reports three UNKNOWN x/crypto/OpenPGP/SSH inventory matches, but the
  redirect service does not expose SSH or OpenPGP behavior.
- Impact: the vulnerable CEL behavior can disclose private struct fields in an
  application that evaluates attacker-controlled CEL. The shipped Caddyfile only
  removes the Server header and returns a fixed HTTPS redirect; it does not accept
  CEL expressions or configure native Go types. No reachable disclosure path was
  found in this deployment.
- Fix: rebuild Caddy with cel-go 0.29.0 or newer, update x/crypto to 0.56.0 or newer,
  and re-run the Caddy module/configuration smoke test. Keep the current pinned
  Caddy release and explicit module replacements; do not track an unreviewed branch.
- False-positive note: this is a real library advisory, not proof that the fixed
  redirect service exposes the required API. The reduced contextual severity is
  based on the exact Caddyfile and compiled service role.

Reference: [GHSA-gcjh-h69q-9w9g](https://github.com/advisories/GHSA-gcjh-h69q-9w9g).

### RC2-04 — The release gate scans only the main image, not the installed stack

- Severity: **Medium release-assurance risk**.
- Location: `.github/workflows/release.yml:133-178`.
- Evidence: both architecture jobs correctly scan the exact NPMplus release
  candidate and block publication on HIGH/CRITICAL findings. The released installer
  additionally resolves Caddy, CrowdSec, and Anubis images, but the release workflow
  does not gate on those artifacts. The independent scheduled full-stack scan most
  recently failed on an older NPMplus image at commit `8c9f9fe0`; RC2 still
  published because the workflows are independent.
- Impact: a release can pass its security job while the complete default/recommended
  deployment contains a new unreviewed auxiliary-image finding. This creates a gap
  between “release image scanned” and “installer-selected stack scanned.”
- Fix: add a release job that resolves the same auxiliary image digests as the
  installer, scans all of them, applies only the existing expiring CrowdSec/Anubis
  baselines, and makes image/release publication depend on that job. Record the
  resolved digests and accepted-risk summary in the release notes.
- False-positive note: the scheduled workflow still provides daily detection, and
  the current auxiliary findings were already reviewed. This is an assurance gap,
  not evidence that the RC2 application image bypassed its own scan.

### RC2-05 — Published provenance is present but is not identity-verifiable

- Severity: **Low supply-chain hardening gap**.
- Location: `.github/workflows/release.yml:61-230` and the
  `v2.15.1-mangyan1.rc.2` tag.
- Evidence: both architecture manifests include BuildKit SLSA provenance and SPDX
  SBOM attachments. However, `gh attestation verify` returns HTTP 404 for the
  published image index, the annotated release tag has no cryptographic signature,
  and the repository has no branch or tag ruleset. The installer checksum and
  installer asset are published in the same release trust domain.
- Impact: digest pinning prevents unnoticed byte drift after installation, but
  consumers cannot independently verify through GitHub's Sigstore-backed
  attestation service that the artifact came from this repository and release
  workflow. An account/workflow compromise could replace release inputs and their
  same-origin checksum.
- Fix: use GitHub's artifact-attestation action with least-privilege
  `id-token: write` and `attestations: write` permissions for the final image digest
  and installer asset; document `gh attestation verify`; protect `develop` and
  `v*` release tags with rulesets and required checks; enable repository SHA-pinning
  enforcement for Actions after confirming every workflow action remains pinned.
- False-positive note: this does not indicate that RC2 was tampered with. Its Git
  commit, image labels, release digest, SBOM, provenance metadata, and installer
  checksum are internally consistent.

Reference: [GitHub artifact-attestation documentation](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations).

### RC2-06 — Optional GoAccess retains isolated `unsafe-eval`

- Severity: **Low residual browser-hardening risk**.
- Location: `rootfs/usr/local/nginx/conf/conf.d/npmplus.conf:100-119`.
- Evidence: the main NPMplus application CSP allows only same-origin element scripts
  and does not contain `unsafe-eval`. The optional GoAccess document uses
  `script-src 'self' 'unsafe-eval'` because GoAccess 1.10.x compiles its fixed
  report templates at runtime. Its JavaScript and CSS are external same-origin
  assets, every route requires administrator authorization, and every response is
  `no-store`.
- Impact: if an attacker first obtains script-injection ability in that isolated
  administrator-only report, `unsafe-eval` increases the available execution
  primitives. No injection source or authentication bypass was identified.
- Fix: remove the directive only after GoAccess can produce a report that works
  without runtime template compilation, or replace the generated client. Keep the
  relaxation scoped to `/goaccess`; never add it to the main application CSP.
- False-positive note: this is a defense-in-depth exception, not a confirmed XSS.

### Checks that did not become findings

- The release workflow's exact-image HIGH/CRITICAL scans passed for amd64 and arm64;
  the independent all-severity rescan reported zero findings for both manifests.
- Complete backend and frontend `pnpm audit` runs reported 0 advisories across 232
  and 218 dependencies respectively. GitHub Dependabot and secret-scanning APIs
  reported 0 open alerts.
- The current RC2 CodeQL analyses passed and produced no source-code alert. The 49
  open Trivy records in GitHub code scanning all reference older commit
  `8c9f9fe0a470d14361cc5eebdffb29cede798e91`: they are seven util-linux CVEs
  repeated across seven packages. The exact RC2 image contains the patched package
  set and scans clean, so these are stale dashboard records expected to close after
  the next full-stack SARIF upload.
- Trivy secret scanning identifies the private-key-shaped value in
  `backend/schema/paths/nginx/certificates/certID/upload/post.json:39`. It is a
  public API example paired with example certificate data, not a runtime or
  repository credential. A Git-history pattern scan found only standard documented
  example AWS identifiers, and GitHub push protection is enabled.
- No frontend dynamic-HTML/eval sink was found. Browser storage contains UI state
  and the session-expiry timestamp, not the authentication token. Session and MFA
  tokens stay in signed `Secure`, `HttpOnly`, `SameSite` cookies. Production source
  maps are absent from the RC2 image.
- The Express API disables its framework banner, limits JSON/form bodies to 1 MiB,
  applies origin/fetch-metadata checks, rate-limits authentication and sensitive
  downloads, keeps command execution in argument-vector `execFile` calls, and uses
  bounded/time-limited reads for CrowdSec and other external responses.
- Trivy's four `RUN cd` Dockerfile findings are maintainability recommendations,
  not security-boundary defects. The build downloads are pinned by version/commit
  and, where applicable, verified hashes.

### Scan limitations

This was a static source, dependency, configuration, release-provenance, and
container inventory review. It was not a penetration test of a live VM, an OIDC
provider, Cloudflare, CrowdSec CAPI, the host firewall, or Docker itself. A zero
scanner count means no match in the scanner data at that time; it is not a proof
that undisclosed vulnerabilities do not exist.

## GoAccess browser hardening — 2026-09-05

The optional, administrator-only GoAccess report now uses GoAccess's supported external-assets mode. Its executable JavaScript and stylesheet are generated as separate same-origin files, both routes require the same administrator authorization as the report, and the HTML, JavaScript, and CSS responses are marked `no-store`. The former executable-inline-script allowance was removed. The container health check also verifies all three generated files and the live WebSocket socket when GoAccess is enabled.

GoAccess 1.10.x still compiles its bundled, fixed report templates at runtime, so its isolated document retains `script-src 'self' 'unsafe-eval'`. Removing that directive breaks the upstream report. The permission is not present on the main NPMplus application, and arbitrary or cross-origin script loading remains blocked. Replacing GoAccess's generated client would be a separate upstream/frontend replacement rather than a safe configuration-only change.

Validation: the production image built successfully; Nginx configuration validation passed; GoAccess generated `index.html`, `goaccess.css`, `goaccess.js`, and its Unix socket; only the same-origin external JavaScript file is executable; generated assets are protected by administrator authorization and no-cache headers; and ShellCheck passed for the updated health check.

## GitHub code-scanning dashboard check — 2026-09-05

Baseline: `develop` at `70a37330c7c716eda7941a09dd11a6b3f07a4bea`, with the published release candidate at `b332a53aaffab7fab5df4056f6543ad8929542f1`.

### Executive summary

GitHub listed **34 open code-scanning alerts** at the start of this review: 29 Trivy container findings and 5 CodeQL findings. After the remediation below, GitHub lists **zero open code-scanning alerts**. The 29 Trivy occurrences were 16 unique, already reviewed advisories in the upstream CrowdSec and Anubis images. They remain visible in downloadable scan reports and pass the enforcement workflow only through documented exceptions that expire on 2026-10-04. The 5 CodeQL results were individually dismissed as false positives with source-specific explanations.

There is no open Trivy alert for the fork-built NPMplus or Caddy images. Both production `pnpm audit` checks returned zero advisories. The latest CodeQL run, release-image scans, and scheduled container-security gate completed successfully. No critical alert or directly actionable high-severity fork-code defect was identified in this dashboard review.

### CS-001 — Accepted container findings were republished as open SARIF alerts — resolved

- Rule ID: supply-chain alert hygiene
- Severity: **Medium operational risk**, not a new runtime vulnerability
- Location: `.github/workflows/container-security.yml:69-91`, especially SARIF generation at line 89
- Evidence: the readable report receives the component's `--ignorefile` plus `--show-suppressed`, and the enforcement scan receives the `--ignorefile`. The separate SARIF command receives neither, so every accepted CrowdSec and Anubis baseline match is uploaded to GitHub as open.
- Impact: the Security tab remains red with 29 known occurrences, which can cause alert fatigue and make a genuinely new finding harder to notice. The configuration does not weaken the enforcement gate or create additional container exposure.
- Resolution: commit `70a37330c7c716eda7941a09dd11a6b3f07a4bea` keeps the full `--show-suppressed` table as the review artifact and applies the same expiring ignore file to SARIF generation without `--show-suppressed`. The failing enforcement scan remains unchanged.
- Verification: manually dispatched [Container Security run 33948757129](https://github.com/mangyan1/NPMplus/actions/runs/33948757129) passed the NPMplus, Caddy, CrowdSec, and Anubis scan and SARIF-upload jobs. GitHub then reconciled all 29 accepted Trivy occurrences out of the open-alert view.
- False-positive notes: the underlying advisories are not all false positives. They are upstream matches with reduced or inactive paths, accepted temporarily while awaiting patched upstream builds.

### CS-002 — Five reviewed CodeQL false positives remained open — resolved

- Rule ID: `js/insufficient-password-hash`, `js/clear-text-storage-of-sensitive-data`, and `js/sensitive-get-query`
- Severity: **Low dashboard-hygiene risk** after source review
- Locations: `backend/routes/crowdsec.js:188`, `backend/routes/oidc.js:188`, `backend/routes/oidc.js:201`, `backend/routes/nginx/certificates.js:231`, and `backend/routes/nginx/certificates.js:345`
- Evidence: the CrowdSec SHA-256 value is only an in-memory cache fingerprint for a high-entropy machine credential, not a password verifier. The OIDC bearer values are placed in signed, `Secure`, `HttpOnly`, `SameSite=Strict`, `__Host-` cookies with bounded expiry. The two certificate values are validated numeric path IDs guarded by API authentication and authorization, not sensitive query-string data.
- Impact: these results make the open count look worse but do not establish credential disclosure, weak password verification, or unauthenticated certificate access.
- Resolution: alerts 1 through 5 were individually dismissed as false positives on 2026-09-05. Each GitHub alert records the applicable source-specific rationale. No CodeQL query was disabled or weakened.
- Verification: the code-scanning API reports all five alerts as dismissed by `mangyan1` with reason `false positive`; the repository now has zero open code-scanning alerts.
- False-positive notes: this assessment depends on the machine credential remaining high entropy, TLS remaining mandatory, cookie flags not being weakened, and authorization staying enforced in `internalCertificate`.

### CS-003 — Upstream CrowdSec and Anubis advisories remain temporarily accepted

- Rule ID: 16 unique Trivy IDs across 29 binary/package occurrences
- Severity: **Medium operational priority**, although GitHub labels each occurrence high
- Location: upstream CrowdSec 1.8.1/latest and Anubis 1.27.0 container contents; exception records are in `.trivy/crowdsec.yaml` and `.trivy/anubis.yaml`
- Evidence: CrowdSec accounts for 18 occurrences and Anubis for 11. The exception statements document loopback-only listeners, inactive optional notification/PostgreSQL paths where applicable, and the need for upstream rebuilds. Every exception expires on 2026-10-04, after which the enforcement workflow fails unless it is deliberately reviewed again.
- Impact: reachable parser or HTTP/2 resource-exhaustion paths could affect availability if present in the compiled binaries. Loopback binding reduces direct exposure, but Anubis and CrowdSec AppSec still process data originating from untrusted proxy requests, so the alerts should not be dismissed as universally unreachable.
- Fix: update to patched upstream images as soon as CrowdSec and Anubis publish them, then remove the corresponding exception entries.
- Mitigation: retain loopback-only bindings, per-host Anubis enablement, request/connection limits, daily scanning, and immutable-digest updates.
- False-positive notes: optional notification plugins, CrowdSec's PostgreSQL driver, and Anubis gRPC/xDS paths are not enabled by the standard installer. Other denial-of-service-related paths may still be relevant.

## CVE remediation status — 2026-09-04

The repository-controlled recommendations from the point-in-time rescan have been implemented in the working tree:

| Finding | Status | Implemented control |
| --- | --- | --- |
| CVE-R01 — Caddy | Resolved in the fork image | Caddy 2.11.4 is rebuilt from stable source with Go 1.26.8, `x/crypto` 0.55.0, `x/net` 0.57.0, gRPC-Go 1.83.1, Caddy's reduced database build tags, and upgraded Alpine packages. The resulting Linux/AMD64 image has zero Trivy high/critical findings. |
| CVE-R02 — CrowdSec | Upstream-blocked; monitored and mitigated | The deployment remains SQLite-based with APIs bound to loopback. A daily scan follows `crowdsecurity/crowdsec:latest`; reviewed upstream findings have documented exceptions that expire on 2026-10-04. New high/critical findings fail CI. Protection remains enabled. |
| CVE-R03 — Anubis | Upstream-blocked; monitored and mitigated | The deployment remains per-host and loopback-only. CI resolves the latest stable Anubis release daily; reviewed upstream findings have documented exceptions that expire on 2026-10-04. New high/critical findings fail CI. Protection remains enabled. |
| CVE-R04 — Python packaging tools | Accepted with reviewed baseline | Pip (pinned) and Certbot remain in the runtime image so DNS provider plugins install on demand, matching upstream NPMplus. The two setuptools matches are stale metadata with no installed distribution, and the msgpack code is vendored inside pip itself; none are reachable from an HTTP request. They are carried in `.trivy/npmplus.yaml` with an expiry that forces re-review. |

Pull requests now scan the actual final Linux/AMD64 application image and changed Caddy image. A scheduled workflow scans all four published components, retains readable and SARIF reports, uploads SARIF to GitHub code scanning, and enforces the two separate expiring upstream baselines. SQLite remains the default; PostgreSQL and PHP-FPM were not added because neither is a CVE remediation for this deployment.

Validation performed for the remediation:

- A full Linux/AMD64 NPMplus production image build passed. Certbot 5.7.0, Nginx 1.31.5, and Node.js 24.18.1 ran in the result, while the pip command and package directory were absent.
- Trivy 0.74.0 reported zero high/critical findings for the rebuilt NPMplus and Caddy images.
- Caddy reported Go 1.26.8 and the intended module replacements, validated its configuration during the build, and returned the expected HTTP-to-HTTPS redirect in a container smoke test.
- The CrowdSec and Anubis enforcement scans passed with their separate reviewed baselines; the latest stable Anubis resolver selected v1.27.0.
- All 20 backend tests and the OpenAPI schema check passed. The frontend TypeScript and Vite production build passed as part of the final image build.
- Compose rendering, changed shell syntax, workflow YAML parsing, Dockerfile linting, and the complete GitHub Actions workflow set were checked. Actionlint reported only pre-existing informational ShellCheck findings in unrelated workflow scripts.

## Point-in-time CVE rescan — 2026-09-04

- Repository baseline: `develop` at `6ab79c8a2d607ba29e2e595382b170bfb135ccd3`
- Scan completed: 2026-09-04 America/Edmonton (2026-09-05 UTC)
- Scanner: Trivy 0.74.0, image digest `aquasec/trivy@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969`
- Scope: both pnpm lockfiles, repository filesystem, GitHub Dependabot/secret/code-scanning alerts, and the exact Linux/amd64 runtime image digests deployed by the installer.

### Executive result

Yes. The current container set contains published vulnerability matches. The JavaScript application dependencies are clean, but the optional Caddy, CrowdSec, and Anubis binaries were built before several recent Go security fixes.

Scanner counts are inventory signals, not proof that every CVE is exploitable. A single advisory can appear in multiple binaries or packages, and Go scanners report a module when the vulnerable package may not be reachable in the compiled program. The priorities below account for how this fork actually deploys each component.

| Target scanned | Exact image/index digest | All scanner occurrences | High/critical detail | Assessment |
| --- | --- | ---: | --- | --- |
| NPMplus application | `sha256:9d9fe40b804d1ddf59919318f29d418d4673940d1cc37cafd41002b43bc4cd2b` | 3 (3 unique IDs) | 2 high, 0 critical | Two Python packaging-tool matches; not exposed through the web application. See CVE-R04. |
| NPMplus Caddy | `sha256:2dcac425385b78408dbad163e32414e6a11795a8fb73c0e142abc17e489d7fa2` | 42 (31 unique IDs) | 18 fixable occurrences: 1 Trivy-critical and 17 high, representing 16 unique IDs | Highest remediation priority because Caddy is the public port-80 edge. See CVE-R01. |
| CrowdSec 1.8.1/latest | `sha256:0f2523fa61ef507f15d953045cface490cc880670c62f2755ced17524107f71a` | 66 (26 unique IDs) | 18 high occurrences: 16 fixable and 2 currently without a fixed version, representing 9 unique IDs | Upstream image issue; practical exposure is reduced by loopback binding and default SQLite use. See CVE-R02. |
| Anubis 1.27.0 | `sha256:8828275668b7bc675679f100970f9714f731388fbbf66ae94de8aca952e3fc4a` | 12 (12 unique IDs) | 11 high, 0 critical | Upstream image issue; loopback-only but indirectly handles untrusted requests through `auth_request`. See CVE-R03. |

The all-severity totals above include low, medium, unknown, duplicate, and no-fix matches. The detailed findings prioritize high/critical issues. A scan limited to fixable high/critical findings reported zero results for the repository filesystem itself.

### CVE-R01 — Public Caddy image contains stale Go and Alpine components

- Severity: **High operational priority**. Trivy labels one module match critical; GitHub's reviewed advisory labels that CVE high.
- Location: `caddy/Dockerfile:2`, `caddy/Dockerfile:4`, `.github/workflows/caddy.yml:1`
- Evidence: the image contains Alpine OpenSSL 3.5.7-r0, Go stdlib 1.26.3, `golang.org/x/net` 0.55.0, `golang.org/x/text` 0.37.0, `golang.org/x/crypto` 0.52.0, and gRPC-Go 1.81.0. Fixed releases are available for these components. The pinned official `caddy:2.11.4` image is still the current Caddy release and was built in June 2026, before the affected Go fixes.
- Unique high/critical IDs: `CVE-2026-14456`, `CVE-2026-27145`, `CVE-2026-33818`, `CVE-2026-39821`, `CVE-2026-39822`, `CVE-2026-42504`, `CVE-2026-46600`, `CVE-2026-56852`, `CVE-2026-56853`, `CVE-2026-56854`, `CVE-2026-56858`, `CVE-2026-56859`, `CVE-2026-56860`, `CVE-2026-56862`, `CVE-2026-84304`, and `GHSA-hrxh-6v49-42gf`.
- Impact: the stdlib, HTTP/2, TLS, DNS, URL, and template advisories can cause denial of service or unsafe parsing if the affected code path is present and reached by attacker-controlled traffic. Caddy is Internet-facing in this stack, so these cannot be dismissed solely because they are transitive dependencies.
- Reachability/false-positive note: `CVE-2026-56854` concerns SSH source-address authorization. This deployment does not configure an SSH server, so the scanner's critical rating is not evidence of a critical remote Caddy exploit. The gRPC xDS authorization portion of `GHSA-hrxh-6v49-42gf` is also not configured here, although the advisory's HTTP/2 resource-exhaustion path may still matter when server transport code is linked and reachable.
- Recommended fix: rebuild the Caddy image with a patched Alpine package set and a Caddy binary compiled with patched Go stdlib and module versions. As of this scan, Caddy 2.11.4 remains the latest stable release, so simply resolving the same tag again does not fix the binary. Prefer a reviewed patch build or the next stable Caddy release; do not silently track Caddy `master` in production.
- Temporary mitigation: keep normal connection/request limits in front of public services and omit the optional Caddy container if its port-80 redirect is not needed. HTTPS on the main NPMplus listener remains available; this is not a recommendation to disable CrowdSec or AppSec.

References: [Go release history](https://go.dev/doc/devel/release), [Caddy releases](https://github.com/caddyserver/caddy/releases), [CVE-2026-56854 / GHSA-gjhq-gjfw-99mq](https://github.com/advisories/GHSA-gjhq-gjfw-99mq), [gRPC GHSA-hrxh-6v49-42gf](https://github.com/advisories/GHSA-hrxh-6v49-42gf).

### CVE-R02 — Latest CrowdSec image contains vulnerable helper and Go binaries

- Severity: **Medium operational priority**, with upstream high-severity matches.
- Location: `setup-npmplus.sh:23`, `setup-npmplus.sh:1003`, `setup-npmplus.sh:1240`
- Evidence: CrowdSec 1.8.1/latest contains 18 high occurrences representing 9 unique IDs. The fixable matches are OpenSSL in the Alpine layer; `x/net` and `x/text` in the `yq` helper; and `CVE-2026-84304` in CrowdSec, `cscli`, and six notification plugin binaries. `CVE-2026-32286` appears in the CrowdSec and `cscli` PostgreSQL protocol dependency and currently has no fixed version reported.
- Unique high IDs: `CVE-2026-14456`, `CVE-2026-25681`, `CVE-2026-27136`, `CVE-2026-32286`, `CVE-2026-33814`, `CVE-2026-39821`, `CVE-2026-46600`, `CVE-2026-56852`, and `CVE-2026-84304`.
- Impact: `CVE-2026-84304` is a gRPC HTTP/2 DATA-frame memory-exhaustion issue. The remaining findings include parser/DoS issues in support tooling and the PostgreSQL protocol package.
- Reachability/false-positive note: the installer binds CrowdSec API/AppSec/metrics ports to loopback, `yq` is used as local tooling rather than a public web server, optional notification plugins are not enabled by this installer, and the standard generated deployment uses CrowdSec's local SQLite database rather than PostgreSQL. Those facts reduce exposure, but do not remove the need for an upstream rebuild.
- Recommended fix: consume a patched CrowdSec release/image when upstream publishes it and keep the immutable-digest update behavior. Repacking only the Alpine layer would fix OpenSSL but cannot repair Go dependencies compiled into CrowdSec, `cscli`, plugins, or `yq`.
- Temporary mitigation: retain the current loopback-only bindings and do not expose ports 6060, 7422, or 8080 to the LAN/Internet.

References: [CrowdSec releases](https://github.com/crowdsecurity/crowdsec/releases), [CVE-2026-84304 / GHSA-vp52-pcj8-j9qc](https://github.com/advisories/GHSA-vp52-pcj8-j9qc), [CVE-2026-32286 / GHSA-jqcq-xjh3-6g23](https://github.com/advisories/GHSA-jqcq-xjh3-6g23).

### CVE-R03 — Latest Anubis image predates recent Go security rebuilds

- Severity: **Medium operational priority**, with 11 high scanner matches.
- Location: `setup-npmplus.sh:349`, `setup-npmplus.sh:1017`, `setup-npmplus.sh:1264`
- Evidence: Anubis 1.27.0 contains Go stdlib 1.26.5, `x/text` 0.38.0, and gRPC-Go 1.81.1. Trivy reports 11 high and one medium fixable advisory. The high IDs are `CVE-2026-33818`, `CVE-2026-39821`, `CVE-2026-46600`, `CVE-2026-56852`, `CVE-2026-56853`, `CVE-2026-56858`, `CVE-2026-56859`, `CVE-2026-56860`, `CVE-2026-56862`, `CVE-2026-84304`, and `GHSA-hrxh-6v49-42gf`.
- Impact: the relevant classes are crafted-input CPU/memory exhaustion, HTTP/2 denial of service, URL/XML/template parsing problems, and gRPC authorization/transport issues if the matching paths are linked and exercised.
- Reachability/false-positive note: Anubis is bound to `127.0.0.1:8923`, but Nginx can send attacker-controlled request metadata to it via `auth_request`, so loopback binding is not by itself a complete reachability dismissal. The stack does not configure gRPC or xDS for Anubis, reducing the likelihood of the gRPC findings.
- Recommended fix: update to an upstream Anubis image rebuilt with Go 1.26.6 or newer and patched modules. Version 1.27.0 is still the latest stable release as of the scan; the installer already selects the latest validated release and immutable digest, so upstream must publish a rebuilt tag or new release.
- Temporary mitigation: continue enabling Anubis only per host, keep its listener loopback-only, and use normal proxy request/connection limits.

References: [Anubis releases](https://github.com/TecharoHQ/anubis/releases), [Go release history](https://go.dev/doc/devel/release), [CVE-2026-84304 / GHSA-vp52-pcj8-j9qc](https://github.com/advisories/GHSA-vp52-pcj8-j9qc).

### CVE-R04 — Main image Python findings are packaging-tool artifacts

- Severity: **Low practical risk** despite two high and one medium scanner labels.
- Location: `Dockerfile:267`, `Dockerfile:268`
- Evidence: Trivy reports `setuptools` 70.3.0 for `CVE-2025-47273` and `CVE-2026-59890`, plus `msgpack` 1.1.2 for `GHSA-6v7p-g79w-8964`. Runtime inspection shows no installed `setuptools` distribution and no installed standalone `msgpack` distribution. The matching MessagePack code is vendored inside pip 26.2.1 under `pip/_vendor/msgpack`.
- Impact: the setuptools path-traversal issue requires use of its package download machinery; that package is not installed. The MessagePack issue requires local pip code to reuse a malformed `Unpacker` after catching an error. Neither is reachable from an NPMplus HTTP request.
- False-positive note: the setuptools entries are stale/metadata scanner matches rather than an importable runtime package. The msgpack code exists, but only inside the administrative pip tool, so this is not a web application CVE.
- Recommended fix: update pip after it vendors MessagePack 1.2.1. Keep runtime Certbot DNS plugin installation upstream-compatible; the packaging-tool findings remain under the reviewed, expiring `.trivy/npmplus.yaml` baseline.

References: [setuptools CVE-2025-47273](https://github.com/advisories/GHSA-5rjg-fvgr-3xxf), [MessagePack GHSA-6v7p-g79w-8964](https://github.com/advisories/GHSA-6v7p-g79w-8964).

### Dependency and GitHub alert checks

- Backend `pnpm audit`, production and full dependency graph: 0 advisories.
- Frontend `pnpm audit`, production and full dependency graph: 0 advisories.
- GitHub Dependabot open alerts: 0.
- GitHub secret-scanning open alerts: 0.
- Repository filesystem, fixable high/critical dependency scan: 0 findings.
- GitHub CodeQL open alerts: 5. These are not CVEs and were manually triaged as false positives:
  - `backend/routes/crowdsec.js:188` hashes a high-entropy machine password only to key an in-memory token cache; it is not a password verifier or stored credential hash.
  - `backend/routes/oidc.js:188` and `backend/routes/oidc.js:201` set short-lived bearer tokens in signed, `Secure`, `HttpOnly`, `SameSite=Strict`, `__Host-` cookies. The token must be recoverable by the server/client authentication flow; it is not written to persistent cleartext storage.
  - `backend/routes/nginx/certificates.js:231` and `backend/routes/nginx/certificates.js:345` read a numeric certificate ID from the URL path, not a password, token, or sensitive query value.

No GitHub alert was dismissed or otherwise changed during this review.

### Control gap and recommended order

At the scan baseline, the repository had dependency update automation but no scheduled container vulnerability scan. Because release tags and image digests can remain unchanged while new CVEs are published, build-on-change alone did not detect these August/September advisories. The remediation status above records the controls added after this observation.

Original recommended remediation order (now implemented where repository-controlled):

1. Add a scheduled and pull-request Trivy gate that scans the actual Linux/amd64 final images, publishes a human-readable artifact/SARIF result, and fails only on reviewed high/critical findings with a documented, expiring ignore process.
2. Produce or adopt a patched Caddy binary/image; rebuild the Caddy Alpine layer immediately for the OpenSSL fix.
3. Track patched CrowdSec and Anubis upstream images, then refresh their immutable digests through the existing safe-update path.
4. Remove unnecessary Python packaging tools from the NPMplus runtime image.

This is a static dependency/container assessment, not a live penetration test. It does not prove exploitability or confirm the patch state of a VM that is not running these exact digests.

> Historical note: the remediation record below describes the 2026-09-02 source review. Its statement that no reviewed production finding remained open was correct for that assessment; the CVE rescan above incorporates vulnerabilities published or recognized afterward.

- Assessment and remediation date: 2026-09-02
- Repository: `mangyan1/NPMplus`
- Branch baseline: `develop` at `4c1e778149f8b3def4cbb20c1c6ef4419d1193a4`
- Scope: Express backend, React frontend, Nginx templates, Docker build/runtime configuration, host setup and diagnostic scripts, dependency policy, and GitHub Actions.

## Result

All 12 findings from the security review have been addressed in the working tree. No known production finding remains open. Two changes require operator awareness:

- Existing installations keep their current host-network/root-compatible Compose layout during `--update`; the safer bridge-network and UID/GID 1000 defaults apply automatically to newly generated stacks. This avoids silently breaking existing proxy targets or data ownership. Existing operators can migrate during a maintenance window.
- Certbot DNS provider plugins are installed on demand into the running container, matching upstream NPMplus. The image keeps pinned pip and Certbot for this; the pip packaging-tool findings are carried as a reviewed, expiring scan baseline.

## Remediation summary

| ID | Original severity | Status | Remediation |
| --- | --- | --- | --- |
| SEC-001 | Critical | Resolved | First-user creation now requires a generated 256-bit, one-time setup token, compares it in constant time, serializes setup creation, removes the token after success, and keeps the admin port loopback-only by default. |
| SEC-002 | High | Resolved | Raw Nginx fields, local filesystem targets, and syntax-bearing custom paths are administrator-only at the backend boundary. New non-admins receive view-only defaults, and host/domain input validation is stricter. |
| SEC-003 | High | Resolved | Verified email checks fail closed. UserInfo is fetched when verification is missing, and OIDC identities are persistently bound to a unique hash of issuer plus subject rather than authorized by email on every login. |
| SEC-004 | High | Resolved | Upstream synchronization now pushes to an automation branch and opens a pull request. Pull-request builds are read-only and cannot publish images; mutable formatter/tool execution was removed or digest/version pinned. Release tags are validated and passed to shells through quoted environment variables. |
| SEC-005 | High | Replaced by upstream-compatible design | Runtime Certbot provider-plugin installation follows upstream NPMplus and installs on demand, so Cloudflare DNS challenges work without a custom image. Certbot and pip are version-pinned in the image build, and the pip packaging-tool scanner findings are kept under a reviewed, expiring `.trivy/npmplus.yaml` baseline rather than silently ignored. |
| SEC-006 | Medium | Resolved | API errors no longer return stack traces or nested command failures. Clients receive a correlation ID while full diagnostics stay in server logs. JSON, form, avatar, and certificate-upload bodies are explicitly bounded. |
| SEC-007 | Medium | Resolved | External requests use abort timeouts and bounded streaming readers. Cloudflare range refresh no longer blocks the backend listener during startup. |
| SEC-008 | Medium | Resolved for defaults | The sample and fresh installer use a bridge network, explicit ports, loopback-only administration, UID/GID 1000, minimal required capabilities, and `no-new-privileges`. Host networking is opt-in. |
| SEC-009 | Medium | Resolved | Secret-file support was added for cookie, OIDC, bootstrap, ACME, and database secrets. The entrypoint resolves and unsets `_FILE` pointers before later validation; Compose examples use mounted secret files. |
| SEC-010 | Medium | Resolved | Password reset accepts only stdin, and CrowdSec HTTP credentials/bodies are supplied through curl stdin configuration instead of process arguments. |
| SEC-011 | Low | Resolved | Unknown/default HTTP hosts are rejected with 400/444 rather than redirected using the untrusted Host header. |
| SEC-012 | Low | Resolved | pnpm uses a seven-day release quarantine with narrow reviewed exceptions; pip, Certbot, LuaRocks, pnpm, and formatter images/tools are pinned. |

## Key implementation details

### Setup and identity

- `backend/setup.js` owns setup-token creation, validation, and deletion.
- `backend/routes/users.js` enforces the token on unauthenticated first-user creation and prevents concurrent first-user requests in the application process.
- `frontend/src/pages/Setup/index.tsx` prompts for the setup token and sends it only in the dedicated request header.
- `backend/internal/token.js`, `backend/models/auth.js`, and migration `20260902210000_oidc_identity_unique.js` implement stable OIDC identity binding.

### Authorization and input boundaries

- `backend/lib/nginx-privilege.js` compares the existing and proposed privileged configuration so delegated users may update ordinary settings without gaining raw Nginx or filesystem access.
- Proxy, redirect, dead-host, and stream create/update paths call this guard server-side.
- Domain, forward-host, and stream-host schemas reject whitespace and Nginx metacharacters and impose practical length limits.

### Runtime and supply chain

- `backend/lib/bounded-fetch.js` centralizes timed, size-bounded outbound reads.
- `rootfs/usr/local/bin/envs.sh` loads supported Docker/Kubernetes secret files and rejects ambiguous value-plus-file configuration.
- `compose.yaml` and `setup-npmplus.sh` provide safer fresh-deployment defaults.
- GitHub Actions use least-privilege permissions, reviewable upstream pull requests, non-publishing PR builds, and pinned tooling.

## Validation

The final verification completed successfully:

- Backend: 10/10 unit and security tests passed, including response-size limits, response-body timeout behavior, delegated Nginx-field enforcement, and fork update checks.
- Frontend: TypeScript project checking and the Vite production build passed.
- Supply chain: both production `pnpm audit` runs reported no known vulnerabilities, and both frozen-lockfile installs satisfy the seven-day release policy.
- Configuration: the OpenAPI schema, backend JSON schemas, all workflow YAML, Compose rendering, and Bash/POSIX shell syntax passed.
- Container image: a complete production Docker build passed, including the Nginx/AWS-LC compile and frontend build stages; the resulting image successfully ran its pinned Certbot, Nginx, Node.js, and pip executables.
- Migration: the OIDC uniqueness migration was exercised up/down against SQLite and rejected a duplicate identity as intended.
- Static analysis: Semgrep scanned tracked and newly created files. The secret scan reported zero findings. The JavaScript/TypeScript/OWASP scan found no actionable application or workflow issue after remediation; its remaining 16 alerts are the same generic Nginx `$host` rule in configured virtual-host redirects, upstream headers, TLS names, mapping, and logging. The default/unknown host now rejects requests, and configured domain inputs are constrained, so those occurrences were reviewed as non-actionable rather than suppressed.
- Repository hygiene: `git diff --check` passed.

## Residual operational guidance

- Keep port 81 bound to host loopback and administer through an SSH tunnel.
- Treat Docker access as root-equivalent even when application services drop privileges.
- DNS-challenge certificates install their provider plugin from PyPI on first use, matching upstream NPMplus; review that dependency when the deployment has strict egress controls.
- Review and merge the upstream-sync pull request only after CI and code review.
- Protect older backups made before setup script v1.16 because they may contain legacy inline bootstrap credentials.

This was a repository source/configuration review, not a live penetration test of a VM, registry, OIDC provider, firewall, or GitHub organization settings.
