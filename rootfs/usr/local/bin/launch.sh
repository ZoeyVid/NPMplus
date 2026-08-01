#!/usr/bin/env sh

echo "
-------------------------------------
PUID:     $PUID
User ID:  $(id -u)
PGID:     $PGID
Group ID: $(id -g)
-------------------------------------
"

if [ -z "$(find /data/tls/certbot/accounts/"$(echo "$ACME_SERVER" | sed "s|^https\?://\([^/]\+\).*$|\1|g")" -type f 2> /dev/null)" ]; then
    if [ "$(echo "$ACME_SERVER" | sed "s|^https\?://\([^/]\+\).*$|\1|g")" = "acme.zerossl.com" ] && [ -z "$ACME_EAB_KID" ] && [ -z "$ACME_EAB_HMAC_KEY" ]; then
        if [ -z "$ACME_EMAIL" ]; then
            echo "ACME_EMAIL is required to use zerossl. Either set it or use a different acme server like letsencrypt (ACME_SERVER: https://acme-v02.api.letsencrypt.org/directory)"
            sleep inf
        fi

        ZS_EAB="$(curl -sSL https://api.zerossl.com/acme/eab-credentials-email --data "email=$ACME_EMAIL")"
        export ZS_EAB
        ACME_EAB_KID="$(echo "$ZS_EAB" | jq -r .eab_kid)"
        export ACME_EAB_KID
        ACME_EAB_HMAC_KEY="$(echo "$ZS_EAB" | jq -r .eab_hmac_key)"
        export ACME_EAB_HMAC_KEY
    fi
    if [ -z "$ACME_EMAIL" ]; then
        if ! certbot --config /etc/certbot.ini register --server "$ACME_SERVER" --register-unsafely-without-email; then
                    sleep inf
        fi
    elif [ -n "$ACME_EMAIL" ] && [ -z "$ACME_EAB_KID" ] && [ -z "$ACME_EAB_HMAC_KEY" ]; then
        if ! certbot --config /etc/certbot.ini register --server "$ACME_SERVER" --email "$ACME_EMAIL"; then
                    sleep inf
        fi
    elif [ -n "$ACME_EMAIL" ] && [ -n "$ACME_EAB_KID" ] && [ -n "$ACME_EAB_HMAC_KEY" ]; then
        if ! certbot --config /etc/certbot.ini register --server "$ACME_SERVER" --eab-kid "$ACME_EAB_KID" --eab-hmac-key "$ACME_EAB_HMAC_KEY" --email "$ACME_EMAIL"; then
                    sleep inf
        fi
    fi
    echo
fi

if [ "$ACME_OCSP_STAPLING" = "true" ]; then
    certbot-ocsp-fetcher.sh -c /data/tls/certbot/live -o /data/tls/certbot/live --no-reload-webserver --force-update || true
    echo
fi
if [ "$CUSTOM_OCSP_STAPLING" = "true" ]; then
    certbot-ocsp-fetcher.sh -c /data/tls/custom -o /data/tls/custom --no-reload-webserver --force-update || true
    echo
fi

if [ ! -s /data/tls/ech/config-ids.json ]; then
    jq -n '{current: [], previous: []}' | sponge /data/tls/ech/config-ids.json
fi

if [ -s /data/tls/ech/cron.sh ]; then
    rm -f /data/tls/ech/*-previous.ech
    jq '{current: [], previous: .current}' /data/tls/ech/config-ids.json | sponge /data/tls/ech/config-ids.json

    chmod +x /data/tls/ech/cron.sh
    /data/tls/ech/cron.sh

    : > /data/tls/ech/nginx.conf
    for file in /data/tls/ech/*.ech; do
        [ -s "$file" ] && echo "ssl_ech_file $file;" >> /data/tls/ech/nginx.conf
    done
elif [ -s /data/tls/ech/nginx.conf ]; then
    rm -f /data/tls/ech/*.ech
    jq -n '{current: [], previous: []}' | sponge /data/tls/ech/config-ids.json

    : > /data/tls/ech/nginx.conf
fi


if ! nginx -tq; then
    sleep inf
fi
if [ "$PHP83" = "true" ]; then
    if ! PHP_INI_SCAN_DIR=/data/php/83/conf.d php-fpm83 -c /data/php/83 -y /data/php/83/php-fpm.conf -FORt > /dev/null 2>&1; then
        PHP_INI_SCAN_DIR=/data/php/83/conf.d php-fpm83 -c /data/php/83 -y /data/php/83/php-fpm.conf -FORt
        sleep inf
    fi
fi
if [ "$PHP84" = "true" ]; then
    if ! PHP_INI_SCAN_DIR=/data/php/84/conf.d php-fpm84 -c /data/php/84 -y /data/php/84/php-fpm.conf -FORt > /dev/null 2>&1; then
        PHP_INI_SCAN_DIR=/data/php/84/conf.d php-fpm84 -c /data/php/84 -y /data/php/84/php-fpm.conf -FORt
        sleep inf
    fi
fi
if [ "$PHP85" = "true" ]; then
    if ! PHP_INI_SCAN_DIR=/data/php/85/conf.d php-fpm85 -c /data/php/85 -y /data/php/85/php-fpm.conf -FORt > /dev/null 2>&1; then
        PHP_INI_SCAN_DIR=/data/php/85/conf.d php-fpm85 -c /data/php/85 -y /data/php/85/php-fpm.conf -FORt
        sleep inf
    fi
fi


echo "0 */$ECH_ROTATION_INTERVAL * * * cron-ech.sh" | tee "/tmp/crontabs/$(id -un)"
if [ "$LOGROTATE" = "true" ]; then
    logrotate --state /data/nginx/logs/logrotate.state /etc/logrotate
    echo "0 * * * * logrotate --state /data/nginx/logs/logrotate.state /etc/logrotate" | tee -a "/tmp/crontabs/$(id -un)"
fi

set -- backend nginx crond
[ "$GOA" = "true" ] && set -- "$@" goaccess
[ "$PHP83" = "true" ] && set -- "$@" php-fpm83
[ "$PHP84" = "true" ] && set -- "$@" php-fpm84
[ "$PHP85" = "true" ] && set -- "$@" php-fpm85

echo "Starting services..."
exec dinit -s "$@"
