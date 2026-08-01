#!/usr/bin/env sh

if [ -s /data/tls/ech/cron.sh ]; then
    rm -f /data/tls/ech/*-previous.ech
    jq '{current: [], previous: .current}' /data/tls/ech/config-ids.json | sponge /data/tls/ech/config-ids.json

    chmod +x /data/tls/ech/cron.sh
    /data/tls/ech/cron.sh

    : > /data/tls/ech/nginx.conf.tmp
    for file in /data/tls/ech/*.ech; do
        [ -s "$file" ] && echo "ssl_ech_file $file;" >> /data/tls/ech/nginx.conf.tmp
    done
    mv /data/tls/ech/nginx.conf.tmp /data/tls/ech/nginx.conf
    nginx -s reload
elif [ -s /data/tls/ech/nginx.conf ]; then
    rm -f /data/tls/ech/*.ech
    jq -n '{current: [], previous: []}' | sponge /data/tls/ech/config-ids.json

    : > /data/tls/ech/nginx.conf
    nginx -s reload
fi
