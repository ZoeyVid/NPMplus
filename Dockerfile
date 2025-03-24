# syntax=docker/dockerfile:labs
FROM --platform="$BUILDPLATFORM" alpine:3.21.3 AS crowdsec
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
ARG CSNB_VER=v1.0.8
WORKDIR /src
RUN apk upgrade --no-cache -a && \
    apk add --no-cache ca-certificates git build-base && \
    git clone --recursive https://github.com/crowdsecurity/cs-nginx-bouncer --branch "$CSNB_VER" /src && \
    make && \
    tar xzf crowdsec-nginx-bouncer.tgz && \
    mv crowdsec-nginx-bouncer-* crowdsec-nginx-bouncer && \
    sed -i "/lua_package_path/d" /src/crowdsec-nginx-bouncer/nginx/crowdsec_nginx.conf && \
    sed -i "s|/etc/crowdsec/bouncers/crowdsec-nginx-bouncer.conf|/data/etc/crowdsec/crowdsec.conf|g" /src/crowdsec-nginx-bouncer/nginx/crowdsec_nginx.conf && \
    sed -i "s|API_KEY=.*|API_KEY=|g" /src/crowdsec-nginx-bouncer/lua-mod/config_example.conf && \
    sed -i "s|ENABLED=.*|ENABLED=false|g" /src/crowdsec-nginx-bouncer/lua-mod/config_example.conf && \
    sed -i "s|API_URL=.*|API_URL=http://127.0.0.1:8080|g" /src/crowdsec-nginx-bouncer/lua-mod/config_example.conf && \
    sed -i "s|BAN_TEMPLATE_PATH=.*|BAN_TEMPLATE_PATH=/data/etc/crowdsec/ban.html|g" /src/crowdsec-nginx-bouncer/lua-mod/config_example.conf && \
    sed -i "s|CAPTCHA_TEMPLATE_PATH=.*|CAPTCHA_TEMPLATE_PATH=/data/etc/crowdsec/captcha.html|g" /src/crowdsec-nginx-bouncer/lua-mod/config_example.conf && \
    echo "APPSEC_URL=http://127.0.0.1:7422" | tee -a /src/crowdsec-nginx-bouncer/lua-mod/config_example.conf && \
    echo "APPSEC_FAILURE_ACTION=deny" | tee -a /src/crowdsec-nginx-bouncer/lua-mod/config_example.conf && \
    sed -i "s|BOUNCING_ON_TYPE=all|BOUNCING_ON_TYPE=ban|g" /src/crowdsec-nginx-bouncer/lua-mod/config_example.conf


FROM zoeyvid/nginx-quic:468-python
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]
COPY rootfs /
COPY src    /app/src

COPY --from=zoeyvid/valkey-static:41 /usr/local/bin/valkey-cli    /usr/local/bin/valkey-cli
COPY --from=zoeyvid/valkey-static:41 /usr/local/bin/valkey-server /usr/local/bin/valkey-server

ARG CRS_VER=v4.7.0
RUN apk upgrade --no-cache -a && \
    apk add --no-cache ca-certificates tzdata tini curl \
    bash nano \
    logrotate apache2-utils \
    lua5.1-lzlib lua5.1-socket \
    coreutils grep findutils jq shadow su-exec fcgi \
    luarocks5.1 lua5.1-dev lua5.1-sec build-base git \
    php83-fpm php83-openssl php83-iconv php83-ctype php83-curl php83-session php83-sqlite3 php83-pecl-redis && \
    \
    cp -var /etc/php83 /etc/php && \
    sed -i "s|;\?listen\s*=.*|listen = /run/php.sock|g" /etc/php/php-fpm.d/www.conf && \
    sed -i "s|;\?error_log\s*=.*|error_log = /proc/self/fd/2|g" /etc/php/php-fpm.conf && \
    sed -i "s|;\?include\s*=.*|include = /etc/php/php-fpm.d/*.conf|g" /etc/php/php-fpm.conf && \
    sed -i "s|;\?session.save_handler\s*=.*|session.save_handler = redis|g" /etc/php/php.ini && \
    sed -i "s|;\?session.save_path\s*=.*|session.save_path = unix:///run/valkey.sock|g" /etc/php/php.ini && \
    sed -i "s|;\?session.name\s*=.*|session.name = NPMPLUSSESSIONID|g" /etc/php/php.ini && \
    sed -i "s|;\?session.auto_start\s*=.*|session.auto_start = 1|g" /etc/php/php.ini && \
    sed -i "s|;\?session.use_strict_mode\s*=.*|session.use_strict_mode = 1|g" /etc/php/php.ini && \
    sed -i "s|;\?session.cookie_secure\s*=.*|session.cookie_secure = 1|g" /etc/php/php.ini && \
    sed -i "s|;\?session.cookie_httponly\s*=.*|session.cookie_httponly = 1|g" /etc/php/php.ini && \
    sed -i "s|;\?session.cookie_samesite\s*=.*|session.cookie_samesite = Strict|g" /etc/php/php.ini && \
    \
    mv -v /app/src/config.php.example /app/src/config.php && \
    \
    curl https://raw.githubusercontent.com/acmesh-official/acme.sh/master/acme.sh | sh -s -- --install-online --home /usr/local/acme.sh --nocron && \
    ln -s /usr/local/acme.sh/acme.sh /usr/local/bin/acme.sh && \
    \
    curl https://raw.githubusercontent.com/tomwassenberg/certbot-ocsp-fetcher/refs/heads/main/certbot-ocsp-fetcher -o /usr/local/bin/certbot-ocsp-fetcher.sh && \
    chmod +x /usr/local/bin/certbot-ocsp-fetcher.sh && \
    \
    git clone https://github.com/coreruleset/coreruleset --branch "$CRS_VER" /tmp/coreruleset && \
    mkdir -v /usr/local/nginx/conf/conf.d/include/coreruleset && \
    mv -v /tmp/coreruleset/crs-setup.conf.example /usr/local/nginx/conf/conf.d/include/coreruleset/crs-setup.conf.example && \
    mv -v /tmp/coreruleset/plugins /usr/local/nginx/conf/conf.d/include/coreruleset/plugins && \
    mv -v /tmp/coreruleset/rules /usr/local/nginx/conf/conf.d/include/coreruleset/rules && \
    rm -r /tmp/* && \
    \
    luarocks-5.1 install lua-cjson && \
    luarocks-5.1 install lua-resty-http && \
    luarocks-5.1 install lua-resty-string && \
    luarocks-5.1 install lua-resty-openssl && \
    \
    apk del --no-cache luarocks5.1 lua5.1-dev lua5.1-sec build-base git

COPY --from=crowdsec /src/crowdsec-nginx-bouncer/lua-mod/lib/plugins            /usr/local/nginx/lib/lua/plugins
COPY --from=crowdsec /src/crowdsec-nginx-bouncer/lua-mod/lib/crowdsec.lua       /usr/local/nginx/lib/lua/crowdsec.lua
COPY --from=crowdsec /src/crowdsec-nginx-bouncer/lua-mod/templates/ban.html     /usr/local/nginx/conf/conf.d/include/ban.html
COPY --from=crowdsec /src/crowdsec-nginx-bouncer/lua-mod/templates/captcha.html /usr/local/nginx/conf/conf.d/include/captcha.html
COPY --from=crowdsec /src/crowdsec-nginx-bouncer/lua-mod/config_example.conf    /usr/local/nginx/conf/conf.d/include/crowdsec.conf
COPY --from=crowdsec /src/crowdsec-nginx-bouncer/nginx/crowdsec_nginx.conf      /usr/local/nginx/conf/conf.d/include/crowdsec_nginx.conf

# todo move to ui
ENV PUID=0 \
    PGID=0 \
    GOAIWSP=48683 \
    NPM_PORT=81 \
    GOA_PORT=91 \
    IPV4_BINDING=0.0.0.0 \
    NPM_IPV4_BINDING=0.0.0.0 \
    GOA_IPV4_BINDING=0.0.0.0 \
    IPV6_BINDING=[::] \
    NPM_IPV6_BINDING=[::] \
    GOA_IPV6_BINDING=[::] \
    DISABLE_IPV6=false \
    NPM_DISABLE_IPV6=false \
    GOA_DISABLE_IPV6=false \
    NPM_LISTEN_LOCALHOST=false \
    GOA_LISTEN_LOCALHOST=false \
    DEFAULT_CERT_ID=0 \
    DISABLE_HTTP=false \
    DISABLE_H3_QUIC=false \
    NGINX_ACCESS_LOG=false \
    NGINX_LOG_NOT_FOUND=false \
    NGINX_404_REDIRECT=false \
    NGINX_DISABLE_PROXY_BUFFERING=false \
    DISABLE_NGINX_BEAUTIFIER=false \
    CLEAN=true \
    FULLCLEAN=false \
    SKIP_IP_RANGES=false \
    LOGROTATE=false \
    LOGROTATIONS=3 \
    CRT=24 \
    IPRT=1 \
    GOA=false \
    GOACLA="--agent-list --real-os --double-decode --anonymize-ip --anonymize-level=1 --keep-last=30 --with-output-resolver --no-query-string" \
    PHP82=false \
    PHP83=false

LABEL com.centurylinklabs.watchtower.monitor-only="true"
ENTRYPOINT ["tini", "--", "entrypoint.sh"]
HEALTHCHECK CMD healthcheck.sh
EXPOSE 80/tcp
EXPOSE 81/tcp
EXPOSE 443/tcp
EXPOSE 443/udp
