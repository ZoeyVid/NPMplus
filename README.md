# NPMplus - A fork of Nginx Proxy Manager
NPMplus is a user-friendly, all-in-one web-based interface that simplifies setting up an Nginx-based reverse proxy. It allows for quick configuration of access control lists and automatic SSL (via Let's Encrypt, ZeroSSL, etc.) without requiring extensive knowledge of Nginx or Linux administration. This tool is particularly useful for home lab environments, small businesses, and web developers who need an efficient way to deploy a performant reverse proxy.

<p align="center">
  <a href="#quick-setup">Quick Setup Guide</a><body> | </body><a href="#notes"> Frequently Asked Questions</a>
</p>

## Project Motivation
I started this project to make it incredibly easy for anyone to set up a reverse proxy with secure connections. The idea was to create something so simple that anyone could use it without difficulty. While there are some advanced features, they are optional. The main focus is on keeping things straightforward and accessible for everyone.

<!---
### Sponsor the original creator (not us):
<a href="https://www.buymeacoffee.com/jc21" target="_blank"><img src="http://public.jc21.com/github/by-me-a-coffee.png" alt="Buy Me A Coffee" style="height: 51px !important;width: 217px !important;" ></a>
--->


## Features
- Beautiful and Secure Admin Interface: Built on Tabler
- Effortless Setup: Create forwarding domains, redirects, streams, and 404 hosts with no Nginx knowledge required
- Free and Trusted TLS Certificates: Use Certbot (Let's Encrypt/other CAs) or upload - your own custom certificates
- Access Control: Implement Access Lists and basic HTTP Authentication for your hosts
- Advanced Configuration: Optional advanced Nginx settings for experienced users
- User Management: Manage users, set permissions, and view audit logs

# List of New Features in NPMplus
- **HTTP/3 (QUIC) Protocol Support**: Improves connection speed and security.
- **CrowdSec IPS Compatibility**: Easily enable CrowdSec by following the [setup guide](https://github.com/ZoeyVid/NPMplus#crowdsec).
- **GoAccess Integration**: Included by default and accessible at `https://<ip>:91`. Enable via `compose.yaml`. Nginx configuration available [here](https://github.com/xavier-hernandez/goaccess-for-nginxproxymanager/blob/main/resources/nginx/nginx.conf).
- **ModSecurity with Core Rule Set (CRS)**: Advanced web application firewall capabilities.
  - Customize ModSecurity and CRS settings by editing files in `/opt/npm/etc/modsecurity`.
  - Review and adjust `/opt/npm/etc/modsecurity/crs-setup.conf` if valid requests are blocked.
  - Whitelist specific `Content-Type` headers (e.g., `application/activity+json` for Mastodon, `application/dns-message` for DoH).
  - Whitelist HTTP request methods as needed (e.g., `PUT` is blocked by default, which may impact NPM functionality).
- **Dark Mode**: Toggle dark mode via the footer for comfortable viewing (CSS by [@theraw](https://github.com/theraw)).
- **Improved Proxy Support**: Fixes proxy to HTTPS origin when only TLSv1.3 is accepted by the origin.
- **Enhanced TLS Support**: Only enables TLSv1.2 and TLSv1.3 protocols.
- **Faster TLS Certificate Creation**: Optimized by eliminating unnecessary Nginx reloads and configuration creations.
- **OCSP Stapling for Enhanced Security**: Upload custom CA/Intermediate certificates (`chain.pem`) to `/opt/npm/tls/custom/npm-[certificate-id]` for manual migration if needed.
- **DNSPod Plugin Issue Resolved**: For manual migration, delete all DNSPod certificates and recreate them, or update the credentials file as per the template [here](https://github.com/ZoeyVid/NPMplus/blob/develop/global/certbot-dns-plugins.js).
- **Smaller Docker Image**: Now based on an Alpine distribution.
- **HTTPS by Default**: The admin backend interface and default page both run on HTTPS.
- **Fancyindex Support**: Uses [fancyindex](https://gitHub.com/Naereen/Nginx-Fancyindex-Theme) if used as a web server.
- **Exposed API**: INTERNAL backend API is only exposed to localhost.
- **Basic Security Headers**: Automatically added when HSTS is enabled (HSTS includes subdomains and preload).
- **Optimized Logging**: `access.log` is disabled by default, unified, and moved to `/opt/npm/nginx/access.log`. Error logs are written to the console.
- **Security Enhancements**: `Server` response header is hidden.
- **PHP Support**: PHP 8.2/8.3 optional with the ability to add extensions. Available packages can be added using environment variables in the compose file.
- **Custom ACME Servers**: Allows configuration via `/opt/npm/tls/certbot/config.ini`.
- **Domain Support**: Supports up to 99 domains per certificate.
- **Brotli Compression**: Can be enabled for improved compression performance.
- **HTTP/2**: Always enabled with fixed upload handling.
- **Unlimited Upload Size**: No restrictions on upload size.
- **Automatic Database Maintenance**: Includes automatic vacuuming (only for SQLite).
- **Certbot Management**: Automatically cleans old Certbot certificates (set `FULLCLEAN` to true).
- **Password Reset**: Reset passwords (only for SQLite) using `docker exec -it npmplus password-reset.js USER_EMAIL PASSWORD`.
- **MariaDB/MySQL TLS Support**: Set `DB_MYSQL_TLS` environment variable to true. Upload self-signed certificates to `/opt/npm/etc/npm/ca.crt` and set `DB_MYSQL_CA` to `/data/etc/npm/ca.crt` (not tested, unsupported).
- **PUID/PGID Support**: In network mode host, add `net.ipv4.ip_unprivileged_port_start=0` at the end of `/etc/sysctl.conf`.
- **IP Binding Options**: Supports setting IP bindings for multiple instances in network mode host.
- **Backend Port Customization**: Option to change the backend port.
- **Compose File Options**: Refer to the compose file for all available options.
- **HTTP to HTTPS Redirection**: Use the `compose.override.yaml` file to redirect all HTTP traffic to HTTPS.

## Migration from Nginx Proxy Manager to NPMplus
**Important:** Migrating back to the original Nginx Proxy Manager is not possible. **Make sure to create a backup** before migrating, so you can revert if necessary.
1. **Custom Certificates:** If you use custom certificates, upload the CA/Intermediate Certificate (named `chain.pem`) to the `/opt/npm/tls/custom/npm-[certificate-id]` folder.
2. **UI Changes:** Some buttons may have changed; verify their functionality after migration.
3. **DNSPod Certificates:** Delete all DNSPod certificates and recreate them, or manually update the credentials file using the template [here](https://github.com/ZoeyVid/npmplus/blob/develop/global/certbot-dns-plugins.js).
4. **Network Mode Dependency:** This fork depends on `network_mode: host`. Ensure ports 80/tcp, 443/tcp, and 443/udp (and possibly 81/tcp) are open in your firewall.
5. **Healthcheck Configuration:** If you have a healthcheck defined in your `compose.yaml` file, remove it. This fork includes its own healthcheck in the Dockerfile, so it’s no longer necessary to define it in `compose`.

# CrowdSec Setup Guide
1. **Install CrowdSec**: Use the provided [compose file](https://github.com/ZoeyVid/NPMplus/blob/develop/compose.crowdsec.yaml) and enable `LOGROTATE`.
2. **Configure CrowdSec**:
   - Open `/opt/crowdsec/conf/acquis.d/npmplus.yaml`.
   - Fill it with the following configuration:

   ```yaml
   filenames:
     - /opt/npm/nginx/access.log
   labels:
     type: npmplus
   ---
   source: docker
   container_name:
     - npmplus
   labels:
     type: npmplus
   ---
   source: docker
   container_name:
     - npmplus
   labels:
     type: modsecurity
   ---
   listen_addr: 0.0.0.0:7422
   appsec_config: crowdsecurity/appsec-default
   name: appsec
   source: appsec
   labels:
     type: appsec
   ```
3. **Ensure Network Configuration**: Use `network_mode: host` in your compose file.
4. **Generate API Key**:
   - Run the command `docker exec crowdsec cscli bouncers add npmplus -o raw`.
   - Save the output for later use.
5. **Update CrowdSec Configuration**:
   - Open `/opt/npm/etc/crowdsec/crowdsec.conf`.
   - Set `ENABLED` to `true`.
   - Use the API key from step 4 as the `API_KEY`.
   - Save the file.
6. **Enable LOGROTATE**: Set `LOGROTATE` to `true` in your `compose.yaml`.
7. **Redeploy**: Redeploy your `compose.yaml` to apply the changes.

# Core Rule Set (CRS) Plugins Setup
1. **Download the Plugin**:
   - Download all necessary files from the `plugins` folder of the plugin's Git repository. Typically, this includes:
     - `<plugin-name>-before.conf`
     - `<plugin-name>-config.conf`
     - `<plugin-name>-after.conf`
   - Additional files may include:
     - `<plugin-name>.data`
     - `<plugin-name>.lua`
     - Or similar files.
2. **Place Files in the Correct Directory**:
   - Copy the downloaded files into the `/opt/npm/etc/modsecurity/crs-plugins` folder.
3. **Configure the Plugin** (if necessary):
   - Open `/opt/npm/etc/modsecurity/crs-plugins/<plugin-name>-config.conf`.
   - Edit the configuration file to customize the plugin settings as needed.
   
# Use as Web Server
1. **Create a New Proxy Host**:
   - Go to the Proxy Host creation page.
   - Set the following values:
     - `Scheme`: `https`
     - `Forward Hostname / IP`: `0.0.0.0`
     - `Forward Port`: `1`
   - Enable `Websockets Support`.
   - *Note:* The specific values for the hostname, IP, and port are placeholders and are ignored in this setup.
2. **Set Access Controls** (Optional):
   - Configure an Access List if needed.
3. **Configure TLS Settings**:
   - Set your desired TLS options to secure the connection.
4. **Custom Nginx Configuration**:
   - In the Advanced tab, add custom Nginx configuration depending on your needs:
   **a) File Server Configuration**:
   - Use this configuration if you only need to serve static files:
     - *Note:* The trailing slash at the end of the file path is crucial.
   
   ```nginx
   location / {
       include conf.d/include/always.conf;
       alias /var/www/<your-html-site-folder-name>/;
       fancyindex off; # An alternative to Nginx's "index" option for better appearance and more options.
   }
   ```
   **b) File Server with PHP Support**:
   - Use this configuration if you need to serve PHP files:
     - *Note:* The trailing slash at the end of the file path is crucial.
     - *Note:* Ensure that `PHP82` and/or `PHP83` are enabled in your compose file.
     - *Note:* You can switch between `fastcgi_pass php82;` and `fastcgi_pass php83;` depending on your PHP version.
     - *Note:* To add more PHP extensions, use environment variables in the compose file.

   ```nginx
   location / {
       include conf.d/include/always.conf;
       alias /var/www/<your-html-site-folder-name>/;
       fancyindex off; # An alternative to Nginx's "index" option for better appearance and more options.

       location ~ [^/]\.php(/|$) {
           fastcgi_pass php82;
           fastcgi_split_path_info ^(.+?\.php)(/.*)$;
           if (!-f $document_root$fastcgi_script_name) {
               return 404;
           }
       }
   }
   ```

# Custom ACME Server Configuration
1. **Open the Configuration File**:
   - Open the Certbot configuration file with the following command:
     ```bash
     nano /opt/npm/ssl/certbot/config.ini
     ```
2. **Set the ACME Server**:
   - Uncomment the `server` line in the file.
   - Replace the existing server URL with your desired ACME server.
3. **Optional: Set EAB (External Account Binding) Keys**:
   - If your ACME server requires EAB keys, configure them in the same file.
4. **Create the Certificate**:
   - Use the NPM web UI to create your certificate using the newly configured ACME server.

# Quick Setup

1. **Install Docker and Docker Compose (or Portainer)**:
   - Follow the official documentation for installation:
     - [Docker Install Documentation](https://docs.docker.com/engine)
     - [Docker Compose Install Documentation](https://docs.docker.com/compose/install/linux)

2. **Create a `compose.yaml` File**:
   - Create a `compose.yaml` file similar to [this example](https://github.com/ZoeyVid/NPMplus/blob/develop/compose.yaml).
   - Alternatively, you can use this file as a Portainer stack.

3. **Deploy the Stack**:
   - If using Docker Compose, bring up your stack with the following command:
     ```bash
     docker compose up -d
     ```
   - If using Portainer, deploy your stack accordingly.

4. **Log in to the Admin UI**:
   - Once your Docker container is running, connect to the admin interface on port `81`.
   - Sometimes the initial setup may take a bit longer due to key generation.
   - Ensure port 81 is open in your firewall, and you may need to use a different IP address if necessary.
   - Access the admin interface at: [https://127.0.0.1:81](https://127.0.0.1:81)

   **Default Admin User**:
   ```
   Email:    admin@example.com
   Password: iArhP1j7p1P6TA92FA2FMbbUGYqwcYzxC4AVEe12Wbi94FY9gNN62aKyF1shrvG4NycjjX9KfmDQiwkLZH1ZDR9xMjiG2QmoHXi
   ```

   - Upon first login, you will be prompted to update your details and change your password.

### Prerun Scripts (EXPERT Option)

**If you don't know what this is, you can safely ignore it.**

**Run Order**: `entrypoint.sh` (prerun scripts) → `start.sh` → `launch.sh`

If you need to run custom scripts before NPMplus launches, place them in the following directory: `/opt/npm/etc/prerun/*.sh`.

- **Script Requirements**:
  - Make sure each script begins with the appropriate shebang: `#!/bin/sh` or `#!/bin/bash`.
  
- **Folder Creation**:
  - You must create the `/opt/npm/etc/prerun/` folder yourself if it doesn't already exist.
  
- **Important Note**:
  - Support for creating these scripts or patches is not provided. If you require prerun scripts, it's assumed you have the necessary expertise to create them on your own.

## Contributing
All are welcome to create pull requests for this project, against the `develop` branch.
CI is used in this project. All PR's must pass before being considered. After passing,
docker builds for PR's are available on ghcr for manual verifications.

## A thanks for supporting the project
This is a project forked from an older project called Nginx Proxy Manager, please go and support them below.
- Special thanks to [contributors of the Upstream project](https://github.com/NginxProxyManager/nginx-proxy-manager/graphs/contributors).
- If you want to sponsor them, please see [here](https://github.com/NginxProxyManager/nginx-proxy-manager/blob/master/README.md).

# Reporting Bugs
## Getting Support
- [Found a bug?](https://github.com/ZoeyVid/NPMplus/issues)
- [Discussions](https://github.com/ZoeyVid/NPMplus/discussions)

# Notes
- **Note:** Reloading the NPMplus UI can cause a 502 error. See https://github.com/ZoeyVid/NPMplus/issues/241. <br>
- **Note:** NO armv7, route53 and aws cloudfront ip ranges support. <br>
- **Note:** add `net.ipv4.ip_unprivileged_port_start=0` at the end of `/etc/sysctl.conf` to support PUID/PGID in network mode host. <br>
- **Note:** If you don't use network mode host, which I don't recommend, don't forget to expose port 443 on tcp AND udp (http3/quic needs udp). <br>
- **Note:** If you don't use network mode host, which I don't recommend, don't forget to enable IPv6 in - Docker, see [here](https://github.com/nextcloud/all-in-one/blob/main/docker-ipv6-support.md), you only need to follow step one and two before deploying NPMplus! <br>
- **Note:** Don't forget to open Port 80 (tcp) and 443 (tcp AND udp, http3/quic needs udp) in your - firewall (because of network mode host, you also need to open this ports in ufw, if you use ufw). <br>
- **Note:** ModSecurity overblocking (403 Error)? Please see `/opt/npm/etc/modsecurity`, if you also use CRS please see [here](https://coreruleset.org/docs/concepts/false_positives_tuning). <br>
- **Note:** Other Databases like MariaDB may work, but are unsupported. <br>
- **Note:** access.log/stream.log, logrotate and goaccess are NOT enabled by default bceuase of GDPR, you can enable them in the compose.yaml. <br>

