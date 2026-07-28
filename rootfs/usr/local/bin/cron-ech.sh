#!/usr/bin/env sh

if [ -s /data/tls/ech/cron.sh ]; then
    chmod +x /data/tls/ech/cron.sh
    /data/tls/ech/cron.sh
    sed -i "s|#ssl_ech_file|ssl_ech_file|g" /usr/local/nginx/conf/nginx.conf
    nginx -s reload
elif grep -q '^[^#]*ssl_ech_file' /usr/local/nginx/conf/nginx.conf; then
    sed -i "s|ssl_ech_file|#ssl_ech_file|g" /usr/local/nginx/conf/nginx.conf
    nginx -s reload
fi
