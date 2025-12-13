# NPMplus

NPMplus is an advanced fork of Nginx Proxy Manager (NPM), providing a user-friendly web interface for managing Nginx reverse proxies with a strong focus on security, performance, and ease of use. It builds upon the solid foundation of Nginx Proxy Manager by integrating cutting-edge features such as HTTP/3 (QUIC) support, CrowdSec integration, ModSecurity (WAF), and enhanced TLS certificate management including OCSP Stapling.

This README aims to provide a comprehensive guide for setting up, configuring, and utilizing NPMplus effectively.

## Key Features

NPMplus extends the capabilities of the original Nginx Proxy Manager with the following significant enhancements:

*   **HTTP/3 (QUIC) Support:** Leverage the latest web protocol for faster, more efficient connections. Requires exposing HTTPS with UDP.
*   **CrowdSec Integration:** Enhanced security with IPS capabilities. See the [CrowdSec section](#crowdsec) for setup.
*   **ModSecurity (WAF) with CoreRuleSet:** Provides a Web Application Firewall for added protection. Configurable via `/opt/npmplus/modsecurity`.
*   **GoAccess Integration:** Real-time web log analyzer, enabled via `compose.yaml` and accessible by default on `https://<ip>:91`.
*   **Improved TLS Certificate Management:**
    *   Faster certificate creation by minimizing Nginx reloads.
    *   Supports OCSP Stapling/Must-Staple for enhanced security (manual certs not supported).
    *   Automatic cleaning of old, invalid Certbot certificates.
    *   Allows different ACME servers.
    *   ML-KEM support.
*   **Enhanced Nginx Configuration Options:**
    *   Load balancing capabilities (requires custom configuration).
    *   Only enables TLSv1.2 and TLSv1.3 protocols.
    *   HTTP/2 always enabled with fixed upload size.
    *   Allows infinite upload size (may be limited by ModSecurity).
    *   `Server` response header hidden by default.
    *   Basic security headers automatically added when HSTS is enabled.
    *   Option to load OpenAppSec attachment module.
    *   Punycode domain support.
*   **Administration & Usability:**
    *   Smaller Docker image based on Alpine Linux.
    *   Admin backend interface runs securely with HTTPS.
    *   Default page also runs with HTTPS.
    *   Option to change the default TLS certificate.
    *   Exposes internal backend API only to localhost.
    *   Automatic SQLite database vacuum.
    *   Password reset utility for SQLite databases.
    *   Many environment options optimized for `network_mode: host`.
    *   Improved regex checks for inputs.
    *   Merge of upstream OIDC PR.
    *   DNS secrets are now saved in the DB and rewritten on container start, no longer requiring external mounts.
    *   Numerous other small fixes and improvements.
*   **Logging:**
    *   `access.log` is disabled by default, unified, and moved to `/opt/npmplus/nginx/access.log`.
    *   Error Log written to console.
*   **PHP Support:** Optional PHP-FPM integration with ability to add extensions.

## Current Date and Time

This README was last updated on Saturday, December 13, 2025.



## Compatibility

*   **Supported Architectures:** `x86_64-v2/amd64v2` and `aarch64/arm64`. Older or 32-bit architectures are not supported due to compilation time.
*   **Database:** SQLite is recommended as it has no significant advantage over MariaDB/MySQL/PostgreSQL with NPMplus. Migration from other databases to SQLite is not straightforward and requires a fresh install.
*   **Admin Interface:** Always uses HTTPS.
*   **Cloudflare:** By default, NPMplus will not trust Cloudflare. Refer to [Notes on Cloudflare](#notes-on-cloudflare) before enabling `SKIP_IP_RANGES`.
*   **Certbot DNS Plugins:** `certbot-dns-he`, `certbot-dns-dnspod`, `certbot-dns-online`, and `certbot-dns-do` have been replaced. Certificates using these providers will need to be recreated.
*   **Docker/Podman:** Tested with Docker, Podman should also work. Running inside an LXC container is discouraged.

## Quick Setup

To get NPMplus up and running quickly using Docker Compose:

1.  **Prerequisites:**
    *   [Docker](https://docs.docker.com/engine/install)
    *   [Docker Compose](https://docs.docker.com/compose/install/linux)
2.  **Download `compose.yaml`:** Obtain the latest `compose.yaml` file from your repository:
    ```bash
    curl -o compose.yaml https://raw.githubusercontent.com/shedowe19/NPMplus/refs/heads/develop/compose.yaml
    ```
3.  **Configure Environment Variables:** Edit the `compose.yaml` file and adjust at least `TZ` (timezone) and `ACME_EMAIL` to your values. Review other uncommented environment variables as needed.
4.  **Start NPMplus:**
    ```bash
    docker compose up -d
    ```
5.  **Access Admin UI:** Once the container is running, access the admin interface via `https://<your-ip-or-domain>:81`.
    *   **Default Admin Email:** `admin@example.org`
    *   **Initial Password:** The unique initial password will be logged to your Docker logs (e.g., `docker logs npmplus`). Change it immediately after logging in.

## Migration from Upstream/Vanilla Nginx Proxy Manager

**NOTE: Migrating back to the original version is not possible. Always create a full backup before proceeding.**

1.  **Review Compatibility:** Read the [Compatibility section](#compatibility) carefully.
2.  **Backup Data:** Create a backup of your `/data` and `/etc/letsencrypt` folders.
3.  **Download `compose.yaml`:** Get the latest `compose.yaml` as described in [Quick Setup](#quick-setup).
4.  **Adjust Paths:** Update the volume paths in `compose.yaml` to match your existing `/data` and `/etc/letsencrypt` locations.
5.  **Configure Environment Variables:** Set `TZ` and `ACME_EMAIL`, and adjust any other relevant environment variables.
6.  **Stop Nginx Proxy Manager:** Stop your existing NPM container.
7.  **Deploy NPMplus:** Use `docker compose up -d` with the new `compose.yaml`.
8.  **Remove `/etc/letsencrypt` mount:** The `/etc/letsencrypt` mount is moved to `/data` during migration. After the initial deploy, remove the `/etc/letsencrypt` volume entry from `compose.yaml` and redeploy.
9.  **Verify Host Settings:** Due to changes, verify all settings for your existing hosts in the NPMplus UI.
10. **Update Proxy Scheme:** If you proxy NPMplus through itself, ensure the scheme is changed from HTTP to HTTPS.
11. **Consider CrowdSec:** Set up CrowdSec as described in the [CrowdSec section](#crowdsec).
12. **Report Issues:** Report any migration-related issues to this repository.

## CrowdSec

To enable CrowdSec IPS integration:

1.  **Install CrowdSec Collection:** Install CrowdSec and the `shedowe19/npmplus` collection. You can use the commented-out `crowdsec` service in `compose.yaml` as a starting point.
    *   Consider adding `crowdsecurity/http-dos` collection for additional protection (be aware of potential false positives).
2.  **Enable LOGROTATE:** Set `LOGROTATE` to `true` in your `compose.yaml` and redeploy.
3.  **Configure CrowdSec Acquisition:** Create or update `/opt/crowdsec/conf/acquis.d/npmplus.yaml` with the following content (adjust paths if necessary):
    ```yaml
    filenames:
      - /opt/npmplus/nginx/*.log
    labels:
      type: npmplus
    ---
    filenames:
      - /opt/npmplus/nginx/*.log
    labels:
      type: modsecurity
    ---
    listen_addr: 0.0.0.0:7422
    appsec_config: crowdsecurity/appsec-default
    name: appsec
    source: appsec
    labels:
      type: appsec
    # if you use openappsec you can enable this
    #---
    #source: file
    #filenames:
    # - /opt/openappsec/logs/cp-nano-http-transaction-handler.log*
    #labels:
    #  type: openappsec
    ```
4.  **Host Network Mode:** Ensure your NPMplus container uses `network_mode: host`.
5.  **Add CrowdSec Bouncer:** Run `docker exec crowdsec cscli bouncers add npmplus -o raw` and save the generated API key.
6.  **Configure `crowdsec.conf`:** Edit `/opt/npmplus/crowdsec/crowdsec.conf` (you may need to create this file) and set `ENABLED` to `true` and `API_KEY` to the value obtained in the previous step.
7.  **Redeploy:** Redeploy your `compose.yaml`.
8.  **Firewall Bouncer (Recommended):** For optimal protection, set up a firewall bouncer: [CrowdSec Firewall Bouncer](https://docs.crowdsec.net/u/bouncers/firewall). Remember to include Docker iptables in its configuration.
    *   **Privacy Note:** If you do not [disable sharing in CrowdSec](https://docs.crowdsec.net/docs/next/configuration/crowdsec_configuration/#sharing), you must disclose that signal metadata is sent to CrowdSec in your privacy policy.

## ModSecurity CoreRuleSet Plugins

1.  **Download Plugin Files:** Obtain all necessary plugin files (e.g., `-before.conf`, `-config.conf`, `-after.conf`, `.data`, `.lua`) from the plugin's repository.
2.  **Place in Directory:** Put these files into the `/opt/npmplus/modsecurity/crs-plugins` folder.
3.  **Configure Plugin:** Open and configure the `<plugin-name>-config.conf` file as required.

## PHP-FPM Integration

### External PHP-FPM (Recommended)

1.  **Create Proxy Host:** Create a new Proxy Host in the UI. Dummy data for `Scheme`, `Domain/IP/Path` can be used as they will be ignored.
2.  **Configure TLS:** Set up TLS as needed.
3.  **Advanced Configuration:** In the Advanced tab, add and adjust the following Nginx configuration:
    ```nginx
    location / {
        alias /var/www/<your-html-site-folder-name>/; # or use the "root" directive of the line below
        #root /var/www/<your-html-site-folder-name>; # or use the "alias" directive of the line above
        #fancyindex off; # alternative to nginx "index" option (looks better and has more options)
        location ~* \.php(?:$|/) {
          fastcgi_split_path_info ^(.*\.php)(/.*)$;
          try_files $fastcgi_script_name =404;
          fastcgi_pass ...; # set this to the address of your php-fpm (socket/tcp): https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html#fastcgi_pass
        }
    }
    ```

### Inbuilt PHP-FPM (Not Recommended)

1.  **Enable PHP in `compose.yaml`:** Uncomment and configure the `PHP82`, `PHP83`, or `PHP84` environment variables in your `compose.yaml` to activate PHP and add desired extensions.
2.  **Set Forwarding Port:** In the Proxy Host UI, set the forwarding port to the corresponding PHP version (e.g., 82, 83, 84).

## Load Balancing

1.  **Create Custom Nginx Config:** Edit `/opt/npmplus/custom_nginx/http_top.conf` (for HTTP) or `/opt/npmplus/custom_nginx/stream_top.conf` (for streams).
2.  **Define Upstream Servers:** Add your upstream directives as per Nginx documentation (e.g., `ngx_http_upstream_module` or `ngx_stream_upstream_module`).
    ```nginx
    # Example a: mixed ports, optional backup
    upstream server1 {
        server 127.0.0.1:44;
        server 127.0.0.1:33;
        server 127.0.0.1:22;
        server 192.158.168.11:44 backup;
    }
    # Example b: same port
    upstream service2 {
        server 192.158.168.14;
        server 192.158.168.13;
        server 192.158.168.12;
        server 192.158.168.11;
    }
    ```
3.  **Configure Proxy Host/Stream:** In the UI, set the hostname to your defined upstream name (e.g., `server1` or `service2`).
    *   For example `a`, leave the forward port empty.
    *   For example `b`, set the forward port.

## Prerun Scripts (Expert Option)

To execute scripts before NPMplus launches, create the `/opt/npmplus/prerun/` folder and place your shell scripts (`.sh`) within it. Ensure `#!/usr/bin/env sh` or `#!/usr/bin/env bash` is at the top of each script. Remember to set the `ENABLE_PRERUN` environment variable to `true` in `compose.yaml`.

## Examples of Services Using `auth_request`

NPMplus supports integration with various authentication providers using Nginx's `auth_request` module. Below are configuration examples for some popular services. Always adjust paths and domains to match your setup.

### Anubis

1.  **Anubis Environment:** Set the Anubis environment variable `TARGET` to a single space (` `). In your policy file, set `status_codes` for `CHALLENGE` to `401` and `DENY` to `403`.
2.  **Custom Location `/`:** In the advanced tab of your proxy host, add:
    ```nginx
    auth_request /.within.website/x/cmd/anubis/api/check;
    error_page 401 403 =200 /.within.website/?redir=$request_uri;
    ```
3.  **Custom Location `/.within.website`:** Create a new location proxying to your Anubis instance (e.g., `http://127.0.0.1:8923`), and in its advanced tab, add:
    ```nginx
    proxy_redirect ~^[^/]+/.*$ /;
    proxy_method GET;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    ```
4.  **Override Images (Optional):** To override default Anubis images (`happy.webp`, `pensive.webp`, `reject.webp`), create a custom location `/.within.website/x/cmd/anubis/static/img` that serves these files.

### TinyAuth

1.  **Custom Location `/`:** In the advanced tab of your proxy host, add:
    ```nginx
    auth_request /tinyauth;
    error_page 401 = @tinyauth_login;
    ```
2.  **Custom Location `/tinyauth`:** Create a new location proxying to your TinyAuth API endpoint (e.g., `http://<ip>:<port>/api/auth/nginx`), and in its advanced tab, add:
    ```nginx
    internal;
    proxy_method GET;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    ```
3.  **Advanced Config Tab:** Add the following, replacing `tinyauth.example.org` with your TinyAuth domain:
    ```nginx
    location @tinyauth_login {
      internal;
      return 302 http://tinyauth.example.org/login?redirect_uri=$scheme://$host$is_request_port$request_port$request_uri;
    }
    ```

### Authelia

1.  **Custom Location `/`:** In the advanced tab of your proxy host, add:
    ```nginx
    auth_request /internal/authelia/authz;
    auth_request_set $redirection_url $upstream_http_location;
    error_page 401 =302 $redirection_url;

    auth_request_set $user $upstream_http_remote_user;
    auth_request_set $groups $upstream_http_remote_groups;
    auth_request_set $name $upstream_http_remote_name;
    auth_request_set $email $upstream_http_remote_email;

    proxy_set_header Remote-User $user;
    proxy_set_header Remote-Groups $groups;
    proxy_set_header Remote-Email $email;
    proxy_set_header Remote-Name $name;
    ```
2.  **Custom Location `/internal/authelia/authz`:** Create a new location proxying to your Authelia API endpoint (e.g., `http://127.0.0.1:9091/api/authz/auth-request`), and in its advanced tab, add:
    ```nginx
    internal;
    proxy_method GET;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    ```

### Authentik

1.  **Custom Location `/`:** In the advanced tab of your proxy host, add (adjust last lines if needed):
    ```nginx
    auth_request /outpost.goauthentik.io/auth/nginx;
    error_page 401 = @goauthentik_proxy_signin;

    auth_request_set $auth_cookie $upstream_http_set_cookie;
    add_header Set-Cookie $auth_cookie;

    auth_request_set $authentik_username $upstream_http_x_authentik_username;
    auth_request_set $authentik_groups $upstream_http_x_authentik_groups;
    auth_request_set $authentik_entitlements $upstream_http_x_authentik_entitlements;
    auth_request_set $authentik_email $upstream_http_x_authentik_email;
    auth_request_set $authentik_name $upstream_http_x_authentik_name;
    auth_request_set $authentik_uid $upstream_http_x_authentik_uid;

    proxy_set_header X-authentik-username $authentik_username;
    proxy_set_header X-authentik-groups $authentik_groups;
    proxy_set_header X-authentik-entitlements $authentik_entitlements;
    proxy_set_header X-authentik-email $authentik_email;
    proxy_set_header X-authentik-name $authentik_name;
    proxy_set_header X-authentik-uid $authentik_uid;

    # This section should be uncommented when the "Send HTTP Basic authentication" option is enabled in the proxy provider
    #auth_request_set $authentik_auth $upstream_http_authorization;
    #proxy_set_header Authorization $authentik_auth;
    ```
2.  **Custom Location `/outpost.goauthentik.io`:** Create a new location proxying to your Authentik instance (e.g., `https://127.0.0.1:9443/outpost.goauthentik.io`), and in its advanced tab, add:
    ```nginx
    auth_request_set $auth_cookie $upstream_http_set_cookie;
    add_header Set-Cookie $auth_cookie;
    proxy_method GET;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    ```
3.  **Advanced Config Tab:** Add the following (adjust last lines if needed):
    ```nginx
    location @goauthentik_proxy_signin {
      internal;
      add_header Set-Cookie $auth_cookie;
      return 302 /outpost.goauthentik.io/start?rd=$request_uri;
      ## For domain level, use the below error_page to redirect to your authentik server with the full redirect path
      #return 302 https://authentik.company/outpost.goauthentik.io/start?rd=$scheme://$host$is_request_port$request_port$request_uri;
    }
    ```

## Notes on Cloudflare

It is generally **not recommended** to use Cloudflare proxy/tunnel in front of NPMplus (`users <=> Cloudflare <=> NPMplus`) due to several reasons:

*   **Man-in-the-Middle:** Cloudflare decrypts and re-encrypts traffic, acting as a man-in-the-middle, which impacts security and privacy.
*   **Performance & Optimization:** Many NPMplus optimizations (HTTP/3, TLS settings) will only apply between Cloudflare and NPMplus, not directly to your users.
*   **Overrides:** Cloudflare overrides Nginx configurations like headers (HSTS), HTTP/3, and TLS settings.
*   **File Upload Limits:** Cloudflare has a 100MB connection limit, which can cause issues with large file transfers.
*   **Increased Latency:** Data does not take a direct path, increasing connection time.
*   **Limited Protection:** Cloudflare primarily protects HTTP(S) traffic on 80/443; other protocols/ports are not protected. It also cannot protect if your real IP is known.
*   **Alternatives:** Consider CrowdSec for WAF, Anubis for AI web scrape protection, or Cloudflared tunnels for hiding your IP without NPMplus.

If you still choose to use Cloudflare proxy, ensure "SSL/TLS encryption" is set to "Full (strict)". Using Cloudflare as a DNS nameserver without proxying is generally fine.

## Hints for Your Privacy Policy

**Disclaimer: This is not legal advice. This section provides hints for identifying relevant areas for your privacy policy.**

1.  **Nginx Error Logs:** NPMplus writes Nginx error logs (level "warn" or higher) to Docker logs, which may contain user IPs. This should be mentioned.
2.  **LOGROTATE:** If `LOGROTATE` is enabled, access and error logs are written to disk (`/opt/npmplus/nginx/access.log`, `/opt/npmplus/nginx/stream.log`) and rotated. These contain user IPs and should be disclosed.
3.  **CrowdSec Sharing:** If CrowdSec sharing is *not* disabled, mention that signal metadata is sent to CrowdSec.
4.  **IP Blocking:** Disclose any IP blocking mechanisms used (access lists, GeoIP, CrowdSec).
5.  **GoAccess:** If GoAccess is enabled, it processes and saves access log statistics (including IPs) to disk. This should be mentioned.
6.  **PHP-FPM Logs:** If PHP-FPM is used, its error logs (containing user IPs) are written to Docker logs.
7.  **OpenAppSec:** If `NGINX_LOAD_OPENAPPSEC_ATTACHMENT_MODULE` is enabled, include information about OpenAppSec.
8.  **Custom Data Collection:** Any other user information collected via custom Nginx modules, Lua scripts, etc., must be mentioned.
9.  **Caddy Redirect Container:** If used, mention data collected by the Caddy HTTP to HTTPS redirect container.
10. **Anubis:** Refer to the Anubis impressum for their privacy policy (https://anubis.techaro.lol/docs/admin/configuration/impressum).
11. **Extra Configurations:** Any custom/advanced configurations related to user data should be mentioned.
12. **General Data Handling:** Include details about how your backend handles data, data storage, duration, analytics, etc.
13. **OCSP Requests:** Clients may send OCSP requests directly to Certificate Authorities. This is generally not required to be mentioned as no data is sent to you.
14. **Nameserver Data:** Information about data stored by nameservers is generally not required, as providers often act as proxies.

## What Connections Can Be Expected from the NPMplus Container?

The NPMplus container may initiate connections to:

*   Your clients
*   Your upstream services
*   ACME/OCSP servers
*   Gravatar (for profile pictures)
*   GitHub (for daily update checks)
*   PyPI (to download Certbot plugins, if used)
*   Your DNS provider (for ACME DNS challenges, if used)
*   www.site24x7.com (for reachability checks, if used)
*   Cloudflare (to download IP ranges, if enabled)
*   CrowdSec LAPI (if enabled)

## Contributing

All contributions are welcome! However, it is recommended to discuss your proposed changes via a GitHub Discussion before creating a Pull Request, especially for significant features, to ensure alignment with project goals. Typos and translation updates are exceptions.

## Getting Help

For support and assistance, please use the following channels:

1.  **Support/Questions:** [GitHub Discussions](https://github.com/shedowe19/NPMplus/discussions) (preferred)
2.  **Discord:** [NPMplus Discord Server](https://discord.gg/y8DhYhv427) (use the `#support-npmplus` forum channel)
3.  **Bugs/Feature Requests:** [GitHub Issues](https://github.com/shedowe19/NPMplus/issues) (for reproducible bugs and well-defined feature requests)
4.  **Reddit:** [r/NPMplus](https://reddit.com/r/NPMplus) (not recommended for primary support)

**Please report issues first to this fork before reporting them to the upstream repository.**