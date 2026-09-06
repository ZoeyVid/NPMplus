#!/bin/bash
# CrowdSec doctor: chases the "CrowdSec rejected the bouncer key" admin UI
# error down the whole chain - container, LAPI, key file, registration,
# what the npmplus container actually sees - and offers to re-register.
# Run as root on the npmplus host: sudo bash crowdsec-doctor.sh
set -uo pipefail

DATA_DIR=/opt/npmplus
KEY="$DATA_DIR/crowdsec/lapi-ui.key"
MKEY="$DATA_DIR/crowdsec/lapi-ui-machine.key"
ADMIN_SECRET_FILE=/run/npmplus-initial-admin-password

bouncer_http_code() {
	local key
	key=$(cat "$1" 2>/dev/null || true)
	[[ -n $key ]] || { echo 000; return; }
	local code
	code=$(printf 'header = "X-Api-Key: %s"\n' "$key" | \
		curl -sS -m 5 -o /dev/null -w '%{http_code}' --config - \
		"$LAPI/v1/decisions?limit=1" 2>/dev/null || true)
	[[ -n $code ]] || code=000
	echo "$code"
}

machine_http_code() {
	[[ -n $1 ]] || { echo 000; return; }
	local code
	code=$(printf '{"machine_id":"npmplus-ui","password":"%s"}' "$1" | \
		curl -sS -m 5 -o /dev/null -w '%{http_code}' -H "Content-Type: application/json" \
		--data-binary @- "$LAPI/v1/watchers/login" 2>/dev/null || true)
	[[ -n $code ]] || code=000
	echo "$code"
}
LAPI=http://127.0.0.1:8080

hdr() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok() { printf ' \033[32m[ok]\033[0m %s\n' "$*"; }
bad() { printf ' \033[31m[FAIL]\033[0m %s\n' "$*"; }
note() { printf '        %s\n' "$*"; }
package_is_installed() {
	[[ "$(dpkg-query -W -f='${Status}' "$1" 2>/dev/null || true)" == "install ok installed" ]]
}

fail=0
npmplus_state=missing

hdr "1. containers"
for c in crowdsec npmplus; do
	if docker inspect "$c" >/dev/null 2>&1; then
		state=$(docker inspect --format '{{.State.Status}}' "$c" 2>/dev/null || echo unknown)
		state_exit=$(docker inspect --format '{{.State.ExitCode}}' "$c" 2>/dev/null || echo unknown)
		[[ "$c" != "npmplus" ]] || npmplus_state="$state"
		if [[ "$state" == "running" ]]; then
			ok "$c running"
		else
			bad "$c state is $state (exit $state_exit)"
			state_error=$(docker inspect --format '{{.State.Error}}' "$c" 2>/dev/null || true)
			[[ -z "$state_error" ]] || note "Docker error: $state_error"
			if [[ "$c" == "npmplus" ]] && \
				docker inspect --format '{{range .Mounts}}{{println .Source}}{{end}}' npmplus 2>/dev/null | grep -Fxq "$ADMIN_SECRET_FILE" && \
				[[ ! -e "$ADMIN_SECRET_FILE" ]]; then
				note "cause: the container retains a deleted one-time administrator secret mount"
				note "repair: download the current setup-npmplus.sh, then run it with --update"
			fi
			fail=1
		fi
	else
		bad "$c does not exist"
		fail=1
	fi
done

hdr "2. LAPI answers on $LAPI (no key - 401/403 expected)"
code=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$LAPI/v1/decisions?limit=1" 2>/dev/null || true)
[[ -n $code ]] || code=000
case $code in
	401 | 403) ok "LAPI up (no-key answer: $code)" ;;
	000) bad "LAPI unreachable - is the 127.0.0.1:8080 port publish up?"; fail=1 ;;
	*) bad "unexpected no-key answer: $code"; fail=1 ;;
esac

hdr "2b. is the port the container's? (native crowdsec steals it)"
if package_is_installed crowdsec; then
	bad "native crowdsec package is installed on the host"
	note "its daemon binds 127.0.0.1:8080 before the container can, and"
	note "then rejects every key the container's cscli ever registered"
	note "fix: sudo apt remove crowdsec; docker compose -f $DATA_DIR/compose.yaml up -d crowdsec"
	fail=1
elif command -v ss >/dev/null && ss -ltnp 2>/dev/null | grep ':8080' | grep -qv docker-proxy; then
	bad "port 8080 is owned by something other than docker:"
	ss -ltnp 2>/dev/null | grep ':8080' | sed 's/^/        /'
	fail=1
else
	ok "no native crowdsec, docker owns the port"
fi

hdr "3. bouncer key file ($KEY)"
if [[ ! -s "$KEY" ]]; then
	bad "missing or empty"
	fail=1
else
	ok "present ($(wc -c <"$KEY") bytes, mode $(stat -c %a "$KEY"))"
	if grep -q $'\r' "$KEY"; then
		bad "contains CR (crlf) - the LAPI will never accept it"
		fail=1
	else
		ok "no line-ending junk"
	fi
fi

hdr "4. the key the UI backend uses"
kcode=$(bouncer_http_code "$KEY")
if [[ $kcode == 200 ]]; then
	ok "LAPI accepts the key (200)"
else
	bad "LAPI rejects the key: HTTP $kcode"
	fail=1
fi

hdr "5. registration known to crowdsec"
if docker exec crowdsec cscli bouncers list 2>/dev/null | grep -qi "npmplus-ui"; then
	ok "npmplus-ui bouncer exists"
	docker exec crowdsec cscli bouncers list 2>/dev/null | grep -iE "name|npmplus" | head -3 | sed 's/^/        /'
else
	bad "npmplus-ui is NOT in the bouncer list"
	note "the registration was lost - classic cause: crowdsec's sqlite rolled"
	note "back on an unclean shutdown"
	fail=1
fi

hdr "6. what the npmplus container sees (/data/crowdsec/lapi-ui.key)"
if [[ "$npmplus_state" != "running" ]]; then
	bad "cannot inspect the key because npmplus is $npmplus_state"
	note "fix the container startup failure reported in step 1 first"
elif docker exec npmplus sh -c '[ -s /data/crowdsec/lapi-ui.key ]' 2>/dev/null; then
	host_hash=$(sha256sum "$KEY" | cut -d' ' -f1)
	container_hash=$(docker exec npmplus sha256sum /data/crowdsec/lapi-ui.key 2>/dev/null | cut -d' ' -f1)
	if [[ $host_hash == "$container_hash" ]]; then
		ok "container sees the same key"
	else
		bad "container sees a DIFFERENT key"
		fail=1
	fi
else
	bad "missing inside the npmplus container - check the $DATA_DIR:/data mount"
	fail=1
fi

hdr "7. machine key (unban + alert context only)"
mcode=$(machine_http_code "$(cat "$MKEY" 2>/dev/null || true)")
if [[ $mcode == 200 ]]; then
	ok "machine login works"
else
	bad "machine login: HTTP $mcode (unban/alerts will fail; the ban list itself still works)"
	fail=1
fi

hdr "8. self-heal"
if [[ -f /etc/cron.d/npmplus-crowdsec-heal ]]; then
	ok "heal cron installed"
else
	bad "heal cron NOT installed - rerun a fresh setup-npmplus.sh --update"
	note "it installs /usr/local/bin/npmplus-crowdsec-heal + the daily cron"
fi
if [[ -s /var/log/npmplus-crowdsec-heal.log ]]; then
	note "last heal log lines:"
	tail -5 /var/log/npmplus-crowdsec-heal.log | sed 's/^/        /'
fi

hdr "8b. host firewall bouncer"
if [[ -f /var/lib/npmplus/installed-firewall-bouncer ]]; then
	if ! command -v crowdsec-firewall-bouncer >/dev/null; then
		bad "installer marker exists, but the firewall bouncer binary is missing"
		fail=1
	elif ! crowdsec-firewall-bouncer -c /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml -t >/dev/null 2>&1; then
		bad "configuration is invalid - run Safe update to repair it"
		fail=1
	elif systemctl is-active --quiet crowdsec-firewall-bouncer; then
		rules=$(iptables-save 2>/dev/null || true)
		if grep -Eq '^-A INPUT .*--match-set crowdsec-blacklists src.* -j (DROP|REJECT)$' <<<"$rules" && \
			grep -Eq '^-A FORWARD .*--match-set crowdsec-blacklists src.* -j (DROP|REJECT)$' <<<"$rules"; then
			ok "firewall bouncer protects host INPUT and Docker FORWARD traffic"
		else
			bad "firewall bouncer is active but Docker FORWARD protection is missing"
			note "run Safe update to migrate the installer-managed rules"
			fail=1
		fi
	else
		bad "firewall bouncer service is not active"
		note "run Safe update to repair its boot ordering and restart it"
		fail=1
	fi
else
	note "not installed by setup-npmplus.sh"
fi

hdr "8c. protected startup"
if [[ -f /var/lib/npmplus/strict-boot-protection ]]; then
	if systemctl is-enabled --quiet npmplus-public.service && systemctl is-active --quiet npmplus-public.service && \
		systemctl is-enabled --quiet npmplus-boot-guard.service && \
		systemctl is-active --quiet npmplus-boot-guard.service && \
		[[ -x /usr/local/sbin/npmplus-boot-guard ]]; then
		ok "public listeners are gated behind CrowdSec at boot"
	else
		bad "strict boot marker exists but its public/guard services are incomplete"
		if /usr/local/sbin/npmplus-boot-guard status >/dev/null 2>&1; then
			note "the boot guard is active, so external ports 80/443 remain blocked"
		fi
		fail=1
	fi
	for container in npmplus npmplus-anubis npmplus-caddy; do
		docker inspect "$container" >/dev/null 2>&1 || continue
		if [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$container")" == "on-failure" ]]; then
			ok "$container cannot bypass the boot gate after Docker restarts"
		else
			bad "$container has a restart policy that can bypass the boot gate"
			fail=1
		fi
	done
else
	note "not enabled; public containers may start before the host bouncer after reboot"
fi
if [[ -f /var/lib/npmplus/cloudflare-origin-lock ]]; then
	if systemctl is-active --quiet npmplus-cloudflare-origin-lock.service && \
		/usr/local/sbin/npmplus-cloudflare-origin-lock status >/dev/null 2>&1; then
		ok "Cloudflare origin lock filters host and Docker traffic before routing"
	else
		bad "Cloudflare origin lock is configured but its packet rules are missing"
		fail=1
	fi
else
	note "Cloudflare origin lock is not enabled"
fi

hdr "9. recent crowdsec auth errors (2h)"
auth_errors=$(docker logs crowdsec --since 2h 2>&1 | grep -iE "api key|bouncer|403" | tail -8)
if [[ -n $auth_errors ]]; then
	printf '        %s\n' "${auth_errors//$'\n'/$'\n        '}"
else
	note "none found"
fi

hdr "10. CrowdSec SQLite files (WAL/SHM are normal while running)"
db_files=$(find /opt/crowdsec/data -maxdepth 1 -type f -name '*.db*' -print 2>/dev/null)
if [[ -n $db_files ]]; then
	printf '        %s\n' "${db_files//$'\n'/$'\n        '}"
else
	note "no db files found at /opt/crowdsec/data"
fi

hdr "11. prometheus metrics (the community blocklist count source)"
# the backend fetches these from inside the npmplus container (the compose
# service hostname is only resolvable there), so probe the same way
metrics_env=$(docker exec npmplus printenv CROWDSEC_METRICS_URL 2>/dev/null || true)
metrics_body=$(docker exec npmplus sh -c 'curl -sS -m 5 "$CROWDSEC_METRICS_URL"' 2>/dev/null || true)
if [[ -n $metrics_env ]]; then
	ok "CROWDSEC_METRICS_URL is set: $metrics_env"
else
	note "CROWDSEC_METRICS_URL is not set in the npmplus container;"
	note "the backend falls back to the LAPI host with port 6060"
fi
if [[ -z $metrics_body ]]; then
	bad "metrics fetch failed from inside the npmplus container"
	note "if crowdsec was just restarted, its metrics listener may still be starting"
	note "is the 127.0.0.1:6060:6060 port publish up on the crowdsec service?"
	note "updates from setup v1.18 add it automatically via --update"
	fail=1
elif grep -q '^cs_active_decisions{.*origin=' <<<"$metrics_body"; then
	ok "cs_active_decisions carries origin labels (community count works)"
elif grep -q '^cs_active_decisions' <<<"$metrics_body"; then
	bad "cs_active_decisions has no origin labels: set prometheus level to full"
	note "edit /opt/crowdsec/conf/config.yaml -> prometheus: { enabled: true, level: full }"
	note "then restart: docker restart crowdsec"
	fail=1
else
	bad "cs_active_decisions is missing from the metrics output"
	note "set prometheus: { enabled: true, level: full } in /opt/crowdsec/conf/config.yaml"
	fail=1
fi

if [[ $fail -eq 0 ]]; then
	hdr "everything checks out"
	note "if the UI still shows the error: hard-refresh the page (ctrl-shift-r),"
	note "and log out/in once - a stale browser session can also break the page"
	exit 0
fi

hdr "fix"
if [[ $kcode == 200 && $mcode == 200 ]]; then
	note "both keys are already accepted - nothing to re-register"
	note "follow the notes above for the remaining findings"
	exit 1
fi
if [[ "$code" == "000" ]]; then
	note "the LAPI is unreachable, so the keys could not be tested at all;"
	note "re-registering now could overwrite working keys for no reason."
	note "wait for the LAPI to answer, then rerun this doctor."
	exit 1
fi
read -r -p "re-register the rejected keys now? [y/N] " answer || answer=""
if [[ $answer != "y" ]]; then
	exit 0
fi

if [[ $kcode != 200 ]]; then
	docker exec crowdsec cscli bouncers delete npmplus-ui >/dev/null 2>&1 || true
	key=$(docker exec crowdsec cscli bouncers add npmplus-ui -o raw 2>/dev/null)
	echo "$key" >"$KEY"
	chmod 600 "$KEY"
	code=$(bouncer_http_code "$KEY")
	if [[ $code == 200 ]]; then
		ok "bouncer re-registered, verified against the LAPI (200)"
	else
		bad "still rejected ($code) - run by hand and compare:"
		note "docker exec crowdsec cscli bouncers add npmplus-ui -o raw"
	fi
fi

if [[ $mcode != 200 ]]; then
	pw=$(docker exec crowdsec cscli machines add npmplus-ui -a -f - --force 2>&1 | sed -n 's/^password:[[:space:]]*//p' | head -1)
	if [[ -n $pw ]]; then
		echo "$pw" >"$MKEY"
		chmod 600 "$MKEY"
		code=$(machine_http_code "$pw")
		if [[ $code == 200 ]]; then
			ok "machine re-registered, verified (200)"
		else
			bad "machine login still rejected ($code)"
		fi
	fi
fi
