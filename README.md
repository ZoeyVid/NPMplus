NPMplus

This project comes as a pre-built docker image which enables you to easily and safely expose  your websites running at home or otherwise, including free TLS, without having to know too much about Nginx or Certbot. This fork also adds many new features in comparison to the upstream NPM.

Important Notes

Reloading the NPMplus UI can cause a 502 error. See #241.

NO armv7 and route53 support.

Add net.ipv4.ip_unprivileged_port_start=0 at the end of /etc/sysctl.conf to support PUID/PGID in network mode host.

If you don't use network mode host, which I don't recommend, don't forget to expose port 443 on TCP AND UDP (http3/quic needs UDP).

If you don't use network mode host, which I don't recommend, don't forget to enable IPv6 in Docker, see here, you only need to edit the daemon.json and restart docker, if you use the bridge network, otherwise please enable IPv6 in your custom docker network!

Don't forget to open Port 80 (TCP) and 443 (TCP AND UDP, http3/quic needs UDP) in your firewall (because of network mode host, you also need to open this ports in ufw, if you use ufw).

ModSecurity overblocking (403 Error)? Please see /opt/npm/etc/modsecurity, if you also use CRS, please see here.

Internal/LAN Instance? Please disable must-staple in /opt/npm/tls/certbot/config.ini.

Other Databases like MariaDB may work, but are unsupported.

Access.log, logrotate and goaccess are NOT enabled by default because of GDPR.

Project Goal

I created this project to fill a personal need to provide users with an easy way to accomplish reverse proxying hosts with TLS termination, and it had to be so easy that a monkey could do it. This goal hasn't changed. While there might be advanced options, they are optional and the project should be as simple as possible so that the barrier for entry here is low.

Features

Beautiful and Secure Admin Interface based on Tabler

Easily create forwarding domains, redirections, streams and 404 hosts without knowing anything about Nginx

Free trusted TLS certificates using Certbot (Let's Encrypt/other CAs) or provide your own custom TLS certificates

Access Lists and basic HTTP Authentication for your hosts

Advanced Nginx configuration available for superusers

User management, permissions, and audit log

Advantages over standard Nginx Proxy Manager:

List of new features

Supports HTTP/3 (QUIC) protocol.

Supports CrowdSec IPS (Intrusion Prevention System). Please see here to enable it.

Goaccess included, see compose.yaml (nginx config from here)

Supports ModSecurity (Web Application Firewall), with coreruleset as an option. 

You can configure ModSecurity/coreruleset by editing the files in the /opt/npm/etc/modsecurity folder. 

If the core ruleset blocks valid requests, please check the /opt/npm/etc/modsecurity/crs-setup.conf file.

Try to whitelist the Content-Type you are sending (for example, application/activity+json for Mastodon and application/dns-message for DoH).

Try to whitelist the HTTP request method you are using (for example, PUT is blocked by default, which also affects NPM).

Note: To fix this issue, instead of running nginx -s reload, this fork stops nginx and starts it again. This will result in a 502 error when you update your hosts. See #296 and #283.

Dark mode button in the footer for comfortable viewing (CSS by @theraw)

Fixes proxy to HTTPS origin when the origin only accepts TLSv1.3

Only enables TLSv1.2 and TLSv1.3 protocols

Faster creation of TLS certificates can be achieved by eliminating unnecessary Nginx reloads and configuration creations.

Uses OCSP Stapling for enhanced security 

If using custom certificates, upload the CA/Intermediate Certificate (file name: chain.pem) in the /opt/npm/tls/custom/npm-[certificate-id] folder (manual migration may be needed)

Resolved dnspod plugin issue 

To migrate manually, delete all dnspod certs and recreate them OR change the credentials file as per the template given here

Smaller docker image with alpine-based distribution

Admin backend interface runs with HTTPS

Default page also runs with HTTPS

Uses fancyindex if used as webserver

Exposes INTERNAL backend API only to localhost

Basic security headers are added if you enable HSTS (HSTS has always subdomains and preload enabled)

access.log is disabled by default, unified and moved to /opt/npm/nginx/access.log

Error Log written to console

Server response header hidden

PHP 8.1/8.2/8.3 optional, with option to add extensions; available packages can be added using envs in the compose file

Allows different acme servers/certbot config file (/opt/npm/tls/certbot/config.ini)

Supports up to 99 domains per cert

Brotli compression can be enabled

HTTP/2 always enabled with fixed upload

Allows infinite upload size

Automatic database vacuum (only SQLite)

Automatic cleaning of old certbot certs (set FULLCLEAN to true)

Supports TLS for MariaDB/MySQL; set DB_MYSQL_TLS env to true. Self-signed certificates can be uploaded to /opt/npm/etc/npm/ca.crt and DB_MYSQL_CA set to /data/etc/npm/ca.crt (not tested, unsupported)

Supports PUID/PGID in network mode host; add net.ipv4.ip_unprivileged_port_start=0 at the end of /etc/sysctl.conf

Option to set IP bindings for multiple instances in network mode host

Option to change backend port

See the docker compose file for all available environment options

If you want to redirect all HTTP traffic to HTTPS, you can use the compose.override.yaml file.

Changes in upstream will be merged.

Quick Setup

Install Docker and Docker Compose (or portainer)

Docker Install documentation

Docker Compose Install documentation

Create a compose.yaml file similar to this (or use it as a portainer stack):

Bring up your stack by running (or deploy your portainer stack)

docker compose up -d

Log in to the Admin UI

When your docker container is running, connect to it on port 81 for the admin interface. Sometimes this can take a bit because of the entropy of keys. You may need to open port 81 in your firewall. You may need to use another IP-Address.

https://127.0.0.1:81

Default Admin User:

Email:    admin@example.com
Password: iArhP1j7p1P6TA92FA2FMbbUGYqwcYzxC4AVEe12Wbi94FY9gNN62aKyF1shrvG4NycjjX9KfmDQiwkLZH1ZDR9xMjiG2QmoHXi

Crowdsec (Recommended)

Install crowdsec using this compose file: https://github.com/ZoeyVid/NPMplus/blob/develop/compose.crowdsec.yaml

Make sure to use network_mode: host in your compose file

Run docker exec crowdsec cscli bouncers add npmplus -o raw and save the output

Type nano /opt/npm/etc/crowdsec/crowdsec.conf

Set ENABLED to true

Use the output of step 3 as API_KEY

Make sure API_URL is set to http://127.0.0.1:8080

Save the file

Restart NPMplus

Goaccess (Optional)

Open this file: nano compose.yaml

Uncomment the environment variable "GOA_IPV4_BINDING=127.0.0.1" and/or "IPV6_BINDING=[::1]" as required

Use as web server

Create a new Proxy Host

Set Scheme to https, Forward Hostname / IP to 0.0.0.0, Forward Port to 1 and enable Websockets Support (you can also use other values, since these get fully ignored)

Maybe set an Access List

Make your TLS Settings


a) Custom Nginx Configuration (advanced tab), which looks the following for file server:

Note: the slash at the end of the file path is important

location / {
    alias /var/www/<your-html-site-folder-name>/;
}

b) Custom Nginx Configuration (advanced tab), which looks the following for file server and php:

Note: the slash at the end of the file path is important

Note: first enable PHP81 and/or PHP82 inside your compose file

Note: you can replace fastcgi_pass php82; with fastcgi_pass php81/php82 ;

Note: to add more PHP extension, use the packages from here and add them using the PHP_APKS env (see compose file)

location / {
    alias /var/www/<your-html-site-folder-name>/;

    location ~ [^/]\.php(/|$) {
        fastcgi_pass php82;
        fastcgi_split_path_info ^(.+?\.php)(/.*)$;
        if (!-f $document_root$fastcgi_script_name) {
            return 404;
        }
    }
}

Custom Acme Server

Open this file: nano /opt/npm/ssl/certbot/config.ini

Uncomment the server line and change it to your acme server

Maybe set eab keys

Create your cert using the NPMplus web UI

FAQ

I have forgotten my password, how do I reset it?

Password reset (only SQLite) using docker exec -it npmplus password-reset.js USER_EMAIL PASSWORD

Roadmap

Maybe Redis and/or SQL databases built in

Much more on the horizon

Migration

NOTE: Migrating back to the original is not possible, so make first a backup before migration, so you can use the backup to switch back

If you use custom certificates, you need to upload the CA/Intermediate Certificate (file name: chain.pem) in the /opt/npm/tls/custom/npm-[certificate-id] folder

Some buttons in NPMplus are different from the original NPM, it is recommended to check if they are still correct

Please delete all dnspod certs and recreate them, OR you manually change the credentials file (see here for the template)

Since this fork has dependency on network_mode: host, please don't forget to open port 80 and 443 (and maybe 81) in your firewall

Contributing

All are welcome to create pull requests for this project, against the develop branch.

CI is used in this project. All PR's must pass before being considered. After passing, docker builds for PR's are available on ghcr for manual verifications.

Contributors/Sponsor upstream NPM

Special thanks to all of our contributors. If you want to sponsor them, please see here.

Please report Bugs first to this fork before reporting them to the upstream Repository

Getting Support

Found a bug?

Discussions

