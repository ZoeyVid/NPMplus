#!/bin/sh

CF_API_TOKEN="your_cloudflare_api_token"

# to get your zone-ids: curl -H "Authorization: Bearer $CF_API_TOKEN" "https://api.cloudflare.com/client/v4/zones" | jq ".result[] | {name, id}"
# to get your record-ids: curl -H "Authorization: Bearer $CF_API_TOKEN" "https://api.cloudflare.com/client/v4/zones/<zone-id>/dns_records?type=HTTPS" | jq .result

# Format: hostname;identifier;zone_id;record_id
CONFIGS="
mx.example.org;mx-example-org;zone123;record123
mx.example.org;example-org;zone123;record456
mx.example.org;example-com;zone456;record789
"

for config in $CONFIGS; do
    curl -sS --out-null -X PATCH \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"data":{"value": "alpn=\"h3,h2,http/1.1\" ech=\"'"$(ech.sh "$(echo "$config" | cut -d';' -f1)" "$(echo "$config" | cut -d';' -f2)")"'\""}}' \
        "https://api.cloudflare.com/client/v4/zones/$(echo "$config" | cut -d';' -f3)/dns_records/$(echo "$config" | cut -d';' -f4)"
done
