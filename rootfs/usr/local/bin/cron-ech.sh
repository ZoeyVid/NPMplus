#!/usr/bin/env sh

if [ -s /data/tls/ech/cron.sh ]; then
    rm -f /data/tls/ech/*-previous.ech
    jq '{current: [], previous: .current}' /data/tls/ech/config-ids.json | sponge /data/tls/ech/config-ids.json
    chmod +x /data/tls/ech/cron.sh
    /data/tls/ech/cron.sh
    sed -i "s|#ssl_ech_file|ssl_ech_file|g" /usr/local/nginx/conf/nginx.conf
    nginx -s reload
elif grep -q '^[^#]*ssl_ech_file' /usr/local/nginx/conf/nginx.conf; then
    rm -f /data/tls/ech/*.ech
    jq -n '{current: [], previous: []}' | sponge /data/tls/ech/config-ids.json
    sed -i "s|ssl_ech_file|#ssl_ech_file|g" /usr/local/nginx/conf/nginx.conf
    nginx -s reload
fi
