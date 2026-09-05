#!/bin/bash
# Interactive NPMplus deployment and maintenance script (Debian 12/13 and Ubuntu 22.04+)
# Generates a compose.yaml with only the extras you pick (crowdsec, appsec, firewall
# bouncer, anubis, caddy), wires them together, optionally configures UFW, and starts
# everything. Run as root on the Linux docker host.
#
# deliberately only covers the common path; anything fancier -> edit the
# generated compose.yaml yourself afterwards, every option is commented in there.

set -euo pipefail

# bump this on every meaningful change - the script compares it against the
# copy on github at startup and tells the operator when theirs is stale
SCRIPT_VERSION="1.39"

DATA_DIR="/opt/npmplus"
CROWDSEC_DIR="/opt/crowdsec"
COMPOSE_FILE="$DATA_DIR/compose.yaml"
ADMIN_SECRET_FILE="/run/npmplus-initial-admin-password"
SELF_URL="https://raw.githubusercontent.com/mangyan1/NPMplus/develop/setup-npmplus.sh"
NPMPLUS_IMAGE_CHANNEL="ghcr.io/mangyan1/npmplus:develop"
CADDY_IMAGE_CHANNEL="ghcr.io/mangyan1/npmplus:caddy"
CROWDSEC_IMAGE_CHANNEL="docker.io/crowdsecurity/crowdsec:latest"
DOCKER_INSTALL_URL="https://get.docker.com"
DOCKER_INSTALL_SHA256="2df5f9e0f201a967f454191726d9254625f0f08030af3812c9edcdedc78e9693"
PACKAGECLOUD_INSTALL_URL="https://packagecloud.io/install/repositories/crowdsec/crowdsec/script.deb.sh"
PACKAGECLOUD_INSTALL_SHA256="3a098063d364ab1e69516d6835d69945d0e4061c003f86a98e7cf307bb79a91e"

say() { printf '\n\033[1;32m== %s\033[0m\n' "$*"; }
ask() { # ask "question" "default" -> answer on stdout, default on empty enter
	local q="$1" def="$2" answer
	read -r -p "$(printf '\033[1m%s\033[0m [%s]: ' "$q" "$def")" answer || true
	echo "${answer:-$def}"
}
askpw() { # askpw "question" "default" -> answer, no default echoed for passwords
	local q="$1" def="$2" answer
	read -rs -p "$(printf '\033[1m%s\033[0m%s: ' "$q" "${def:+ [$def]}")" answer || true
	echo >&2
	echo "${answer:-$def}"
}
confirm() { # confirm "question" "y|n" -> 0 if yes
	local answer
	answer=$(ask "$1" "$2")
	[[ "$answer" == "y" || "$answer" == "Y" || "$answer" == "yes" ]]
}

package_is_installed() { # package_is_installed PACKAGE
	# `dpkg -s` also succeeds for packages that were removed but left their
	# configuration files behind. Only this exact state means a daemon/package
	# is still installed and capable of conflicting with the container stack.
	[[ "$(dpkg-query -W -f='${Status}' "$1" 2>/dev/null || true)" == "install ok installed" ]]
}

default_ipv4_interface() {
	ip -o -4 route show to default 2>/dev/null |
		awk '{ for (i = 1; i <= NF; i++) if ($i == "dev") { print $(i + 1); exit } }'
}

detect_private_lan_ipv4() {
	local interface
	interface=$(default_ipv4_interface)
	[[ -n "$interface" ]] || return 1
	ip -o -4 addr show dev "$interface" scope global 2>/dev/null |
		awk '{ split($4, address, "/"); ip = address[1]
			if (ip ~ /^10\./ || ip ~ /^192\.168\./ || ip ~ /^172\.(1[6-9]|2[0-9]|3[01])\./) { print ip; exit } }'
}

detect_private_lan_cidr() {
	local interface
	interface=$(default_ipv4_interface)
	[[ -n "$interface" ]] || return 1
	ip -o -4 route show dev "$interface" scope link 2>/dev/null |
		awk '{ network = $1
			if (network ~ /^10\./ || network ~ /^192\.168\./ || network ~ /^172\.(1[6-9]|2[0-9]|3[01])\./) { print network; exit } }'
}

valid_ipv4() {
	local address="$1" octet
	local -a octets
	[[ "$address" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
	IFS=. read -r -a octets <<<"$address"
	for octet in "${octets[@]}"; do
		[[ "$octet" =~ ^[0-9]+$ ]] && ((10#$octet <= 255)) || return 1
	done
}

private_ipv4() {
	local address="$1" first second _rest
	valid_ipv4 "$address" || return 1
	IFS=. read -r first second _rest <<<"$address"
	((10#$first == 10 || (10#$first == 172 && 10#$second >= 16 && 10#$second <= 31) || (10#$first == 192 && 10#$second == 168)))
}

valid_private_ipv4_cidr() {
	local value="$1" address prefix
	[[ "$value" == */* ]] || return 1
	address=${value%/*}
	prefix=${value##*/}
	private_ipv4 "$address" && [[ "$prefix" =~ ^[0-9]+$ ]] && ((10#$prefix >= 8 && 10#$prefix <= 32))
}

[[ $EUID -eq 0 ]] || { echo "run as root (sudo)" >&2; exit 1; }

# Generated host helpers may be refreshed by an update while an older copy is
# still executing. Replacing the directory entry atomically keeps that running
# process on its original inode instead of truncating its script underneath it.
write_root_file() { # write_root_file target mode < content
	local target="$1" mode="$2" tmp
	tmp=$(mktemp "${target}.tmp.XXXXXX")
	if ! cat >"$tmp"; then
		rm -f -- "$tmp"
		return 1
	fi
	chown root:root "$tmp"
	chmod "$mode" "$tmp"
	mv -f -- "$tmp" "$target"
}

remove_admin_lan_proxy() {
	command -v systemctl >/dev/null || return 0
	systemctl disable --now npmplus-admin-lan.socket npmplus-admin-lan.service >/dev/null 2>&1 || true
	rm -f /etc/systemd/system/npmplus-admin-lan.socket /etc/systemd/system/npmplus-admin-lan.service
	systemctl daemon-reload >/dev/null 2>&1 || true
}

configure_admin_lan_proxy() { # configure_admin_lan_proxy PRIVATE_IP
	local listen_ip="$1" proxy_binary candidate
	proxy_binary=$(command -v systemd-socket-proxyd || true)
	if [[ -z "$proxy_binary" ]]; then
		for candidate in /usr/lib/systemd/systemd-socket-proxyd /lib/systemd/systemd-socket-proxyd; do
			if [[ -x "$candidate" ]]; then
				proxy_binary="$candidate"
				break
			fi
		done
	fi
	[[ -n "$proxy_binary" ]] || {
		echo "systemd-socket-proxyd is unavailable; refusing to expose the admin UI" >&2
		return 1
	}
	remove_admin_lan_proxy
	write_root_file /etc/systemd/system/npmplus-admin-lan.socket 0644 <<EOF
[Unit]
Description=NPMplus private-LAN admin listener
Wants=network-online.target
After=network-online.target

[Socket]
ListenStream=$listen_ip:81
NoDelay=true
FreeBind=true

[Install]
WantedBy=sockets.target
EOF
	write_root_file /etc/systemd/system/npmplus-admin-lan.service 0644 <<EOF
[Unit]
Description=NPMplus private-LAN admin relay
Requires=docker.service npmplus-admin-lan.socket
After=docker.service npmplus-admin-lan.socket

[Service]
Type=notify
ExecStart=$proxy_binary 127.0.0.1:81
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
NoNewPrivileges=true
EOF
	systemctl daemon-reload
	systemctl enable --now npmplus-admin-lan.socket >/dev/null
}

repair_admin_lan_proxy() {
	local socket_file=/etc/systemd/system/npmplus-admin-lan.socket listen_ip
	[[ -s "$socket_file" ]] || return 0
	listen_ip=$(sed -n 's/^ListenStream=\([0-9][0-9.]*\):81$/\1/p' "$socket_file" | head -1)
	if ! private_ipv4 "$listen_ip"; then
		echo "existing private-LAN admin listener has an invalid address; leaving it unchanged" >&2
		return 1
	fi
	configure_admin_lan_proxy "$listen_ip"
}

install_firewall_bouncer_boot_gate() {
	command -v systemctl >/dev/null || return 0
	write_root_file /usr/local/sbin/npmplus-wait-for-crowdsec-lapi 0755 <<'EOF'
#!/bin/sh
# The host firewall bouncer depends on the containerized CrowdSec LAPI. Docker
# being active does not mean that the LAPI is ready yet, so use a bounded gate.
if [ -s /opt/npmplus/compose.yaml ] && \
	docker compose -f /opt/npmplus/compose.yaml config --services 2>/dev/null | grep -qx crowdsec; then
	docker compose -f /opt/npmplus/compose.yaml up -d crowdsec
fi
for attempt in $(seq 1 180); do
	code=$(curl -sS --connect-timeout 1 --max-time 2 -o /dev/null -w '%{http_code}' \
		http://127.0.0.1:8080/v1/decisions?limit=1 2>/dev/null || true)
	case "$code" in
		200|401|403) exit 0 ;;
	esac
	[ "$attempt" -eq 180 ] || sleep 1
done
echo "npmplus: CrowdSec LAPI did not become ready within 180 seconds" >&2
exit 1
EOF
	mkdir -p /etc/systemd/system/crowdsec-firewall-bouncer.service.d
	write_root_file /etc/systemd/system/crowdsec-firewall-bouncer.service.d/10-npmplus-container-lapi.conf 0644 <<'EOF'
[Unit]
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target
PartOf=docker.service
Before=npmplus-public.service

[Service]
ExecStartPre=/usr/local/sbin/npmplus-wait-for-crowdsec-lapi
Restart=on-failure
RestartSec=5s
EOF
	systemctl daemon-reload
}

firewall_bouncer_covers_public_paths() {
	local rules
	rules=$(iptables-save 2>/dev/null || true)
	grep -Eq '^-A INPUT .*--match-set crowdsec-blacklists src.* -j (DROP|REJECT)$' <<<"$rules" &&
		grep -Eq '^-A FORWARD .*--match-set crowdsec-blacklists src.* -j (DROP|REJECT)$' <<<"$rules"
}

normalize_firewall_bouncer_config() {
	local config=/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml tmp disable_ipv6=true
	[[ -s "$config" ]] || return 1
	# Ubuntu's package writes a .yaml.local overlay that forces nftables even
	# after the installer replaces the main file. This config is installer-owned
	# whenever the marker exists, so remove the stale package overlay explicitly.
	rm -f -- "${config}.local"
	if command -v ip >/dev/null && ip -6 address show scope global | grep -q 'inet6 '; then
		disable_ipv6=false
	fi
	tmp=$(mktemp "${config}.tmp.XXXXXX")
	if ! awk -v disable_ipv6="$disable_ipv6" '
		/^mode:/ { print "mode: iptables"; mode=1; next }
		/^disable_ipv6:/ { print "disable_ipv6: " disable_ipv6; disable_ipv6_seen=1; next }
		/^iptables_chains:/ {
			in_chains_seen=1
			print "iptables_chains:"
			print "  - INPUT"
			print "  - FORWARD"
			in_chains=1
			next
		}
		in_chains && /^  - / { next }
		in_chains { in_chains=0 }
		/^pid_dir:/ { pid_dir=1 }
		/^daemonize:/ { daemonize=1 }
		/^log_mode:/ { log_mode=1 }
		/^log_dir:/ { log_dir=1 }
		/^log_level:/ { log_level=1 }
		/^log_compression:/ { log_compression=1 }
		/^log_max_size:/ { log_max_size=1 }
		/^log_max_backups:/ { log_max_backups=1 }
		/^log_max_age:/ { log_max_age=1 }
		{ print }
		END {
			if (!mode) print "mode: iptables"
			if (!disable_ipv6_seen) print "disable_ipv6: " disable_ipv6
			if (!in_chains_seen) {
				print "iptables_chains:"
				print "  - INPUT"
				print "  - FORWARD"
			}
			if (!pid_dir) print "pid_dir: /var/run/"
			if (!daemonize) print "daemonize: true"
			if (!log_mode) print "log_mode: file"
			if (!log_dir) print "log_dir: /var/log/"
			if (!log_level) print "log_level: info"
			if (!log_compression) print "log_compression: true"
			if (!log_max_size) print "log_max_size: 100"
			if (!log_max_backups) print "log_max_backups: 3"
			if (!log_max_age) print "log_max_age: 30"
		}
	' "$config" >"$tmp"; then
		rm -f -- "$tmp"
		return 1
	fi
	chown root:root "$tmp"
	chmod 0600 "$tmp"
	mv -f -- "$tmp" "$config"
}

repair_installer_firewall_bouncer() {
	[[ -f /var/lib/npmplus/installed-firewall-bouncer ]] || return 0
	command -v crowdsec-firewall-bouncer >/dev/null || return 0
	DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ipset iptables
	normalize_firewall_bouncer_config
	install_firewall_bouncer_boot_gate
	if ! crowdsec-firewall-bouncer -c /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml -t; then
		echo "the installer-managed CrowdSec firewall bouncer config is invalid" >&2
		return 1
	fi
	systemctl enable crowdsec-firewall-bouncer >/dev/null
	# Do not spend three minutes waiting during preflight when CrowdSec itself is
	# down. The post-deployment call will start the bouncer once its LAPI answers.
	if curl -sS --connect-timeout 1 --max-time 2 -o /dev/null \
		http://127.0.0.1:8080/v1/decisions?limit=1 2>/dev/null; then
		systemctl restart crowdsec-firewall-bouncer
		firewall_bouncer_covers_public_paths || {
			echo "CrowdSec firewall bouncer is not protecting both INPUT and FORWARD" >&2
			return 1
		}
	fi
}

adopt_legacy_installer_firewall_bouncer() {
	local config=/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml
	[[ ! -f /var/lib/npmplus/installed-firewall-bouncer ]] || return 0
	package_is_installed crowdsec-firewall-bouncer || return 0
	command -v crowdsec-firewall-bouncer >/dev/null || return 0
	[[ -s "$COMPOSE_FILE" && -s "$config" ]] || return 0
	grep -q 'container_name: crowdsec' "$COMPOSE_FILE" || return 0
	grep -Fq '# generated by setup-npmplus.sh' "$config" || return 0
	grep -Eq '^api_url:[[:space:]]*http://127\.0\.0\.1:8080/?[[:space:]]*$' "$config" || return 0
	say "adopting legacy installer-managed firewall bouncer"
	mkdir -p /var/lib/npmplus
	touch /var/lib/npmplus/installed-firewall-bouncer
}

activate_installer_firewall_bouncer() {
	[[ -f /var/lib/npmplus/installed-firewall-bouncer ]] || return 0
	repair_installer_firewall_bouncer
	systemctl restart crowdsec-firewall-bouncer
	systemctl is-active --quiet crowdsec-firewall-bouncer || {
		systemctl status crowdsec-firewall-bouncer --no-pager -l >&2 || true
		return 1
	}
	firewall_bouncer_covers_public_paths || {
		echo "CrowdSec firewall bouncer started without INPUT + FORWARD enforcement" >&2
		return 1
	}
}

set_public_restart_policy() { # set_public_restart_policy POLICY
	local policy="$1" tmp
	[[ -s "$COMPOSE_FILE" ]] || return 1
	tmp=$(mktemp "${COMPOSE_FILE}.tmp.XXXXXX")
	awk -v policy="$policy" '
		/^  [A-Za-z0-9_-]+:$/ {
			service=$1
			sub(/:$/, "", service)
			managed=(service == "npmplus" || service == "anubis" || service == "npmplus-caddy")
		}
		managed && /^    restart:/ { print "    restart: " policy; next }
		{ print }
	' "$COMPOSE_FILE" >"$tmp"
	chown root:root "$tmp"
	chmod 0600 "$tmp"
	mv -f -- "$tmp" "$COMPOSE_FILE"
}

remove_strict_boot_protection() {
	command -v systemctl >/dev/null || return 0
	systemctl disable --now npmplus-public.service >/dev/null 2>&1 || true
	systemctl disable --now npmplus-boot-guard.service >/dev/null 2>&1 || true
	[[ ! -x /usr/local/sbin/npmplus-boot-guard ]] || \
		/usr/local/sbin/npmplus-boot-guard remove >/dev/null 2>&1 || true
	rm -f /etc/systemd/system/npmplus-public.service /usr/local/sbin/npmplus-start-protected \
		/etc/systemd/system/npmplus-boot-guard.service /usr/local/sbin/npmplus-boot-guard \
		/var/lib/npmplus/strict-boot-protection
	systemctl daemon-reload >/dev/null 2>&1 || true
}

configure_boot_guard() {
	write_root_file /usr/local/sbin/npmplus-boot-guard 0755 <<'EOF'
#!/bin/bash
# A pre-Docker raw-table guard. Local/private maintenance stays reachable, but
# public web traffic cannot reach an early container until protected startup
# verifies CrowdSec and application health, then removes these owned rules.
set -euo pipefail

remove_jump() { # remove_jump BINARY PROTOCOL PORTS
	local binary="$1" protocol="$2" ports="$3"
	while "$binary" -t raw -C PREROUTING -p "$protocol" -m multiport --dports "$ports" -j NPMPLUS-BOOT >/dev/null 2>&1; do
		"$binary" -t raw -D PREROUTING -p "$protocol" -m multiport --dports "$ports" -j NPMPLUS-BOOT
	done
}

apply_family() { # apply_family BINARY PRIVATE_CIDRS...
	local binary="$1"; shift
	local cidr
	"$binary" -t raw -N NPMPLUS-BOOT >/dev/null 2>&1 || true
	"$binary" -t raw -F NPMPLUS-BOOT
	for cidr in "$@"; do
		"$binary" -t raw -A NPMPLUS-BOOT -s "$cidr" -j RETURN
	done
	"$binary" -t raw -A NPMPLUS-BOOT -j DROP
	remove_jump "$binary" tcp 80,443
	remove_jump "$binary" udp 443
	"$binary" -t raw -I PREROUTING 1 -p udp -m multiport --dports 443 -j NPMPLUS-BOOT
	"$binary" -t raw -I PREROUTING 1 -p tcp -m multiport --dports 80,443 -j NPMPLUS-BOOT
}

remove_rules() {
	local binary
	for binary in iptables ip6tables; do
		command -v "$binary" >/dev/null || continue
		remove_jump "$binary" tcp 80,443
		remove_jump "$binary" udp 443
		"$binary" -t raw -F NPMPLUS-BOOT >/dev/null 2>&1 || true
		"$binary" -t raw -X NPMPLUS-BOOT >/dev/null 2>&1 || true
	done
}

ipv6_enabled() {
	[[ ! -r /proc/sys/net/ipv6/conf/all/disable_ipv6 ]] ||
		[[ "$(< /proc/sys/net/ipv6/conf/all/disable_ipv6)" == 0 ]]
}

case "${1:-apply}" in
	apply)
		apply_family iptables 127.0.0.0/8 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16
		if ipv6_enabled; then
			apply_family ip6tables ::1/128 fc00::/7 fe80::/10
		fi
		;;
	remove) remove_rules ;;
	status)
		iptables -t raw -C PREROUTING -p tcp -m multiport --dports 80,443 -j NPMPLUS-BOOT
		if ipv6_enabled; then
			ip6tables -t raw -C PREROUTING -p tcp -m multiport --dports 80,443 -j NPMPLUS-BOOT
		fi
		;;
	*) echo "usage: $0 {apply|remove|status}" >&2; exit 2 ;;
esac
EOF
	write_root_file /etc/systemd/system/npmplus-boot-guard.service 0644 <<'EOF'
[Unit]
Description=Keep NPMplus public ports blocked until protected startup succeeds
Before=docker.service
PartOf=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/npmplus-boot-guard apply
ExecStop=/usr/local/sbin/npmplus-boot-guard apply

[Install]
RequiredBy=docker.service
EOF
	systemctl daemon-reload
	systemctl enable npmplus-boot-guard.service >/dev/null
}

configure_strict_boot_protection() {
	[[ -f /var/lib/npmplus/installed-firewall-bouncer ]] || {
		echo "strict boot protection requires the installer-managed firewall bouncer" >&2
		return 1
	}
	set_public_restart_policy "on-failure"
	mkdir -p /var/lib/npmplus
	touch /var/lib/npmplus/strict-boot-protection
	configure_boot_guard
	write_root_file /usr/local/sbin/npmplus-start-protected 0755 <<'EOF'
#!/bin/bash
# Starts public listeners only after the containerized LAPI and host packet
# bouncer are ready. Public services use on-failure, so Docker cannot race this
# gate when the daemon starts after a reboot.
set -euo pipefail
COMPOSE=/opt/npmplus/compose.yaml

/usr/local/sbin/npmplus-boot-guard apply
docker compose -f "$COMPOSE" up -d crowdsec
/usr/local/sbin/npmplus-wait-for-crowdsec-lapi
systemctl is-active --quiet crowdsec-firewall-bouncer.service

rules=$(iptables-save)
grep -Eq '^-A INPUT .*--match-set crowdsec-blacklists src.* -j (DROP|REJECT)$' <<<"$rules"
grep -Eq '^-A FORWARD .*--match-set crowdsec-blacklists src.* -j (DROP|REJECT)$' <<<"$rules"
# The v0.0.25 bouncer reports READY after starting its decision-stream goroutine.
# Keep listeners closed for a short initial-stream grace period, then prove the
# rules remain installed.
sleep 2
rules=$(iptables-save)
grep -Eq '^-A INPUT .*--match-set crowdsec-blacklists src.* -j (DROP|REJECT)$' <<<"$rules"
grep -Eq '^-A FORWARD .*--match-set crowdsec-blacklists src.* -j (DROP|REJECT)$' <<<"$rules"

if [[ -f /var/lib/npmplus/cloudflare-origin-lock ]]; then
	systemctl start npmplus-cloudflare-origin-lock.service
	systemctl is-active --quiet npmplus-cloudflare-origin-lock.service
fi

mapfile -t configured_services < <(docker compose -f "$COMPOSE" config --services)
services=()
for service in "${configured_services[@]}"; do
	[[ "$service" == crowdsec ]] || services+=("$service")
done
(( ${#services[@]} > 0 )) || { echo "npmplus: Compose has no public services" >&2; exit 1; }
docker compose -f "$COMPOSE" up -d --no-deps "${services[@]}"

for _ in $(seq 1 300); do
	ready=true
	for service in "${services[@]}"; do
		cid=$(docker compose -f "$COMPOSE" ps -a -q "$service" 2>/dev/null || true)
		[[ -n "$cid" && "$(docker inspect --format '{{.State.Status}}' "$cid")" == running ]] || { ready=false; break; }
		health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")
		[[ "$health" == none || "$health" == healthy ]] || { ready=false; break; }
	done
	if [[ "$ready" == true ]] && \
		curl -fkSs --connect-timeout 2 --max-time 5 -o /dev/null https://127.0.0.1/ && \
		curl -fkSs --connect-timeout 2 --max-time 5 https://127.0.0.1:81/api | \
			grep -qE '"status"[[:space:]]*:[[:space:]]*"OK"'; then
		/usr/local/sbin/npmplus-boot-guard remove
		exit 0
	fi
	sleep 1
done
echo "npmplus: public services did not become healthy; boot guard remains active" >&2
exit 1
EOF
	write_root_file /etc/systemd/system/npmplus-public.service 0644 <<'EOF'
[Unit]
Description=Start NPMplus public listeners after CrowdSec enforcement
Requires=docker.service crowdsec-firewall-bouncer.service npmplus-boot-guard.service
After=docker.service crowdsec-firewall-bouncer.service npmplus-boot-guard.service npmplus-cloudflare-origin-lock.service network-online.target
Wants=network-online.target
PartOf=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/npmplus-start-protected

[Install]
WantedBy=docker.service
EOF
	systemctl daemon-reload
	systemctl enable npmplus-public.service >/dev/null
}

remove_cloudflare_origin_lock() {
	command -v systemctl >/dev/null || return 0
	systemctl disable --now npmplus-cloudflare-origin-lock.service >/dev/null 2>&1 || true
	[[ ! -x /usr/local/sbin/npmplus-cloudflare-origin-lock ]] || \
		/usr/local/sbin/npmplus-cloudflare-origin-lock stop >/dev/null 2>&1 || true
	rm -f /etc/systemd/system/npmplus-cloudflare-origin-lock.service \
		/etc/cron.d/npmplus-cloudflare-origin-lock \
		/usr/local/sbin/npmplus-cloudflare-origin-lock \
		/var/lib/npmplus/cloudflare-origin-lock
	rm -f /var/lib/npmplus/cloudflare-ips-v4 /var/lib/npmplus/cloudflare-ips-v6
	systemctl daemon-reload >/dev/null 2>&1 || true
}

configure_cloudflare_origin_lock() {
	DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ipset iptables
	mkdir -p /var/lib/npmplus
	touch /var/lib/npmplus/cloudflare-origin-lock
	write_root_file /usr/local/sbin/npmplus-cloudflare-origin-lock 0755 <<'EOF'
#!/bin/bash
# Allows public web traffic from Cloudflare and private/local networks only.
# The owned raw-table pre-routing chain runs before host INPUT, Docker FORWARD,
# UFW, and destination NAT. CrowdSec rules still run after an allowed source.
set -euo pipefail
STATE=/var/lib/npmplus
exec 9>/run/lock/npmplus-cloudflare-origin-lock.lock
flock 9

valid_list() { # valid_list 4|6 FILE
	local family="$1" file="$2" validation="npcf-check-${1}-$$" network rc=0
	[[ -s "$file" ]] || return 1
	if [[ "$family" == 4 ]]; then
		awk -F'[./]' '
			NF != 5 { bad=1 }
			$1 > 255 || $2 > 255 || $3 > 255 || $4 > 255 || $5 > 32 { bad=1 }
			END { exit bad || NR < 10 || NR > 100 }
		' "$file" || return 1
		grep -qx '0.0.0.0/0' "$file" && return 1
	else
		awk -F/ '
			NF != 2 || $1 !~ /^[0-9A-Fa-f:]+$/ || $2 !~ /^[0-9]+$/ || $2 > 128 { bad=1 }
			END { exit bad || NR < 5 || NR > 100 }
		' "$file" || return 1
		grep -qx '::/0' "$file" && return 1
	fi
	ipset destroy "$validation" >/dev/null 2>&1 || true
	ipset create "$validation" hash:net family "$([[ "$family" == 4 ]] && echo inet || echo inet6)" maxelem 100
	while IFS= read -r network; do
		ipset add "$validation" "$network" || { rc=1; break; }
	done <"$file"
	ipset destroy "$validation" >/dev/null 2>&1 || true
	return "$rc"
}

refresh() {
	local v4tmp v6tmp
	v4tmp=$(mktemp "$STATE/cloudflare-ips-v4.tmp.XXXXXX")
	v6tmp=$(mktemp "$STATE/cloudflare-ips-v6.tmp.XXXXXX")
	trap 'rm -f -- "$v4tmp" "$v6tmp"' RETURN
	curl -fsSL --retry 4 --connect-timeout 10 --max-time 60 https://www.cloudflare.com/ips-v4 -o "$v4tmp"
	curl -fsSL --retry 4 --connect-timeout 10 --max-time 60 https://www.cloudflare.com/ips-v6 -o "$v6tmp"
	valid_list 4 "$v4tmp"
	valid_list 6 "$v6tmp"
	chmod 0644 "$v4tmp" "$v6tmp"
	mv -f -- "$v4tmp" "$STATE/cloudflare-ips-v4"
	mv -f -- "$v6tmp" "$STATE/cloudflare-ips-v6"
	trap - RETURN
}

load_set() { # load_set NAME FAMILY FILE
	local name="$1" family="$2" file="$3" tmp
	tmp="${name}-new"
	ipset destroy "$tmp" >/dev/null 2>&1 || true
	ipset create "$tmp" hash:net family "$family" maxelem 100000
	while IFS= read -r network; do
		[[ -n "$network" ]] && ipset add "$tmp" "$network"
	done <"$file"
	if ipset list "$name" >/dev/null 2>&1; then
		ipset swap "$tmp" "$name"
		ipset destroy "$tmp"
	else
		ipset rename "$tmp" "$name"
	fi
}

remove_jump() { # remove_jump BINARY PROTOCOL PORTS
	local binary="$1" protocol="$2" ports="$3"
	while "$binary" -t raw -C PREROUTING -p "$protocol" -m multiport --dports "$ports" -j NPMPLUS-CF >/dev/null 2>&1; do
		"$binary" -t raw -D PREROUTING -p "$protocol" -m multiport --dports "$ports" -j NPMPLUS-CF
	done
}

apply_family() { # apply_family BINARY SET PRIVATE_CIDRS...
	local binary="$1" set_name="$2"; shift 2
	local cidr
	"$binary" -t raw -N NPMPLUS-CF >/dev/null 2>&1 || true
	"$binary" -t raw -F NPMPLUS-CF
	"$binary" -t raw -A NPMPLUS-CF -m set --match-set "$set_name" src -j RETURN
	for cidr in "$@"; do
		"$binary" -t raw -A NPMPLUS-CF -s "$cidr" -j RETURN
	done
	"$binary" -t raw -A NPMPLUS-CF -j DROP
	remove_jump "$binary" tcp 80,443
	remove_jump "$binary" udp 443
	"$binary" -t raw -I PREROUTING 1 -p udp -m multiport --dports 443 -j NPMPLUS-CF
	"$binary" -t raw -I PREROUTING 1 -p tcp -m multiport --dports 80,443 -j NPMPLUS-CF
}

stop_rules() {
	local binary
	for binary in iptables ip6tables; do
		command -v "$binary" >/dev/null || continue
		remove_jump "$binary" tcp 80,443
		remove_jump "$binary" udp 443
		"$binary" -t raw -F NPMPLUS-CF >/dev/null 2>&1 || true
		"$binary" -t raw -X NPMPLUS-CF >/dev/null 2>&1 || true
	done
	ipset destroy npcf4 >/dev/null 2>&1 || true
	ipset destroy npcf6 >/dev/null 2>&1 || true
}

start_rules() {
	if ! refresh; then
		echo "Cloudflare list refresh failed; using the last validated copy" >&2
	fi
	valid_list 4 "$STATE/cloudflare-ips-v4"
	valid_list 6 "$STATE/cloudflare-ips-v6"
	load_set npcf4 inet "$STATE/cloudflare-ips-v4"
	load_set npcf6 inet6 "$STATE/cloudflare-ips-v6"
	apply_family iptables npcf4 127.0.0.0/8 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16
	apply_family ip6tables npcf6 ::1/128 fc00::/7 fe80::/10
}

case "${1:-start}" in
	start) start_rules ;;
	refresh) start_rules ;;
	stop) stop_rules ;;
	status)
		iptables -t raw -C PREROUTING -p tcp -m multiport --dports 80,443 -j NPMPLUS-CF
		ip6tables -t raw -C PREROUTING -p tcp -m multiport --dports 80,443 -j NPMPLUS-CF
		;;
	*) echo "usage: $0 {start|refresh|stop|status}" >&2; exit 2 ;;
esac
EOF
	write_root_file /etc/systemd/system/npmplus-cloudflare-origin-lock.service 0644 <<'EOF'
[Unit]
Description=Restrict NPMplus public web ports to Cloudflare and private LANs
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target
PartOf=docker.service
Before=npmplus-public.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/npmplus-cloudflare-origin-lock start
ExecStop=/usr/local/sbin/npmplus-cloudflare-origin-lock stop

[Install]
WantedBy=docker.service
EOF
	printf '19 3 * * * root /usr/local/sbin/npmplus-cloudflare-origin-lock refresh >>/var/log/npmplus-cloudflare-origin-lock.log 2>&1\n' \
		>/etc/cron.d/npmplus-cloudflare-origin-lock
	chmod 0644 /etc/cron.d/npmplus-cloudflare-origin-lock
	systemctl daemon-reload
	systemctl enable npmplus-cloudflare-origin-lock.service >/dev/null
}

run_crowdsec_doctor() (
	# Keep diagnostics best-effort. A failed individual probe should be reported,
	# not terminate the entire doctor before the remaining checks have run.
	set +e
	set -uo pipefail

	local key="$DATA_DIR/crowdsec/lapi-ui.key"
	local machine_key="$DATA_DIR/crowdsec/lapi-ui-machine.key"
	local lapi="http://127.0.0.1:8080"
	local fail=0 code kcode mcode auth_errors db_files answer container state state_error state_exit npmplus_state="missing"

	doctor_header() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
	doctor_ok() { printf ' \033[32m[ok]\033[0m %s\n' "$*"; }
	doctor_bad() { printf ' \033[31m[FAIL]\033[0m %s\n' "$*"; }
	doctor_note() { printf '        %s\n' "$*"; }
	doctor_bouncer_http_code() {
		local value
		value=$(cat "$1" 2>/dev/null || true)
		[[ -n $value ]] || { echo 000; return; }
		printf 'header = "X-Api-Key: %s"\n' "$value" | \
			curl -sS -m 5 -o /dev/null -w '%{http_code}' --config - \
			"$lapi/v1/decisions?limit=1" 2>/dev/null || echo 000
	}
	doctor_machine_http_code() {
		[[ -n $1 ]] || { echo 000; return; }
		printf '{"machine_id":"npmplus-ui","password":"%s"}' "$1" | \
			curl -sS -m 5 -o /dev/null -w '%{http_code}' -H "Content-Type: application/json" \
			--data-binary @- "$lapi/v1/watchers/login" 2>/dev/null || echo 000
	}

	doctor_header "1. containers"
	for container in crowdsec npmplus; do
		if docker inspect "$container" >/dev/null 2>&1; then
			state=$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || echo unknown)
			state_exit=$(docker inspect --format '{{.State.ExitCode}}' "$container" 2>/dev/null || echo unknown)
			[[ "$container" != "npmplus" ]] || npmplus_state="$state"
			if [[ "$state" == "running" ]]; then
				doctor_ok "$container running"
			else
				doctor_bad "$container state is $state (exit $state_exit)"
				state_error=$(docker inspect --format '{{.State.Error}}' "$container" 2>/dev/null || true)
				[[ -z "$state_error" ]] || doctor_note "Docker error: $state_error"
				if [[ "$container" == "npmplus" ]] && npmplus_uses_bootstrap_secret_mount && [[ ! -e "$ADMIN_SECRET_FILE" ]]; then
					doctor_note "cause: the container retains a deleted one-time administrator secret mount"
					doctor_note "repair: rerun this current setup script with --update"
				fi
				fail=1
			fi
		else
			doctor_bad "$container does not exist"
			fail=1
		fi
	done

	doctor_header "2. LAPI answers on $lapi (no key - 401/403 expected)"
	code=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$lapi/v1/decisions?limit=1" 2>/dev/null || echo 000)
	case $code in
		401 | 403) doctor_ok "LAPI up (no-key answer: $code)" ;;
		000) doctor_bad "LAPI unreachable - is the 127.0.0.1:8080 port publish up?"; fail=1 ;;
		*) doctor_bad "unexpected no-key answer: $code"; fail=1 ;;
	esac

	doctor_header "2b. is the port the container's? (native crowdsec steals it)"
	if package_is_installed crowdsec; then
		doctor_bad "native crowdsec package is installed on the host"
		doctor_note "its daemon binds 127.0.0.1:8080 before the container can, and"
		doctor_note "then rejects every key the container's cscli ever registered"
		doctor_note "fix: sudo apt remove crowdsec; docker compose -f $COMPOSE_FILE up -d crowdsec"
		fail=1
	elif command -v ss >/dev/null && ss -ltnp 2>/dev/null | grep ':8080' | grep -qv docker-proxy; then
		doctor_bad "port 8080 is owned by something other than docker:"
		ss -ltnp 2>/dev/null | grep ':8080' | sed 's/^/        /'
		fail=1
	else
		doctor_ok "no native crowdsec, docker owns the port"
	fi

	doctor_header "3. bouncer key file ($key)"
	if [[ ! -s "$key" ]]; then
		doctor_bad "missing or empty"
		fail=1
	else
		doctor_ok "present ($(wc -c <"$key") bytes, mode $(stat -c %a "$key"))"
		if grep -q $'\r' "$key"; then
			doctor_bad "contains CR (crlf) - the LAPI will never accept it"
			fail=1
		else
			doctor_ok "no line-ending junk"
		fi
	fi

	doctor_header "4. the key the UI backend uses"
	kcode=$(doctor_bouncer_http_code "$key")
	if [[ $kcode == 200 ]]; then
		doctor_ok "LAPI accepts the key (200)"
	else
		doctor_bad "LAPI rejects the key: HTTP $kcode"
		fail=1
	fi

	doctor_header "5. registration known to crowdsec"
	if docker exec crowdsec cscli bouncers list 2>/dev/null | grep -qi "npmplus-ui"; then
		doctor_ok "npmplus-ui bouncer exists"
		docker exec crowdsec cscli bouncers list 2>/dev/null | grep -iE "name|npmplus" | head -3 | sed 's/^/        /'
	else
		doctor_bad "npmplus-ui is NOT in the bouncer list"
		doctor_note "the registration was lost - classic cause: crowdsec's sqlite rolled"
		doctor_note "back on an unclean shutdown"
		fail=1
	fi

	doctor_header "6. what the npmplus container sees (/data/crowdsec/lapi-ui.key)"
	if [[ "$npmplus_state" != "running" ]]; then
		doctor_bad "cannot inspect the key because npmplus is $npmplus_state"
		doctor_note "fix the container startup failure reported in step 1 first"
	elif docker exec npmplus sh -c '[ -s /data/crowdsec/lapi-ui.key ]' 2>/dev/null; then
		local host_hash container_hash
		host_hash=$(sha256sum "$key" | cut -d' ' -f1)
		container_hash=$(docker exec npmplus sha256sum /data/crowdsec/lapi-ui.key 2>/dev/null | cut -d' ' -f1)
		if [[ $host_hash == "$container_hash" ]]; then
			doctor_ok "container sees the same key"
		else
			doctor_bad "container sees a DIFFERENT key"
			fail=1
		fi
	else
		doctor_bad "missing inside the npmplus container - check the $DATA_DIR:/data mount"
		fail=1
	fi

	doctor_header "7. machine key (unban + alert context only)"
	mcode=$(doctor_machine_http_code "$(cat "$machine_key" 2>/dev/null || true)")
	if [[ $mcode == 200 ]]; then
		doctor_ok "machine login works"
	else
		doctor_bad "machine login: HTTP $mcode (unban/alerts will fail; the ban list itself still works)"
		fail=1
	fi

	doctor_header "8. self-heal"
	if [[ -f /etc/cron.d/npmplus-crowdsec-heal ]]; then
		doctor_ok "heal cron installed"
	else
		doctor_bad "heal cron NOT installed - choose Safe update from the main menu"
		doctor_note "it installs /usr/local/bin/npmplus-crowdsec-heal and the daily cron"
	fi
	if [[ -s /var/log/npmplus-crowdsec-heal.log ]]; then
		doctor_note "last heal log lines:"
		tail -5 /var/log/npmplus-crowdsec-heal.log | sed 's/^/        /'
	fi

	doctor_header "8b. host firewall bouncer"
	if [[ -f /var/lib/npmplus/installed-firewall-bouncer ]]; then
		if ! command -v crowdsec-firewall-bouncer >/dev/null; then
			doctor_bad "installer marker exists, but the firewall bouncer binary is missing"
			fail=1
		elif ! crowdsec-firewall-bouncer -c /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml -t >/dev/null 2>&1; then
			doctor_bad "configuration is invalid - run Safe update to repair it"
			fail=1
		elif systemctl is-active --quiet crowdsec-firewall-bouncer; then
			if firewall_bouncer_covers_public_paths; then
				doctor_ok "firewall bouncer protects host INPUT and Docker FORWARD traffic"
			else
				doctor_bad "firewall bouncer is active but Docker FORWARD protection is missing"
				doctor_note "run Safe update to migrate the installer-managed rules"
				fail=1
			fi
		else
			doctor_bad "firewall bouncer service is not active"
			doctor_note "run Safe update to repair its boot ordering and restart it"
			fail=1
		fi
	else
		doctor_note "not installed by setup-npmplus.sh"
	fi

	doctor_header "8c. protected startup"
	if [[ -f /var/lib/npmplus/strict-boot-protection ]]; then
		if systemctl is-enabled --quiet npmplus-public.service && systemctl is-active --quiet npmplus-public.service && \
			systemctl is-enabled --quiet npmplus-boot-guard.service && \
			systemctl is-active --quiet npmplus-boot-guard.service && \
			[[ -x /usr/local/sbin/npmplus-boot-guard ]]; then
			doctor_ok "public listeners are gated behind CrowdSec at boot"
		else
			doctor_bad "strict boot marker exists but its public/guard services are incomplete"
			if /usr/local/sbin/npmplus-boot-guard status >/dev/null 2>&1; then
				doctor_note "the boot guard is active, so external ports 80/443 remain blocked"
			fi
			fail=1
		fi
		for container in npmplus npmplus-anubis npmplus-caddy; do
			docker inspect "$container" >/dev/null 2>&1 || continue
			if [[ "$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$container")" == "on-failure" ]]; then
				doctor_ok "$container cannot bypass the boot gate after Docker restarts"
			else
				doctor_bad "$container has a restart policy that can bypass the boot gate"
				fail=1
			fi
		done
	else
		doctor_note "not enabled; public containers may start before the host bouncer after reboot"
	fi
	if [[ -f /var/lib/npmplus/cloudflare-origin-lock ]]; then
		if systemctl is-active --quiet npmplus-cloudflare-origin-lock.service && \
			/usr/local/sbin/npmplus-cloudflare-origin-lock status >/dev/null 2>&1; then
			doctor_ok "Cloudflare origin lock filters host and Docker traffic before routing"
		else
			doctor_bad "Cloudflare origin lock is configured but its packet rules are missing"
			fail=1
		fi
	else
		doctor_note "Cloudflare origin lock is not enabled"
	fi

	doctor_header "9. recent crowdsec auth errors (2h)"
	auth_errors=$(docker logs crowdsec --since 2h 2>&1 | grep -iE "api key|bouncer|403" | tail -8)
	if [[ -n $auth_errors ]]; then
		printf '        %s\n' "${auth_errors//$'\n'/$'\n        '}"
	else
		doctor_note "none found"
	fi

	doctor_header "10. CrowdSec SQLite files (WAL/SHM are normal while running)"
	db_files=$(find "$CROWDSEC_DIR/data" -maxdepth 1 -type f -name '*.db*' -print 2>/dev/null)
	if [[ -n $db_files ]]; then
		printf '        %s\n' "${db_files//$'\n'/$'\n        '}"
	else
		doctor_note "no db files found at $CROWDSEC_DIR/data"
	fi

	doctor_header "11. prometheus metrics (the community blocklist count source)"
	# the backend fetches these from inside the npmplus container (the compose
	# service hostname is only resolvable there), so probe the same way
	metrics_env=$(docker exec npmplus printenv CROWDSEC_METRICS_URL 2>/dev/null || true)
	metrics_body=$(docker exec npmplus sh -c 'curl -sS -m 5 "$CROWDSEC_METRICS_URL"' 2>/dev/null || true)
	if [[ -n $metrics_env ]]; then
		doctor_ok "CROWDSEC_METRICS_URL is set: $metrics_env"
	else
		doctor_note "CROWDSEC_METRICS_URL is not set in the npmplus container;"
		doctor_note "the backend falls back to the LAPI host with port 6060"
	fi
	if [[ -z $metrics_body ]]; then
		doctor_bad "metrics fetch failed from inside the npmplus container"
		doctor_note "is the 127.0.0.1:6060:6060 port publish up on the crowdsec service?"
		doctor_note "updates from setup v1.18 add it automatically via --update"
		fail=1
	elif grep -q '^cs_active_decisions{.*origin=' <<<"$metrics_body"; then
		doctor_ok "cs_active_decisions carries origin labels (community count works)"
	elif grep -q '^cs_active_decisions' <<<"$metrics_body"; then
		doctor_bad "cs_active_decisions has no origin labels: set prometheus level to full"
		doctor_note "edit $CROWDSEC_DIR/conf/config.yaml -> prometheus: { enabled: true, level: full }"
		doctor_note "then restart: docker restart crowdsec"
		fail=1
	else
		doctor_bad "cs_active_decisions is missing from the metrics output"
		doctor_note "set prometheus: { enabled: true, level: full } in $CROWDSEC_DIR/conf/config.yaml"
		fail=1
	fi

	if [[ $fail -eq 0 ]]; then
		doctor_header "everything checks out"
		doctor_note "if the UI still shows the error: hard-refresh the page (ctrl-shift-r),"
		doctor_note "and log out/in once - a stale browser session can also break the page"
		exit 0
	fi

	doctor_header "fix"
	if [[ $kcode == 200 && $mcode == 200 ]]; then
		doctor_note "both keys are already accepted - nothing to re-register"
		doctor_note "follow the notes above for the remaining findings"
		exit 1
	fi
	read -r -p "re-register the rejected keys now? [y/N] " answer || answer=""
	if [[ $answer != "y" ]]; then
		exit 0
	fi

	if [[ $kcode != 200 ]]; then
		local new_key
		docker exec crowdsec cscli bouncers delete npmplus-ui >/dev/null 2>&1 || true
		new_key=$(docker exec crowdsec cscli bouncers add npmplus-ui -o raw 2>/dev/null)
		printf '%s\n' "$new_key" >"$key"
		chmod 600 "$key"
		code=$(doctor_bouncer_http_code "$key")
		if [[ $code == 200 ]]; then
			doctor_ok "bouncer re-registered, verified against the LAPI (200)"
		else
			doctor_bad "still rejected ($code) - run by hand and compare:"
			doctor_note "docker exec crowdsec cscli bouncers add npmplus-ui -o raw"
		fi
	fi

	if [[ $mcode != 200 ]]; then
		local password
		password=$(docker exec crowdsec cscli machines add npmplus-ui -a -f - --force 2>&1 | sed -n 's/^password:[[:space:]]*//p' | head -1)
		if [[ -n $password ]]; then
			printf '%s\n' "$password" >"$machine_key"
			chmod 600 "$machine_key"
			code=$(doctor_machine_http_code "$password")
			if [[ $code == 200 ]]; then
				doctor_ok "machine re-registered, verified (200)"
			else
				doctor_bad "machine login still rejected ($code)"
			fi
		fi
	fi
)

run_boot_trace() (
	set +e
	set -uo pipefail

	local output
	local boot_time now service cid
	if [[ -n ${1:-} ]]; then
		output=$1
		umask 077
		if ! (set -o noclobber; : >"$output") 2>/dev/null; then
			echo "refusing to overwrite diagnostic report: $output" >&2
			exit 1
		fi
	else
		output=$(mktemp "/tmp/npmplus-boot-trace-$(date +%Y%m%d-%H%M%S).XXXXXX.log")
	fi
	boot_time=$(date -d "$(uptime -s)" --iso-8601=seconds)
	now=$(date --iso-8601=seconds)

	chmod 600 "$output"
	exec > >(tee "$output") 2>&1

	trace_section() { printf '\n========== %s ==========' "$*"; printf '\n'; }
	trace_run() {
		printf '\n$'
		printf ' %q' "$@"
		printf '\n'
		"$@" || true
	}

	trace_section "HOST AND BOOT"
	trace_run date --iso-8601=seconds
	trace_run uptime
	trace_run systemd-analyze time
	trace_run systemd-analyze critical-chain docker.service
	trace_run bash -c 'systemd-analyze blame --no-pager | head -50'

	trace_section "DOCKER SERVICE"
	trace_run systemctl is-enabled docker.service
	trace_run systemctl status docker.service --no-pager -l
	trace_run systemctl show docker.service \
		--property=ActiveState,SubState,Result,ExecMainStatus,ActiveEnterTimestamp,After,Wants
	trace_run systemctl cat docker.service
	trace_run systemctl list-dependencies --all docker.service

	trace_section "NPMPLUS HOST SERVICES"
	for unit in npmplus-admin-lan.socket npmplus-admin-lan.service crowdsec-firewall-bouncer.service \
		npmplus-public.service npmplus-boot-guard.service npmplus-cloudflare-origin-lock.service; do
		trace_run systemctl status "$unit" --no-pager -l
		trace_run systemctl cat "$unit"
	done
	trace_run iptables-save
	trace_run ip6tables-save
	trace_run ipset list

	trace_section "NETWORK AND DNS"
	for unit in \
		network-online.target \
		systemd-networkd.service \
		systemd-networkd-wait-online.service \
		NetworkManager.service \
		NetworkManager-wait-online.service \
		systemd-resolved.service; do
		trace_run systemctl status "$unit" --no-pager -l
	done

	trace_run ip -brief address
	trace_run readlink -f /etc/resolv.conf
	trace_run cat /etc/resolv.conf
	trace_run getent ahosts ghcr.io
	if command -v resolvectl >/dev/null; then
		trace_run resolvectl query ghcr.io
		trace_run resolvectl status
	fi

	trace_section "CURRENT-BOOT JOURNAL"
	trace_run journalctl -b --no-pager -n 500 \
		-u docker.service \
		-u containerd.service \
		-u npmplus-admin-lan.socket \
		-u npmplus-admin-lan.service \
		-u crowdsec-firewall-bouncer.service \
		-u npmplus-public.service \
		-u npmplus-boot-guard.service \
		-u npmplus-cloudflare-origin-lock.service \
		-u systemd-networkd-wait-online.service \
		-u NetworkManager-wait-online.service \
		-u systemd-resolved.service

	trace_section "BOOT WARNINGS"
	trace_run journalctl -b --no-pager -p warning..alert -n 250

	trace_section "CONTAINERS"
	trace_run docker info --format \
		'Docker={{.ServerVersion}} started={{.SystemTime}} containers={{.Containers}} running={{.ContainersRunning}}'

	if [[ -s "$COMPOSE_FILE" ]]; then
		trace_run docker compose -f "$COMPOSE_FILE" config --services
		trace_run docker compose -f "$COMPOSE_FILE" config --images
		trace_run docker compose -f "$COMPOSE_FILE" ps -a

		mapfile -t services < <(docker compose -f "$COMPOSE_FILE" config --services 2>/dev/null)
		for service in "${services[@]}"; do
			trace_section "CONTAINER: $service"
			cid=$(docker compose -f "$COMPOSE_FILE" ps -a -q "$service" 2>/dev/null || true)
			if [[ -z $cid ]]; then
				echo "No container exists for service $service."
				continue
			fi

			trace_run docker inspect --format \
				'name={{.Name}} state={{.State.Status}} exit={{.State.ExitCode}} error={{printf "%q" .State.Error}} started={{.State.StartedAt}} finished={{.State.FinishedAt}} restart={{.HostConfig.RestartPolicy.Name}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
				"$cid"
			if [[ $service == "npmplus" ]]; then
				trace_run docker exec "$cid" cat /etc/resolv.conf
			fi
			trace_run docker logs --since "$boot_time" --tail 200 "$cid"
		done
	else
		echo "$COMPOSE_FILE is missing."
	fi

	trace_section "CONTAINER EVENTS SINCE BOOT"
	trace_run docker events \
		--since "$boot_time" \
		--until "$now" \
		--filter type=container \
		--format '{{.Time}} {{.Action}} {{.Actor.Attributes.name}} {{.Actor.Attributes.exitCode}}'

	trace_section "PORTS AND RESOURCES"
	trace_run bash -c "ss -lntp | grep -E ':(80|81|443|7422|8080|8923)([[:space:]]|$)' || true"
	trace_run df -h / /var/lib/docker
	trace_run free -h

	trace_section "QUICK INTERPRETATION"
	echo "If critical-chain stops at *-wait-online.service, networking is delaying Docker."
	echo "If Docker is active but no container exists, compose down probably removed it."
	echo "If restart=unless-stopped and exit=0, the container may have been manually stopped."
	echo "Look for DNS/resolver errors in the npmplus logs."
	echo "Look for port conflicts when a container repeatedly exits."
	echo
	echo "Report saved to: $output"
	echo "Review it for hostnames and IP addresses before sharing it."
)

show_usage() {
	cat <<'EOF'
Usage: sudo bash setup-npmplus.sh [option]

With no option in a terminal, a numbered maintenance menu is shown.

Options:
  --install                 install or reconfigure NPMplus
  --update                  safely update with snapshot and rollback
  --update --enable-appsec  enable AppSec during a safe update
  --update --enable-strict-boot
                            keep public ports closed until CrowdSec is enforcing
  --update --enable-cloudflare-origin-lock
                            accept public web traffic only from Cloudflare/LANs
  --doctor                  check and optionally repair CrowdSec
  --boot-trace [FILE]       save a read-only startup diagnostic report
  --uninstall               back up and uninstall NPMplus
  --uninstall --no-backup   uninstall only when no final backup is possible
  --help                    show this help
EOF
}

show_main_menu() {
	local choice
	say "NPMplus setup and maintenance"
	if [[ -s "$COMPOSE_FILE" ]]; then
		cat <<'EOF'
  1) Safe update (recommended)
  2) Check or repair CrowdSec
  3) Create a startup/reboot diagnostic report
  4) Reconfigure installation (advanced)
  5) Uninstall
  6) Exit
EOF
		choice=$(ask "Select an option" "1")
		case $choice in
			1) set -- --update ;;
			2) set -- --doctor ;;
			3) set -- --boot-trace ;;
			4) set -- --install ;;
			5) set -- --uninstall ;;
			6) exit 0 ;;
			*) echo "invalid selection: $choice" >&2; exit 2 ;;
		esac
	else
		cat <<'EOF'
  1) Install NPMplus (recommended)
  2) Check CrowdSec
  3) Create a startup/reboot diagnostic report
  4) Exit
EOF
		choice=$(ask "Select an option" "1")
		case $choice in
			1) set -- --install ;;
			2) set -- --doctor ;;
			3) set -- --boot-trace ;;
			4) exit 0 ;;
			*) echo "invalid selection: $choice" >&2; exit 2 ;;
		esac
	fi
	MENU_ACTION=("$@")
}

# Human operators get one simple menu. Piped/non-interactive installs retain the
# historical no-argument behavior so automation and unattended tests do not
# consume one of the installer answers as a menu choice.
MENU_ACTION=()
if [[ $# -eq 0 && -t 0 ]]; then
	show_main_menu
	set -- "${MENU_ACTION[@]}"
fi

case "${1:-}" in
	--install)
		shift
		[[ $# -eq 0 ]] || { echo "--install does not accept another option" >&2; exit 2; }
		;;
	--doctor)
		shift
		[[ $# -eq 0 ]] || { echo "--doctor does not accept another option" >&2; exit 2; }
		run_crowdsec_doctor
		exit $?
		;;
	--boot-trace)
		shift
		[[ $# -le 1 ]] || { echo "--boot-trace accepts at most one output file" >&2; exit 2; }
		run_boot_trace "${1:-}"
		exit $?
		;;
	--help|-h)
		show_usage
		exit 0
		;;
	--update|--uninstall|"")
		;;
	*)
		echo "unknown option: $1" >&2
		show_usage >&2
		exit 2
		;;
esac

# Existing installs preserve these security choices during an ordinary update.
# Operators can opt in explicitly without rebuilding the stack interactively;
# flags are carried through the transactional safe-update wrapper via env.
ENABLE_APPSEC_ON_UPDATE="${NPMPLUS_ENABLE_APPSEC_ON_UPDATE:-false}"
ENABLE_STRICT_BOOT_ON_UPDATE="${NPMPLUS_ENABLE_STRICT_BOOT_ON_UPDATE:-false}"
ENABLE_CF_ORIGIN_LOCK_ON_UPDATE="${NPMPLUS_ENABLE_CF_ORIGIN_LOCK_ON_UPDATE:-false}"
if [[ "${1:-}" == "--update" ]]; then
	for update_option in "${@:2}"; do
		case "$update_option" in
			--enable-appsec) ENABLE_APPSEC_ON_UPDATE="true" ;;
			--enable-strict-boot) ENABLE_STRICT_BOOT_ON_UPDATE="true" ;;
			--enable-cloudflare-origin-lock) ENABLE_CF_ORIGIN_LOCK_ON_UPDATE="true" ;;
			*) echo "unknown update option: $update_option" >&2; exit 1 ;;
		esac
	done

elif [[ "${1:-}" == "--uninstall" ]]; then
	if [[ $# -gt 2 || ( -n "${2:-}" && "${2}" != "--no-backup" ) ]]; then
		echo "unknown uninstall option: ${2:-}" >&2
		exit 1
	fi
elif [[ -n "${2:-}" ]]; then
	echo "${2} is only valid with --update" >&2
	exit 1
fi

# --uninstall is deliberately handled before dependency installation, network
# access and docker service changes. Removing an installation must never install
# Docker/curl or rewrite host configuration first.
if [[ "${1:-}" == "--uninstall" ]]; then
	if [[ "${2:-}" != "--no-backup" ]]; then
		if [[ -x /usr/local/bin/npmplus-backup ]]; then
			say "taking one final backup first (kept in /var/backups/npmplus)"
			/usr/local/bin/npmplus-backup || {
				echo "backup failed - uninstall aborted; fix the backup or explicitly use --no-backup" >&2
				exit 1
			}
		elif [[ -d "$DATA_DIR" ]]; then
			echo "backup helper is missing - uninstall aborted; restore the helper or explicitly use --no-backup" >&2
			exit 1
		fi
	fi
	echo "this removes ALL npmplus containers and data (certs, database,"
	echo "crowdsec state) and the crons this script installed. Shared images and"
	echo "unrelated Docker/system packages are left alone."
	read -r -p "type 'uninstall' to confirm: " answer || true
	[[ "${answer:-}" == "uninstall" ]] || { echo "aborted - nothing removed" >&2; exit 1; }
	remove_strict_boot_protection
	remove_cloudflare_origin_lock

	if [[ -s "$COMPOSE_FILE" ]] && command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
		say "stopping and removing containers"
		docker compose -f "$COMPOSE_FILE" down --remove-orphans || true
	elif command -v docker >/dev/null; then
		say "no usable compose file - removing stray containers by name"
		for c in npmplus crowdsec npmplus-anubis npmplus-caddy; do
			docker rm -f "$c" >/dev/null 2>&1 || true
		done
	fi

	say "removing NPMplus data and tooling"
	rm -rf -- "$DATA_DIR" "$CROWDSEC_DIR" /opt/anubis-data /opt/anubis.yaml
	rm -f /etc/cron.d/npmplus-safe-update /etc/cron.d/npmplus-backup \
		/etc/cron.d/npmplus-crowdsec-heal /etc/cron.d/anubis-honeypot
	rm -f /usr/local/bin/npmplus-safe-update /usr/local/bin/npmplus-backup \
		/usr/local/bin/npmplus-crowdsec-heal /usr/local/bin/anubis-honeypot-ban \
		/usr/local/sbin/npmplus-wait-for-dns /usr/local/sbin/npmplus-wait-for-crowdsec-lapi \
		/usr/local/sbin/npmplus-start-protected /usr/local/sbin/npmplus-cloudflare-origin-lock \
		/usr/local/sbin/npmplus-boot-guard
	rm -f /var/log/npmplus-update.log /var/log/npmplus-backup.log /var/log/npmplus-crowdsec-heal.log
	remove_admin_lan_proxy

	# Remove only the drop-in owned by this script. Other Docker overrides belong
	# to the operator and must survive an NPMplus uninstall.
	rm -f /etc/systemd/system/docker.service.d/10-wait-for-dns.conf
	rmdir /etc/systemd/system/docker.service.d >/dev/null 2>&1 || true
	rm -f /etc/systemd/system/crowdsec-firewall-bouncer.service.d/10-npmplus-container-lapi.conf
	rmdir /etc/systemd/system/crowdsec-firewall-bouncer.service.d >/dev/null 2>&1 || true
	command -v systemctl >/dev/null && systemctl daemon-reload >/dev/null 2>&1 || true

	# Only remove a firewall bouncer that this script recorded as installed by it.
	if [[ -f /var/lib/npmplus/installed-firewall-bouncer ]]; then
		apt-get remove -y crowdsec-firewall-bouncer >/dev/null 2>&1 || true
		rm -f /var/lib/npmplus/installed-firewall-bouncer
		rmdir /var/lib/npmplus >/dev/null 2>&1 || true
	fi
	rm -f /var/lib/npmplus/strict-boot-protection /var/lib/npmplus/cloudflare-origin-lock \
		/var/lib/npmplus/cloudflare-ips-v4 /var/lib/npmplus/cloudflare-ips-v6

	if [[ -d /var/backups/npmplus ]]; then
		say "uninstalled - backups kept in /var/backups/npmplus (delete manually if unwanted)"
	else
		say "uninstalled"
	fi
	echo "container images, unrelated packages and ufw rules were left untouched"
	exit 0
fi

fetch() { # fetch <url> [curl args] -> stdout, retries to survive network blips
	local i
	for i in 1 2 3 4 5; do
		curl -sSfL --connect-timeout 10 --max-time 60 "$@" && return 0
		[[ $i -eq 5 ]] || sleep $((i * 2))
	done
	echo "giving up on: $*" >&2
	return 1
}

run_verified_script() { # url sha256: download, verify, then execute
	local url="$1" expected="$2" tmp
	tmp=$(mktemp)
	if ! fetch "$url" -o "$tmp" || ! printf '%s  %s\n' "$expected" "$tmp" | sha256sum -c -; then
		rm -f "$tmp"
		echo "refusing to execute an unverified installer from $url" >&2
		return 1
	fi
	if ! bash "$tmp"; then
		rm -f "$tmp"
		return 1
	fi
	rm -f "$tmp"
}

yaml_quote() { # quote YAML and escape $ so compose preserves it literally
	local value=${1//\$/\$\$}
	value=${value//\'/\'\'}
	printf "'%s'" "$value"
}

scrub_bootstrap_admin_credentials() {
	[[ -s "$COMPOSE_FILE" ]] || return 0
	local tmp
	tmp=$(mktemp "${COMPOSE_FILE}.XXXXXX")
	awk '
		/NPMPLUS_BOOTSTRAP_ADMIN_(MOUNT|ENV|SECRET)_BEGIN/ { skip=1; next }
		skip && /NPMPLUS_BOOTSTRAP_ADMIN_(MOUNT|ENV|SECRET)_END/ { skip=0; next }
		skip { next }
		$0 == "  npmplus:" { in_npmplus=1 }
		in_npmplus && $0 ~ /^  [^ ]/ && $0 != "  npmplus:" { in_npmplus=0 }
		in_npmplus && ($0 ~ /INITIAL_ADMIN_EMAIL=/ || $0 ~ /INITIAL_ADMIN_PASSWORD=/ || $0 ~ /INITIAL_ADMIN_PASSWORD_FILE=/) { next }
		{ print }
	' "$COMPOSE_FILE" >"$tmp"
	chmod 600 "$tmp"
	chown root:root "$tmp"
	mv -f "$tmp" "$COMPOSE_FILE"
}

erase_bootstrap_admin_secret() {
	if [[ -e "$ADMIN_SECRET_FILE" ]]; then
		# Truncate first so an already-mounted Docker secret loses the value too.
		: >"$ADMIN_SECRET_FILE"
		chmod 600 "$ADMIN_SECRET_FILE"
		rm -f "$ADMIN_SECRET_FILE"
	fi
}

npmplus_uses_bootstrap_secret_mount() {
	docker inspect --format '{{range .Mounts}}{{println .Source}}{{end}}' npmplus 2>/dev/null |
		grep -Fxq "$ADMIN_SECRET_FILE"
}

wait_for_npmplus_healthy() {
	local reason="$1" health="" _
	for _ in $(seq 1 180); do
		health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' npmplus 2>/dev/null || true)
		[[ "$health" == "healthy" ]] && return 0
		sleep 1
	done
	docker logs --tail 100 npmplus >&2 || true
	echo "npmplus did not become healthy after $reason (last state: ${health:-missing})" >&2
	return 1
}

recreate_npmplus_without_bootstrap_secret() {
	if grep -Fq "$ADMIN_SECRET_FILE" "$COMPOSE_FILE"; then
		echo "refusing to recreate npmplus while compose still references the bootstrap secret" >&2
		return 1
	fi
	docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate npmplus
	wait_for_npmplus_healthy "removing the one-time administrator secret mount" || return 1
	if npmplus_uses_bootstrap_secret_mount; then
		echo "npmplus still retains the one-time administrator secret mount after recreation" >&2
		return 1
	fi
}

finalize_admin_bootstrap() {
	local ready=false response="" _
	for _ in $(seq 1 300); do
		response=$(curl -fkSs --connect-timeout 2 --max-time 5 https://127.0.0.1:81/api 2>/dev/null || true)
		if grep -qE '"status"[[:space:]]*:[[:space:]]*"OK"' <<<"$response" && \
			grep -qE '"setup"[[:space:]]*:[[:space:]]*true' <<<"$response"; then
			ready=true
			break
		fi
		sleep 1
	done
	if [[ "$ready" != "true" ]]; then
		echo "initial administrator was not confirmed; the root-only bootstrap secret remains at $ADMIN_SECRET_FILE" >&2
		return 1
	fi
	say "removing one-time administrator bootstrap credentials"
	scrub_bootstrap_admin_credentials
	# Docker stores bind mounts in the container object. Recreate from the
	# sanitized Compose file before deleting the /run source, otherwise the old
	# container cannot start after a reboot when tmpfs-backed /run is empty.
	recreate_npmplus_without_bootstrap_secret || {
		if npmplus_uses_bootstrap_secret_mount; then
			echo "the root-only bootstrap secret was retained because the old container still requires it" >&2
		else
			erase_bootstrap_admin_secret
			echo "the one-time bootstrap secret was removed; inspect npmplus health before retrying" >&2
		fi
		return 1
	}
	erase_bootstrap_admin_secret
}

pin_image() { # mutable channel -> immutable local platform repo digest
	local channel="$1" repository short_repository docker_repository candidate digest=""
	docker pull "$channel" >/dev/null
	repository=${channel%:*}
	short_repository=${repository#docker.io/}
	docker_repository=${short_repository#library/}
	while IFS= read -r candidate; do
		candidate=${candidate%$'\r'}
		case "${candidate%@*}" in
			"$repository" | "$short_repository" | "$docker_repository")
				digest="$candidate"
				break
				;;
		esac
	done < <(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$channel")
	[[ "$digest" =~ @sha256:[0-9a-f]{64}$ ]] || {
		echo "could not resolve an immutable digest for $channel" >&2
		return 1
	}
	# Keep the channel tag before the digest. NPMplus and Caddy deliberately use
	# different tags in the same repository, so dropping it makes their pinned
	# references indistinguishable during a later update.
	printf '%s@%s\n' "$channel" "${digest#*@}"
}

set_compose_service_image() { # set_compose_service_image <service> <image-ref>
	local service="$1" image_ref="$2" tmp
	tmp=$(mktemp "${COMPOSE_FILE}.XXXXXX")
	if ! awk -v service="$service" -v image_ref="$image_ref" '
		$0 == "  " service ":" { in_service=1 }
		in_service && $0 ~ /^  [^ ]/ && $0 != "  " service ":" { in_service=0 }
		in_service && $0 ~ /^    image:/ {
			print "    image: " image_ref
			replaced=1
			next
		}
		{ print }
		END { if (!replaced) exit 1 }
	' "$COMPOSE_FILE" >"$tmp"; then
		rm -f "$tmp"
		echo "could not update image for Compose service $service" >&2
		return 1
	fi
	chmod --reference="$COMPOSE_FILE" "$tmp"
	mv "$tmp" "$COMPOSE_FILE"
}

harden_auxiliary_service() { # harden_auxiliary_service <service> <crowdsec|anubis|caddy>
	local service="$1" kind="$2" tmp
	# Installer-managed services get a complete, tested profile. If an operator
	# already supplied any custom hardening keys, preserve their policy instead of
	# creating duplicate YAML keys or silently changing it.
	if awk -v service="$service" '
		$0 == "  " service ":" { in_service=1 }
		in_service && $0 ~ /^  [^ ]/ && $0 != "  " service ":" { in_service=0 }
		in_service && /NPMPLUS_AUX_HARDENING_BEGIN/ { found=1 }
		END { exit !found }
	' "$COMPOSE_FILE"; then
		return 0
	fi
	if awk -v service="$service" '
		$0 == "  " service ":" { in_service=1; found_service=1 }
		in_service && $0 ~ /^  [^ ]/ && $0 != "  " service ":" { in_service=0 }
		in_service && $0 ~ /^    (read_only|cap_drop|security_opt|healthcheck):/ { custom=1 }
		END { exit !(found_service && custom) }
	' "$COMPOSE_FILE"; then
		say "preserving operator-defined security settings for $service"
		return 0
	fi
	tmp=$(mktemp "${COMPOSE_FILE}.XXXXXX")
	if ! awk -v service="$service" -v kind="$kind" '
		$0 == "  " service ":" { in_service=1 }
		in_service && $0 ~ /^  [^ ]/ && $0 != "  " service ":" { in_service=0 }
		{ print }
		in_service && $0 ~ /^    pull_policy:/ {
			print "    # NPMPLUS_AUX_HARDENING_BEGIN"
			print "    read_only: true"
			print "    cap_drop:"
			print "      - ALL"
			if (kind == "caddy") {
				print "    cap_add:"
				print "      - NET_BIND_SERVICE"
			}
			print "    security_opt:"
			print "      - no-new-privileges=true"
			print "    tmpfs:"
			if (kind == "crowdsec") print "      - /tmp:rw,noexec,nosuid,nodev,size=64m"
			else if (kind == "anubis") print "      - /tmp:rw,noexec,nosuid,nodev,size=32m"
			else print "      - /tmp:rw,noexec,nosuid,nodev,size=16m"
			print "    healthcheck:"
			if (kind == "crowdsec") print "      test: [\"CMD\", \"cscli\", \"lapi\", \"status\"]"
			else if (kind == "anubis") print "      test: [\"CMD\", \"/ko-app/anubis\", \"-healthcheck\"]"
			else print "      test: [\"CMD\", \"nc\", \"-z\", \"127.0.0.1\", \"80\"]"
			print "      interval: 30s"
			if (kind == "caddy") print "      timeout: 5s"
			else print "      timeout: 10s"
			if (kind == "caddy") print "      retries: 3"
			else print "      retries: 5"
			if (kind == "crowdsec") print "      start_period: 120s"
			else if (kind == "anubis") print "      start_period: 30s"
			else print "      start_period: 10s"
			print "    # NPMPLUS_AUX_HARDENING_END"
			inserted=1
		}
		END { if (!inserted) exit 1 }
	' "$COMPOSE_FILE" >"$tmp"; then
		rm -f "$tmp"
		echo "could not add the security profile to Compose service $service" >&2
		return 1
	fi
	chmod --reference="$COMPOSE_FILE" "$tmp"
	mv "$tmp" "$COMPOSE_FILE"
}

ensure_crowdsec_metrics_port() {
	local service="crowdsec" port_mapping="127.0.0.1:6060:6060" tmp
	if awk -v service="$service" '
		$0 == "  " service ":" { in_service=1 }
		in_service && $0 ~ /^  [^ ]/ && $0 != "  " service ":" { in_service=0 }
		in_service && index($0, "6060:6060") { found=1 }
		END { exit !found }
	' "$COMPOSE_FILE"; then
		return 0
	fi
	tmp=$(mktemp "${COMPOSE_FILE}.XXXXXX")
	if ! awk -v service="$service" -v port_mapping="$port_mapping" '
		$0 == "  " service ":" { in_service=1 }
		in_service && $0 ~ /^  [^ ]/ && $0 != "  " service ":" { in_service=0 }
		{ print }
		in_service && $0 == "    ports:" {
			print "      - \"" port_mapping "\""
			added=1
		}
		END { if (!added) exit 1 }
	' "$COMPOSE_FILE" >"$tmp"; then
		rm -f "$tmp"
		echo "could not add private metrics port to Compose service $service" >&2
		return 1
	fi
	chmod --reference="$COMPOSE_FILE" "$tmp"
	mv "$tmp" "$COMPOSE_FILE"
}

normalize_crowdsec_appsec_acquisition() {
	local acquisition="$CROWDSEC_DIR/conf/acquis.d/npmplus.yaml"
	[[ -s "$acquisition" ]] || return 0
	# CrowdSec still accepts the old singular key, but documents it as
	# deprecated. Migrate installer-managed legacy acquisitions in place.
	if grep -qE '^appsec_config:[[:space:]]*' "$acquisition"; then
		sed -i -E 's|^appsec_config:[[:space:]]*(.+)$|appsec_configs:\n  - \1|' "$acquisition"
		say "migrated CrowdSec AppSec acquisition to current list syntax"
	fi
}

enable_crowdsec_appsec() {
	local acquisition="$CROWDSEC_DIR/conf/acquis.d/npmplus.yaml"
	local bouncer_conf="$DATA_DIR/crowdsec/crowdsec.conf"
	local api_url appsec_url

	[[ -s "$acquisition" ]] || { echo "CrowdSec acquisition config is missing: $acquisition" >&2; return 1; }
	[[ -s "$bouncer_conf" ]] || { echo "CrowdSec bouncer config is missing: $bouncer_conf" >&2; return 1; }

	# Keep the log acquisition document untouched and append the installer-owned
	# AppSec listener only when it is not already present.
	if ! grep -qE '^source:[[:space:]]*appsec[[:space:]]*$' "$acquisition"; then
		printf '\n' >>"$acquisition"
		cat >>"$acquisition" <<'EOF'
---
listen_addr: 0.0.0.0:7422
appsec_configs:
  - crowdsecurity/appsec-default
name: appsec
source: appsec
labels:
  type: appsec
EOF
	fi
	normalize_crowdsec_appsec_acquisition

	# Reuse the bouncer's known-good LAPI host so this works for both bridge and
	# host networking without guessing from the Compose layout.
	api_url=$(sed -n 's/^API_URL=//p' "$bouncer_conf" | head -1)
	case "$api_url" in
		http://*:8080) appsec_url="${api_url%:8080}:7422" ;;
		*) echo "cannot derive AppSec endpoint from CrowdSec API_URL" >&2; return 1 ;;
	esac
	if grep -q '^APPSEC_URL=' "$bouncer_conf"; then
		sed -i "s|^APPSEC_URL=.*|APPSEC_URL=$appsec_url|" "$bouncer_conf"
	else
		printf 'APPSEC_URL=%s\n' "$appsec_url" >>"$bouncer_conf"
	fi
	chmod 600 "$bouncer_conf"
	say "CrowdSec AppSec enabled (default high-confidence rules)"
}

# The official Anubis image is non-root. A root-owned bind mount lets it read
# the policy but makes the bbolt database and honeypot log unwritable, which
# sends the container into a restart loop. Discover the numeric image user so
# this keeps working if Anubis changes it in a later release.
ANUBIS_DATA_REPAIRED="false"
prepare_anubis_data() { # prepare_anubis_data <image-ref>
	local image_ref="$1" image_user uid gid honeypot_log
	image_user=$(docker image inspect --format '{{.Config.User}}' "$image_ref" 2>/dev/null || true)
	case "$image_user" in
		[0-9]*:[0-9]*) uid=${image_user%%:*}; gid=${image_user#*:} ;;
		[0-9]*) uid=$image_user; gid=$image_user ;;
		*)
			echo "cannot determine the numeric Anubis image user for $image_ref" >&2
			return 1
			;;
	esac
	install -d -m 0750 -o "$uid" -g "$gid" /opt/anubis-data /opt/anubis-data/anubis
	honeypot_log=/opt/anubis-data/anubis/honeypot.addrs
	# Docker creates a directory when the source of a file bind mount does not
	# exist. Repair that exact empty placeholder, but refuse to discard anything.
	if [[ -d "$honeypot_log" ]]; then
		rmdir -- "$honeypot_log" || {
			echo "cannot replace non-empty Anubis honeypot path: $honeypot_log" >&2
			return 1
		}
		ANUBIS_DATA_REPAIRED="true"
	fi
	if [[ -e "$honeypot_log" && ! -f "$honeypot_log" ]]; then
		echo "Anubis honeypot path is not a regular file: $honeypot_log" >&2
		return 1
	fi
	if [[ ! -e "$honeypot_log" ]]; then
		install -m 0640 -o "$uid" -g "$gid" /dev/null "$honeypot_log"
		ANUBIS_DATA_REPAIRED="true"
	else
		chown "$uid:$gid" "$honeypot_log"
		chmod 0640 "$honeypot_log"
	fi
	chown -R "$uid:$gid" /opt/anubis-data
}

ANUBIS_MOUNT_MIGRATED="false"
migrate_anubis_honeypot_mount() {
	local old_mount new_mount tmp backup
	old_mount='/opt/anubis-data/anubis/honeypot.addrs:/data/anubis/honeypot.addrs:ro'
	new_mount='/opt/anubis-data/anubis:/run/npmplus-anubis:ro'
	grep -Fq "$old_mount" "$COMPOSE_FILE" || return 0

	tmp=$(mktemp "${COMPOSE_FILE}.honeypot.XXXXXX")
	cp -a "$COMPOSE_FILE" "$tmp"
	sed -i "s|$old_mount|$new_mount|" "$tmp"
	if ! grep -q 'ANUBIS_HONEYPOT_LOG_FILE=' "$tmp"; then
		sed -i '/AUTH_REQUEST_ANUBIS_UPSTREAM=/a\      - "ANUBIS_HONEYPOT_LOG_FILE=/run/npmplus-anubis/honeypot.addrs"' "$tmp"
	fi
	if ! docker compose -f "$tmp" config --quiet; then
		rm -f -- "$tmp"
		echo "refusing invalid Anubis honeypot mount migration" >&2
		return 1
	fi
	backup="${COMPOSE_FILE}.bak.honeypot-mount-v1.23"
	[[ -e "$backup" ]] || cp -a "$COMPOSE_FILE" "$backup"
	chmod 600 "$tmp"
	mv -f -- "$tmp" "$COMPOSE_FILE"
	ANUBIS_MOUNT_MIGRATED="true"
	say "repaired legacy Anubis honeypot mount"
}

anubis_latest_version() {
	local latest_url version
	# GitHub's releases/latest web redirect is not subject to the small anonymous
	# REST API quota. Read its final URL, then validate the tag before using it in
	# either a registry reference or a raw-content URL.
	latest_url=$(fetch https://github.com/TecharoHQ/anubis/releases/latest \
		-o /dev/null -w '%{url_effective}\n')
	version=${latest_url##*/}
	[[ "$version" =~ ^v[0-9][0-9A-Za-z._+-]*$ ]] || {
		echo "could not determine the latest Anubis release from $latest_url" >&2
		return 1
	}
	printf '%s\n' "$version"
}

# fetch the bot policy for a given anubis release and adapt it for the auth_request
# integration; refuses to deploy if upstream changed the policy format
anubis_policy() { # anubis_policy <version> [challenge_all]
	fetch "https://raw.githubusercontent.com/TecharoHQ/anubis/refs/tags/$1/data/botPolicies.yaml" -o /opt/anubis.yaml
	# auth_request needs 401/403 instead of anubis' scraper-friendly 200s
	sed -E -i 's/^([[:space:]]*CHALLENGE:)[[:space:]]*.*/\1 401/; s/^([[:space:]]*DENY:)[[:space:]]*.*/\1 403/' /opt/anubis.yaml
	# the docs advise against the memory store in production; bbolt survives restarts
	sed -E -i 's/^([[:space:]]*backend:)[[:space:]]*memory$/\1 bbolt/; s/^([[:space:]]*parameters:)[[:space:]]*\{\}$/\1\n      path: \/data\/anubis.bdb/' /opt/anubis.yaml
	# log honeypot-caught IPs so the crowdsec bridge can ban them
	sed -E -i 's/^([[:space:]]*implementation:)[[:space:]]*naive$/\1 naive\n  ip_log_file: \/data\/anubis\/honeypot.addrs/' /opt/anubis.yaml
	if [[ "${2:-}" == "y" ]]; then
		# challenge everything no other rule matched; appended as the last bot rule,
		# so known-good crawlers and allowlisted paths still pass first
		awk '
			/^bots:/ {inb=1}
			inb && !done && /^[A-Za-z]/ && !/^bots:/ {
				print "  # challenge everything that no other rule matched"
				print "  - name: everything-else"
				print "    user_agent_regex: \".*\""
				print "    action: CHALLENGE"
				print ""
				done=1
			}
			{print}
		' /opt/anubis.yaml >/opt/anubis.yaml.tmp && mv /opt/anubis.yaml.tmp /opt/anubis.yaml
	fi
	# a changed upstream format must fail loudly, not silently drop the protection
	grep -q "CHALLENGE: 401" /opt/anubis.yaml || { echo "anubis policy $1: status code sed did not apply - upstream format changed" >&2; exit 1; }
	grep -q "DENY: 403" /opt/anubis.yaml || { echo "anubis policy $1: deny code sed did not apply - upstream format changed" >&2; exit 1; }
	grep -q "backend: bbolt" /opt/anubis.yaml || { echo "anubis policy $1: store sed did not apply - upstream format changed" >&2; exit 1; }
	grep -q "ip_log_file:" /opt/anubis.yaml || { echo "anubis policy $1: honeypot sed did not apply - upstream format changed" >&2; exit 1; }
	[[ "${2:-}" != "y" ]] || grep -q "name: everything-else" /opt/anubis.yaml || { echo "anubis policy $1: catchall rule did not apply - upstream format changed" >&2; exit 1; }
}

register_bouncer() { # $1 = name -> key on stdout (empty on failure)
	local key="" _
	# a heal can hit a name that still exists in the lapi while its key is dead
	# (rolled-back sqlite); cscli add refuses duplicates, so clear the corpse first
	docker exec crowdsec cscli bouncers delete "$1" >/dev/null 2>&1 || true
	for _ in $(seq 1 30); do
		key=$(docker exec crowdsec cscli bouncers add "$1" -o raw 2>/dev/null || true)
		# cscli without -o raw support: pull the key out of the human table
		[[ -n "$key" ]] || key=$(docker exec crowdsec cscli bouncers add "$1" 2>/dev/null | grep -oE '[[:alnum:]]{20,}' || true)
		[[ -n "$key" ]] && { echo "$key"; return 0; }
		sleep 2
	done
	return 1
}

# a key file can exist and still be dead: an unclean shutdown can roll back or
# corrupt crowdsec's sqlite, and then the lapi no longer knows the registration.
# verify = ask the lapi, so a heal only fires on a key it actually rejects.
bouncer_key_works() { # $1 = bouncer key -> 0 when the lapi accepts it
	[[ -n "$1" ]] || return 1
	printf 'header = "X-Api-Key: %s"\n' "$1" | \
		curl -sS -m 5 -o /dev/null -w '%{http_code}' --config - \
		"http://127.0.0.1:8080/v1/decisions?limit=1" 2>/dev/null | grep -q '^200'
}

machine_key_works() { # $1 = machine id, $2 = password -> 0 on a working login
	[[ -n "$2" ]] || return 1
	printf '{"machine_id":"%s","password":"%s"}' "$1" "$2" | \
		curl -sS -m 5 -o /dev/null -w '%{http_code}' -H "Content-Type: application/json" \
		--data-binary @- "http://127.0.0.1:8080/v1/watchers/login" 2>/dev/null | grep -q '^200'
}

register_machine() { # $1 = name -> machine password on stdout (empty on failure)
	local out="" password="" _
	for _ in $(seq 1 30); do
		# -a generates the password, -f - dumps the credentials as yaml;
		# the yaml goes to stderr on newer cscli and stdout on older, so merge
		out=$(docker exec crowdsec cscli machines add "$1" -a -f - --force 2>&1 || true)
		# cscli without --force support: plain add, the machine exists case just fails
		password=$(sed -n 's/^password:[[:space:]]*//p' <<<"$out" | head -1)
		if [[ -z "$password" ]]; then
			out=$(docker exec crowdsec cscli machines add "$1" -a -f - 2>&1 || true)
			password=$(sed -n 's/^password:[[:space:]]*//p' <<<"$out" | head -1)
		fi
		[[ -n "$password" ]] && { echo "$password"; return 0; }
		sleep 2
	done
	return 1
}

# a native crowdsec daemon binds 127.0.0.1:8080 before the container's
# publish can and then rejects every key this stack registers - the
# debian-packaged firewall bouncer pulls it in via Recommends. sweep it
# whenever we manage the dockerized stack
remove_native_crowdsec() {
	package_is_installed crowdsec || return 0
	say "removing a native crowdsec (its daemon steals the container's lapi port)"
	systemctl disable --now crowdsec >/dev/null 2>&1 || true
	if ! apt-get remove -y -qq crowdsec; then
		echo "failed to remove the conflicting native CrowdSec package" >&2
		return 1
	fi
	if package_is_installed crowdsec; then
		echo "native CrowdSec is still installed; refusing to start a conflicting container" >&2
		return 1
	fi
}

# the generated host tooling (safe-update, backup, key heal + their crons):
# one definition, installed by both the interactive setup and --update
install_host_tooling() {
say "installing monthly safe-update (snapshot -> update -> health check -> auto-revert)"
# the cron needs the setup script at a known path; running via curl|bash has no file to copy
if [[ -f "$0" ]] && head -1 "$0" | grep -q '^#!/bin/bash'; then
	setup_source=$(readlink -f "$0")
	setup_target=$(readlink -f "$DATA_DIR/setup-npmplus.sh" 2>/dev/null || printf '%s/setup-npmplus.sh' "$DATA_DIR")
	[[ "$setup_source" == "$setup_target" ]] || cp -a "$setup_source" "$DATA_DIR/setup-npmplus.sh"
fi
if [[ -s "$DATA_DIR/setup-npmplus.sh" ]]; then
	chmod 700 "$DATA_DIR/setup-npmplus.sh"
	write_root_file /usr/local/bin/npmplus-safe-update 700 <<'EOF'
#!/bin/bash
# NPMPLUS_SAFE_UPDATE_WRAPPER_VERSION=5
# monthly npmplus update with a safety net: snapshots the running state,
# runs the update, health-checks it, and reverts to the snapshot on failure
set -euo pipefail

COMPOSE_FILE=/opt/npmplus/compose.yaml
SETUP=/opt/npmplus/setup-npmplus.sh
BACKUP=/var/backups/npmplus-last-good
CANDIDATE=${NPMPLUS_SETUP_CANDIDATE:-}

log() { echo "$(date '+%F %T') $*"; }

# Updates, backups and manual maintenance must not race over sqlite/config files.
exec 9>/run/lock/npmplus-maintenance.lock
flock -n 9 || { log "another NPMplus maintenance job is already running"; exit 1; }

revert() {
	log "health check FAILED - reverting to the last good state"
	docker compose -f "$COMPOSE_FILE" ps -a >"$BACKUP/failed-ps.txt" 2>&1 || true
	docker compose -f "$COMPOSE_FILE" logs --no-color --tail 200 >"$BACKUP/failed-logs.txt" 2>&1 || true
	[[ ! -x /usr/local/sbin/npmplus-cloudflare-origin-lock ]] || \
		/usr/local/sbin/npmplus-cloudflare-origin-lock stop >/dev/null 2>&1 || true
	[[ ! -x /usr/local/sbin/npmplus-boot-guard ]] || \
		/usr/local/sbin/npmplus-boot-guard apply >/dev/null 2>&1 || true
	systemctl disable --now npmplus-public.service npmplus-cloudflare-origin-lock.service \
		npmplus-boot-guard.service >/dev/null 2>&1 || true
	docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true
	cp -a "$BACKUP/compose.yaml" "$COMPOSE_FILE"
	if [[ -s "$BACKUP/anubis.yaml" ]]; then
		cp -a "$BACKUP/anubis.yaml" /opt/anubis.yaml
	else
		rm -f /opt/anubis.yaml
	fi
	if [[ -d "$BACKUP/crowdsec" ]]; then
		rm -rf /opt/crowdsec
		cp -a "$BACKUP/crowdsec" /opt/crowdsec
	fi
	if [[ -d "$BACKUP/anubis-data" ]]; then
		rm -rf /opt/anubis-data
		cp -a "$BACKUP/anubis-data" /opt/anubis-data
	fi
	if [[ -s "$BACKUP/database.sqlite" ]]; then
		cp -a "$BACKUP/database.sqlite" /opt/npmplus/npmplus/database.sqlite
		chmod 600 /opt/npmplus/npmplus/database.sqlite
		rm -f /opt/npmplus/npmplus/database.sqlite-wal /opt/npmplus/npmplus/database.sqlite-shm
	fi
	# --update refreshes these before touching images; roll them back as well.
	[[ -s "$BACKUP/setup-npmplus.sh" ]] && cp -a "$BACKUP/setup-npmplus.sh" "$SETUP"
	rm -f /usr/local/bin/npmplus-safe-update /usr/local/bin/npmplus-backup \
		/usr/local/bin/npmplus-crowdsec-heal
	rm -f /etc/cron.d/npmplus-safe-update /etc/cron.d/npmplus-backup \
		/etc/cron.d/npmplus-crowdsec-heal
	for f in npmplus-safe-update npmplus-backup npmplus-crowdsec-heal; do
		[[ -s "$BACKUP/$f" ]] && cp -a "$BACKUP/$f" "/usr/local/bin/$f"
	done
	for f in npmplus-safe-update npmplus-backup npmplus-crowdsec-heal; do
		[[ -s "$BACKUP/cron-$f" ]] && cp -a "$BACKUP/cron-$f" "/etc/cron.d/$f"
	done
	rm -f /etc/systemd/system/npmplus-public.service \
		/etc/systemd/system/npmplus-cloudflare-origin-lock.service \
		/etc/systemd/system/npmplus-boot-guard.service \
		/usr/local/sbin/npmplus-start-protected \
		/usr/local/sbin/npmplus-cloudflare-origin-lock \
		/usr/local/sbin/npmplus-boot-guard \
		/etc/cron.d/npmplus-cloudflare-origin-lock \
		/var/lib/npmplus/strict-boot-protection \
		/var/lib/npmplus/cloudflare-origin-lock \
		/var/lib/npmplus/cloudflare-ips-v4 \
		/var/lib/npmplus/cloudflare-ips-v6
	[[ ! -s "$BACKUP/host-security.tar.gz" ]] || tar -xzf "$BACKUP/host-security.tar.gz" -C /
	systemctl daemon-reload >/dev/null 2>&1 || true
	if [[ -f /var/lib/npmplus/cloudflare-origin-lock ]]; then
		systemctl enable --now npmplus-cloudflare-origin-lock.service >/dev/null || true
	fi
	if [[ -f /var/lib/npmplus/strict-boot-protection ]]; then
		# The restored Compose file is already digest-pinned. Use the protected
		# starter so rollback does not create a public pre-enforcement window.
		systemctl enable npmplus-boot-guard.service >/dev/null || true
		systemctl enable --now npmplus-public.service >/dev/null || true
	elif [[ -s "$BACKUP/override.yaml" ]]; then
		# pin every service back to its exact pre-update image; --pull never keeps
		# a bad :latest from sneaking back in
		docker compose -f "$COMPOSE_FILE" -f "$BACKUP/override.yaml" up -d --pull never
	else
		docker compose -f "$COMPOSE_FILE" up -d --pull never
	fi
	if [[ ! -f /var/lib/npmplus/strict-boot-protection ]]; then
		for binary in iptables ip6tables; do
			command -v "$binary" >/dev/null || continue
			while "$binary" -t raw -C PREROUTING -p tcp -m multiport --dports 80,443 -j NPMPLUS-BOOT >/dev/null 2>&1; do
				"$binary" -t raw -D PREROUTING -p tcp -m multiport --dports 80,443 -j NPMPLUS-BOOT
			done
			while "$binary" -t raw -C PREROUTING -p udp -m multiport --dports 443 -j NPMPLUS-BOOT >/dev/null 2>&1; do
				"$binary" -t raw -D PREROUTING -p udp -m multiport --dports 443 -j NPMPLUS-BOOT
			done
			"$binary" -t raw -F NPMPLUS-BOOT >/dev/null 2>&1 || true
			"$binary" -t raw -X NPMPLUS-BOOT >/dev/null 2>&1 || true
		done
	fi
	log "reverted - failure diagnostics are in $BACKUP/failed-{ps,logs}.txt"
	exit 1
}

# snapshot the currently running (presumed good) state
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
cp -a "$COMPOSE_FILE" "$BACKUP/compose.yaml"
cp -a /opt/anubis.yaml "$BACKUP/anubis.yaml" 2>/dev/null || rm -f "$BACKUP/anubis.yaml"
cp -a "$SETUP" "$BACKUP/setup-npmplus.sh"
for f in npmplus-safe-update npmplus-backup npmplus-crowdsec-heal; do
	rm -f "$BACKUP/$f" "$BACKUP/cron-$f"
	cp -a "/usr/local/bin/$f" "$BACKUP/$f" 2>/dev/null || true
	cp -a "/etc/cron.d/$f" "$BACKUP/cron-$f" 2>/dev/null || true
done
host_security_paths=(
	etc/systemd/system/npmplus-public.service
	etc/systemd/system/npmplus-cloudflare-origin-lock.service
	etc/systemd/system/npmplus-boot-guard.service
	usr/local/sbin/npmplus-start-protected
	usr/local/sbin/npmplus-cloudflare-origin-lock
	usr/local/sbin/npmplus-boot-guard
	etc/cron.d/npmplus-cloudflare-origin-lock
	var/lib/npmplus/strict-boot-protection
	var/lib/npmplus/cloudflare-origin-lock
	var/lib/npmplus/cloudflare-ips-v4
	var/lib/npmplus/cloudflare-ips-v6
)
host_security_existing=()
for path in "${host_security_paths[@]}"; do
	[[ -e "/$path" ]] && host_security_existing+=("$path")
done
rm -f "$BACKUP/host-security.tar.gz"
if [[ ${#host_security_existing[@]} -gt 0 ]]; then
	tar -czf "$BACKUP/host-security.tar.gz" -C / "${host_security_existing[@]}"
fi

# Never update a stack that is already incomplete; it would produce an unsafe
# rollback baseline and could bring an intentionally stopped service online.
while read -r svc; do
	cid=$(docker compose -f "$COMPOSE_FILE" ps --status running -q "$svc" 2>/dev/null)
	[[ -n "$cid" ]] || {
		log "pre-update check failed: $svc is not running"
		exit 1
	}
	health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || true)
	if [[ "$health" == "starting" ]]; then
		log "pre-update check: waiting up to 180 seconds for $svc health"
		for _ in $(seq 1 90); do
			sleep 2
			health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || true)
			[[ "$health" == "starting" ]] || break
		done
	fi
	[[ "$health" == "none" || "$health" == "healthy" ]] || {
		log "pre-update check failed: $svc health is $health"
		exit 1
	}
done < <(docker compose -f "$COMPOSE_FILE" config --services)
curl -fkSs --connect-timeout 5 --max-time 10 -o /dev/null https://127.0.0.1/ || {
	log "pre-update check failed: public HTTPS listener is not healthy"
	exit 1
}
curl -fkSs --connect-timeout 5 --max-time 10 https://127.0.0.1:81/api | grep -qE '"status"[[:space:]]*:[[:space:]]*"OK"' || {
	log "pre-update check failed: admin API is not healthy"
	exit 1
}
if grep -q '^APPSEC_URL=.' /opt/npmplus/crowdsec/crowdsec.conf 2>/dev/null && \
	! timeout 3 bash -c 'exec 3<>/dev/tcp/127.0.0.1/7422'; then
	log "pre-update check failed: AppSec is configured but its listener is not healthy"
	exit 1
fi

# Take an online sqlite backup before a new image can run migrations. Refuse to
# call an update safe when the rollback database cannot be created.
rm -f "$BACKUP/database.sqlite"
if [[ -f /opt/npmplus/npmplus/database.sqlite ]]; then
	rm -f /opt/npmplus/npmplus/database.pre-update.sqlite
	docker exec npmplus node -e "const d=require('better-sqlite3')('/data/npmplus/database.sqlite',{readonly:true});d.backup('/data/npmplus/database.pre-update.sqlite').then(()=>d.close())"
	cp -a /opt/npmplus/npmplus/database.pre-update.sqlite "$BACKUP/database.sqlite"
	chmod 600 "$BACKUP/database.sqlite"
	rm -f /opt/npmplus/npmplus/database.pre-update.sqlite
fi

# CrowdSec sqlite/WAL and Anubis bbolt copies must be made while their writers
# are stopped. The brief stop occurs before any image changes and each service
# is restarted immediately after its snapshot.
rm -rf "$BACKUP/crowdsec" "$BACKUP/anubis-data"
stopped_svc=""
restart_snapshot_service() {
	if [[ -n "$stopped_svc" ]]; then
		log "restarting $stopped_svc after an interrupted snapshot"
		docker compose -f "$COMPOSE_FILE" start "$stopped_svc" >/dev/null 2>&1 || true
	fi
}
trap restart_snapshot_service EXIT
for spec in "crowdsec:/opt/crowdsec:crowdsec" "anubis:/opt/anubis-data:anubis-data"; do
	IFS=: read -r svc source name <<<"$spec"
	if docker compose -f "$COMPOSE_FILE" config --services | grep -qx "$svc" && [[ -d "$source" ]]; then
		docker compose -f "$COMPOSE_FILE" stop "$svc"
		stopped_svc="$svc"
		rm -rf "$BACKUP/${name:?}"
		if ! cp -a "$source" "$BACKUP/$name"; then
			docker compose -f "$COMPOSE_FILE" start "$svc" || true
			stopped_svc=""
			exit 1
		fi
		docker compose -f "$COMPOSE_FILE" start "$svc"
		stopped_svc=""
	fi
done
trap - EXIT
{
	echo "services:"
	while read -r svc id; do
		echo "  $svc:"
		echo "    image: \"$id\""
	done < <(for s in $(docker compose -f "$COMPOSE_FILE" config --services); do
		cid=$(docker compose -f "$COMPOSE_FILE" ps -q "$s" 2>/dev/null || true)
		[[ -n "$cid" ]] && echo "$s $(docker inspect --format '{{.Image}}' "$cid")"
	done)
} >"$BACKUP/override.yaml"

log "running update"
if [[ -n "$CANDIDATE" && "$CANDIDATE" != "$SETUP" ]]; then
	cp -a "$CANDIDATE" "$SETUP" || revert
	chmod 700 "$SETUP" || revert
fi
NPMPLUS_SAFE_UPDATE_ACTIVE=true "$SETUP" --update || revert

# crowdsec hub: refresh the detection signatures (parsers/scenarios/collections);
# a container image update alone never touches them and they live outside the image
if docker compose -f "$COMPOSE_FILE" ps --status running --format '{{.Name}}' 2>/dev/null | grep -qx crowdsec; then
	docker exec crowdsec cscli hub update
	docker exec crowdsec cscli hub upgrade || log "cscli hub upgrade reported failures (kept, check: docker exec crowdsec cscli hub list)"
fi

# Health check every configured service, Docker health where present, both
# NPMplus listeners, and CrowdSec's own LAPI. HTTP error responses must fail.
bouncer_http_code() {
	printf 'header = "X-Api-Key: %s"\n' "$1" | curl -sS --connect-timeout 5 --max-time 10 \
		-o /dev/null -w '%{http_code}' --config - 'http://127.0.0.1:8080/v1/decisions?limit=1'
}
machine_http_code() {
	printf '{"machine_id":"npmplus-ui","password":"%s"}' "$1" | curl -sS --connect-timeout 5 --max-time 10 \
		-o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' --data-binary @- \
		'http://127.0.0.1:8080/v1/watchers/login'
}
check() {
	local svc cid state health key machine_password
	while read -r svc; do
		cid=$(docker compose -f "$COMPOSE_FILE" ps -a -q "$svc" 2>/dev/null)
		[[ -n "$cid" ]] || { log "$svc has no container"; return 1; }
		state=$(docker inspect --format '{{.State.Status}}' "$cid")
		[[ "$state" == "running" ]] || { log "$svc state is $state"; return 1; }
		health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")
		[[ "$health" == "none" || "$health" == "healthy" ]] || { log "$svc health is $health"; return 1; }
	done < <(docker compose -f "$COMPOSE_FILE" config --services)
	curl -fkSs --connect-timeout 5 --max-time 10 -o /dev/null https://127.0.0.1/ || return 1
	curl -fkSs --connect-timeout 5 --max-time 10 https://127.0.0.1:81/api | grep -qE '"status"[[:space:]]*:[[:space:]]*"OK"' || return 1
	if grep -q '^APPSEC_URL=.' /opt/npmplus/crowdsec/crowdsec.conf 2>/dev/null; then
		timeout 3 bash -c 'exec 3<>/dev/tcp/127.0.0.1/7422' || return 1
	fi
	if docker compose -f "$COMPOSE_FILE" config --services | grep -qx crowdsec; then
		docker exec crowdsec cscli lapi status >/dev/null 2>&1 || return 1
		key=$(cat /opt/npmplus/crowdsec/lapi-ui.key 2>/dev/null || true)
		[[ -n "$key" ]] || return 1
		[[ "$(bouncer_http_code "$key")" == "200" ]] || return 1
		key=$(sed -n 's/^API_KEY=//p' /opt/npmplus/crowdsec/crowdsec.conf 2>/dev/null)
		[[ -n "$key" ]] || return 1
		[[ "$(bouncer_http_code "$key")" == "200" ]] || return 1
		machine_password=$(cat /opt/npmplus/crowdsec/lapi-ui-machine.key 2>/dev/null || true)
		[[ -n "$machine_password" ]] || return 1
		[[ "$(machine_http_code "$machine_password")" == "200" ]] || return 1
	fi
}
sleep 30
check || { sleep 60; check || revert; }
log "update healthy - last good snapshot kept in $BACKUP"
EOF
	printf '37 4 1 * * root /usr/local/bin/npmplus-safe-update >>/var/log/npmplus-update.log 2>&1\n' >/etc/cron.d/npmplus-safe-update
	chmod 644 /etc/cron.d/npmplus-safe-update
	touch /var/log/npmplus-update.log && chmod 640 /var/log/npmplus-update.log
else
	echo "safe-update cron NOT installed: copy setup-npmplus.sh to $DATA_DIR/ manually, then rerun" >&2
fi

say "installing daily data backup (keeps the last 7)"
write_root_file /usr/local/bin/npmplus-backup 755 <<'EOF'
#!/bin/bash
# daily npmplus backup. the tar contains the data dir (database, certs, htpasswd
# files), the crowdsec dir and the anubis policy. restores: untar into / and, if
# present, copy npmplus/database.backup.sqlite over npmplus/database.sqlite (it
# is the consistent copy, see below), then: docker compose up -d
set -euo pipefail

BACKUP_DIR=/var/backups/npmplus
KEEP=7 # one week of daily backups
LOG=/var/log/npmplus-backup.log
exec >>"$LOG" 2>&1

exec 9>/run/lock/npmplus-maintenance.lock
flock -n 9 || { echo "$(date '+%F %T') another NPMplus maintenance job is already running"; exit 1; }

log() { echo "$(date '+%F %T') $*"; }

# the tars contain private keys and the database, so keep them root-only
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# hot-copy the database with better-sqlite3 so a copy is never torn mid-write;
# the plain live file is still in the tar as a fallback if this ever fails
if ! docker exec npmplus node -e "const d=require('better-sqlite3')('/data/npmplus/database.sqlite',{readonly:true});d.backup('/data/npmplus/database.backup.sqlite').then(()=>d.close())" >/dev/null 2>&1; then
	log "warning: consistent database copy failed, tar will contain the live file"
fi

files=(opt/npmplus opt/crowdsec)
[[ -f /opt/anubis.yaml ]] && files+=(opt/anubis.yaml)
ts=$(date +%F-%H%M%S)
out="$BACKUP_DIR/npmplus-$ts.tar.gz"
tar -czf "$out" -C / "${files[@]}" || { log "backup FAILED (tar)"; exit 1; }
chmod 600 "$out"
rm -f /opt/npmplus/npmplus/database.backup.sqlite
log "backup ok: $out ($(du -h "$out" | cut -f1))"

# roll the oldest off, keep the last KEEP
mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'npmplus-*.tar.gz' -printf '%f\n' | sort -r)
for old in "${backups[@]:$KEEP}"; do
	rm -f -- "$BACKUP_DIR/$old"
done
EOF
printf '17 2 * * * root /usr/local/bin/npmplus-backup\n' >/etc/cron.d/npmplus-backup
chmod 644 /etc/cron.d/npmplus-backup
touch /var/log/npmplus-backup.log && chmod 640 /var/log/npmplus-backup.log

# crowdsec's sqlite can roll back on an unclean shutdown and silently kill
# every key registration - that already broke this install's ui and nginx
# bouncer. --update heals it, but only when someone runs it, so verify all
# three keys against the lapi daily and re-register the rejected ones here
say "installing crowdsec key heal (daily cron, log: /var/log/npmplus-crowdsec-heal.log)"
write_root_file /usr/local/bin/npmplus-crowdsec-heal 755 <<'EOF'
#!/bin/bash
set -uo pipefail

LOG=/var/log/npmplus-crowdsec-heal.log
exec >>"$LOG" 2>&1
log() { echo "$(date '+%F %T') $*"; }
DATA_DIR=/opt/npmplus

docker ps --format '{{.Names}}' 2>/dev/null | grep -qx crowdsec || { log "crowdsec not running, skipped"; exit 0; }

# a native crowdsec steals the lapi port and no heal can help while its
# daemon runs - name the cause instead of failing keys forever
[[ "$(dpkg-query -W -f='${Status}' crowdsec 2>/dev/null || true)" == "install ok installed" ]] && \
	log "WARNING: native crowdsec package installed - if keys keep failing, run crowdsec-doctor.sh"

bouncer_key_works() { # $1 = bouncer key -> 0 when the lapi accepts it
	[[ -n "$1" ]] || return 1
	printf 'header = "X-Api-Key: %s"\n' "$1" | \
		curl -sS -m 5 -o /dev/null -w '%{http_code}' --config - \
		"http://127.0.0.1:8080/v1/decisions?limit=1" 2>/dev/null | grep -q '^200'
}

machine_key_works() { # $1 = machine id, $2 = password -> 0 on a working login
	[[ -n "$2" ]] || return 1
	printf '{"machine_id":"%s","password":"%s"}' "$1" "$2" | \
		curl -sS -m 5 -o /dev/null -w '%{http_code}' -H "Content-Type: application/json" \
		--data-binary @- "http://127.0.0.1:8080/v1/watchers/login" 2>/dev/null | grep -q '^200'
}

register_bouncer() { # $1 = name -> key on stdout (empty on failure)
	local key="" _
	# cscli add refuses duplicates, so clear the dead registration first
	docker exec crowdsec cscli bouncers delete "$1" >/dev/null 2>&1 || true
	for _ in $(seq 1 30); do
		key=$(docker exec crowdsec cscli bouncers add "$1" -o raw 2>/dev/null || true)
		[[ -n "$key" ]] && { echo "$key"; return 0; }
		sleep 2
	done
	return 1
}

register_machine() { # $1 = name -> machine password on stdout (empty on failure)
	local out="" password="" _
	for _ in $(seq 1 30); do
		# the yaml goes to stderr on newer cscli and stdout on older, so merge
		out=$(docker exec crowdsec cscli machines add "$1" -a -f - --force 2>&1 || true)
		password=$(sed -n 's/^password:[[:space:]]*//p' <<<"$out" | head -1)
		[[ -n "$password" ]] && { echo "$password"; return 0; }
		sleep 2
	done
	return 1
}

# 1: the read-only bouncer behind the admin UI's live ban view
if [[ ! -s "$DATA_DIR/crowdsec/lapi-ui.key" ]] || ! bouncer_key_works "$(cat "$DATA_DIR/crowdsec/lapi-ui.key" 2>/dev/null)"; then
	log "ui bouncer key rejected - re-registering"
	key=$(register_bouncer npmplus-ui || true)
	if [[ -n "$key" ]]; then
		echo "$key" >"$DATA_DIR/crowdsec/lapi-ui.key"
		chmod 600 "$DATA_DIR/crowdsec/lapi-ui.key"
		log "ui bouncer healed"
	else
		log "ui bouncer heal FAILED"
	fi
fi

# 2: the machine behind unban + alert context (bouncer keys are read-only)
if [[ ! -s "$DATA_DIR/crowdsec/lapi-ui-machine.key" ]] || ! machine_key_works npmplus-ui "$(cat "$DATA_DIR/crowdsec/lapi-ui-machine.key" 2>/dev/null)"; then
	log "ui machine key rejected - re-registering"
	password=$(register_machine npmplus-ui || true)
	if [[ -n "$password" ]]; then
		echo "$password" >"$DATA_DIR/crowdsec/lapi-ui-machine.key"
		chmod 600 "$DATA_DIR/crowdsec/lapi-ui-machine.key"
		log "ui machine healed"
	else
		log "ui machine heal FAILED"
	fi
fi

# 3: the nginx bouncer - a dead key means bans silently stop being enforced,
# so this one also reloads the bouncer after rewriting the key
CONF="$DATA_DIR/crowdsec/crowdsec.conf"
if [[ -s "$CONF" ]]; then
	confkey=$(sed -n 's/^API_KEY=//p' "$CONF")
	if [[ -z "$confkey" ]] || ! bouncer_key_works "$confkey"; then
		log "nginx bouncer key rejected - re-registering"
		key=$(register_bouncer npmplus || true)
		if [[ -n "$key" ]]; then
			sed -i "s|^ENABLED=.*|ENABLED=true|" "$CONF"
			sed -i "s|^API_KEY=.*|API_KEY=$key|" "$CONF"
			docker compose -f "$DATA_DIR/compose.yaml" restart npmplus >/dev/null 2>&1
			log "nginx bouncer healed, npmplus restarted"
		else
			log "nginx bouncer heal FAILED"
		fi
	fi
fi
EOF
printf '42 2 * * * root /usr/local/bin/npmplus-crowdsec-heal\n' >/etc/cron.d/npmplus-crowdsec-heal
chmod 644 /etc/cron.d/npmplus-crowdsec-heal
touch /var/log/npmplus-crowdsec-heal.log && chmod 640 /var/log/npmplus-crowdsec-heal.log
}

# --- dependencies (debian/ubuntu) ------------------------------------------------
if ! command -v curl >/dev/null; then
	if confirm "curl is missing - install it via apt?" "y"; then
		apt-get update -qq && apt-get install -y -qq curl
	else
		echo "curl is required" >&2; exit 1
	fi
fi
if ! command -v docker >/dev/null; then
	if confirm "docker is missing - install it via get.docker.com (official script)?" "y"; then
		run_verified_script "$DOCKER_INSTALL_URL" "$DOCKER_INSTALL_SHA256"
	else
		echo "docker is required" >&2; exit 1
	fi
fi
if ! docker compose version >/dev/null 2>&1; then
	echo "docker compose plugin is required (apt: docker-compose-plugin / docker.io)" >&2
	exit 1
fi
# container restart policies only fire once the daemon is up: without this, a
# reboot leaves the whole stack down until someone starts docker by hand
if command -v systemctl >/dev/null; then
	systemctl enable docker.service >/dev/null 2>&1 || true
	# The daemon must not snapshot an empty /etc/resolv.conf into host-networked
	# containers. network-online.target is a no-op on some ifupdown/dhcpcd hosts,
	# so also put an explicit resolver-file gate in Docker's startup path.
	if systemctl is-active --quiet systemd-networkd.service; then
		systemctl enable systemd-networkd-wait-online.service >/dev/null 2>&1 || true
	elif systemctl is-active --quiet NetworkManager.service; then
		systemctl enable NetworkManager-wait-online.service >/dev/null 2>&1 || true
	fi
	write_root_file /usr/local/sbin/npmplus-wait-for-dns 755 <<'EOF'
#!/bin/sh
# Docker copies the host resolver file into existing containers when it starts.
# Wait until DHCP/resolvconf has published at least one server. This intentionally
# checks configuration rather than an Internet hostname, so an offline LAN can
# still start Docker and serve existing proxy routes.
resolver_file=${NPMPLUS_RESOLV_CONF:-/etc/resolv.conf}
if ! awk '$1 == "nameserver" && $2 != "" { found=1; exit } END { exit !found }' \
	"$resolver_file" 2>/dev/null; then
	echo "npmplus: waiting for a nameserver in $resolver_file before Docker starts" >&2
	until awk '$1 == "nameserver" && $2 != "" { found=1; exit } END { exit !found }' \
		"$resolver_file" 2>/dev/null; do
		sleep 1
	done
fi
EOF
	mkdir -p /etc/systemd/system/docker.service.d
	cat >/etc/systemd/system/docker.service.d/10-wait-for-dns.conf <<'UNIT'
[Unit]
After=network-online.target nss-lookup.target systemd-resolved.service dhcpcd.service
Wants=network-online.target

[Service]
ExecStartPre=/usr/local/sbin/npmplus-wait-for-dns
UNIT
	systemctl daemon-reload >/dev/null 2>&1 || true
fi

# Compare this file with GitHub. The remote copy is never executed here. A
# newer version blocks --update so unattended automation cannot keep deploying
# stale host logic; offline checks remain best-effort.
remote_script=$(fetch "$SELF_URL" 2>/dev/null) || remote_script=""
latest_version=$(sed -n 's/^SCRIPT_VERSION="\([^"]*\)".*/\1/p' <<<"$remote_script" | head -1)
remote_hash=""
local_hash=""
if [[ -n "$remote_script" ]]; then
	remote_hash=$(printf '%s\n' "$remote_script" | sha256sum | cut -d' ' -f1)
	[[ -f "$0" ]] && local_hash=$(sha256sum "$0" | cut -d' ' -f1)
fi
if [[ -n "$latest_version" && "$(printf '%s\n%s\n' "$SCRIPT_VERSION" "$latest_version" | sort -V | tail -1)" == "$latest_version" && "$latest_version" != "$SCRIPT_VERSION" ]]; then
	say "notice: this script is v$SCRIPT_VERSION, GitHub has newer v$latest_version"
	echo "review and re-download it first:"
	echo "  wget -qO setup-npmplus.sh $SELF_URL"
	if [[ "${1:-}" == "--update" && "${NPMPLUS_ALLOW_STALE_SCRIPT:-false}" != "true" ]]; then
		echo "update stopped: set NPMPLUS_ALLOW_STALE_SCRIPT=true only if you intentionally accept the old logic" >&2
		exit 1
	fi
elif [[ -n "$remote_hash" && -n "$local_hash" && "$latest_version" == "$SCRIPT_VERSION" && "$remote_hash" != "$local_hash" ]]; then
	echo "warning: GitHub has different content with the same SCRIPT_VERSION; review before updating" >&2
	[[ "${1:-}" != "--update" || "${NPMPLUS_ALLOW_STALE_SCRIPT:-false}" == "true" ]] || exit 1
fi

say "NPMplus interactive setup"

# --update: no prompts, just pull latest images and redeploy the existing install
if [[ "${1:-}" == "--update" ]]; then
	if [[ ! -s "$COMPOSE_FILE" ]]; then
		echo "no existing install at $COMPOSE_FILE - run without --update first" >&2
		exit 1
	fi
	# RC-era retries could leave the package and our generated configuration in
	# place without the ownership marker when the binary already existed. Adopt
	# only installations carrying both the NPMplus Compose service and our config
	# signature; the marker also records that uninstall may remove this package.
	adopt_legacy_installer_firewall_bouncer
	if [[ "$ENABLE_APPSEC_ON_UPDATE" == "true" ]] && ! grep -q "container_name: crowdsec" "$COMPOSE_FILE"; then
		echo "cannot enable AppSec because this installation has no CrowdSec service" >&2
		exit 1
	fi
	if [[ "$ENABLE_STRICT_BOOT_ON_UPDATE" == "true" ]] && [[ ! -f /var/lib/npmplus/installed-firewall-bouncer ]]; then
		echo "cannot enable strict boot protection without the installer-managed firewall bouncer" >&2
		exit 1
	fi
	if [[ "$ENABLE_CF_ORIGIN_LOCK_ON_UPDATE" == "true" ]] && ! grep -q 'TRUST_CLOUDFLARE=true' "$COMPOSE_FILE"; then
		echo "cannot enable the Cloudflare origin lock: this install does not trust Cloudflare proxy headers" >&2
		echo "reconfigure first and answer yes only when every public hostname is orange-clouded" >&2
		exit 1
	fi
	if [[ "$ENABLE_CF_ORIGIN_LOCK_ON_UPDATE" == "true" && \
		! -f /var/lib/npmplus/strict-boot-protection && "$ENABLE_STRICT_BOOT_ON_UPDATE" != "true" ]]; then
		echo "the Cloudflare origin lock requires strict boot protection to avoid an unfiltered startup window" >&2
		exit 1
	fi
	# Initial credentials are one-time bootstrap inputs. Remove legacy inline
	# values before the safe-update wrapper snapshots compose.yaml, so neither
	# the live file nor the new last-good backup retains the password. Older
	# installs may still have the deleted /run secret bound into their container;
	# recreate it from sanitized Compose so it can survive the next reboot.
	scrub_bootstrap_admin_credentials
	if npmplus_uses_bootstrap_secret_mount; then
		say "repairing stale one-time administrator secret mount"
		if ! recreate_npmplus_without_bootstrap_secret; then
			npmplus_uses_bootstrap_secret_mount || erase_bootstrap_admin_secret
			exit 1
		fi
	fi
	erase_bootstrap_admin_secret
	# Make manual updates use the same transactional snapshot/health/revert path
	# as cron. The environment flag is set only by that wrapper to avoid recursion.
	if [[ "${NPMPLUS_SAFE_UPDATE_ACTIVE:-false}" != "true" ]]; then
		# Repair host services before the safe updater judges the current install.
		# Older LAN sockets raced DHCP, while v1.30 wrote an incomplete firewall
		# bouncer config that current packages reject.
		repair_admin_lan_proxy
		repair_installer_firewall_bouncer
		# Older wrappers either cannot hand off a freshly downloaded candidate or
		# overwrite themselves in place during a nested tooling refresh. Replace
		# them before delegation; this also repairs a missing execute bit.
		if [[ ! -x /usr/local/bin/npmplus-safe-update ]] || \
			! grep -qx '# NPMPLUS_SAFE_UPDATE_WRAPPER_VERSION=5' /usr/local/bin/npmplus-safe-update; then
			install_host_tooling
		fi
		# Repair the v1.6 root-owned Anubis bind mount before the wrapper checks
		# that every service is healthy. Restart only an already crash-looping
		# container; an intentionally stopped service remains stopped.
		if docker inspect npmplus-anubis >/dev/null 2>&1; then
			ANUBIS_CURRENT_IMAGE=$(docker inspect --format '{{.Config.Image}}' npmplus-anubis)
			prepare_anubis_data "$ANUBIS_CURRENT_IMAGE"
			migrate_anubis_honeypot_mount
			if [[ "$ANUBIS_DATA_REPAIRED" == "true" ]] || \
				[[ "$(docker inspect --format '{{.State.Restarting}}' npmplus-anubis)" == "true" ]]; then
				docker restart npmplus-anubis >/dev/null
			fi
		fi
		# The old nested file mount can leave npmplus unable to start. Once its
		# compose entry is migrated, recreate only that container before the safe
		# updater evaluates the healthy baseline. Also recover a stopped container
		# when an operator already applied the corrected mount by hand.
		npmplus_mount_needs_recreate="$ANUBIS_MOUNT_MIGRATED"
		if [[ "$npmplus_mount_needs_recreate" != "true" ]] && \
			grep -Fq '/opt/anubis-data/anubis:/run/npmplus-anubis:ro' "$COMPOSE_FILE" && \
			docker inspect npmplus >/dev/null 2>&1 && \
			[[ "$(docker inspect --format '{{.State.Running}}' npmplus)" != "true" ]]; then
			npmplus_mount_needs_recreate="true"
		fi
		if [[ "$npmplus_mount_needs_recreate" == "true" ]]; then
			docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate npmplus
			mount_repaired=false
			for _ in $(seq 1 180); do
				if [[ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' npmplus)" == "healthy" ]]; then
					mount_repaired=true
					break
				fi
				sleep 1
			done
			if [[ "$mount_repaired" != "true" ]]; then
				docker logs --tail 100 npmplus >&2 || true
				echo "npmplus did not become healthy after the Anubis mount repair" >&2
				exit 1
			fi
		fi
		# Docker can snapshot an empty host resolv.conf into this host-networked
		# container during boot. Its nginx retry cannot see the host file recover
		# because Docker's copy stays empty. Repair that broken resolver before the
		# safe-update wrapper evaluates the rollback baseline.
		if docker inspect npmplus >/dev/null 2>&1 && \
			! docker exec npmplus awk '$1 == "nameserver" && $2 != "" { found=1; exit } END { exit !found }' /etc/resolv.conf >/dev/null 2>&1 && \
			awk '$1 == "nameserver" && $2 != "" { found=1; exit } END { exit !found }' /etc/resolv.conf; then
			say "repairing npmplus container created with an empty boot resolver"
			docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate npmplus
			repaired=false
			for _ in $(seq 1 180); do
				if [[ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' npmplus)" == "healthy" ]]; then
					repaired=true
					break
				fi
				sleep 1
			done
			if [[ "$repaired" != "true" ]]; then
				docker logs --tail 100 npmplus >&2 || true
				echo "npmplus resolver repair did not become healthy" >&2
				exit 1
			fi
		fi
		candidate=$(readlink -f "$0")
		chmod 700 "$candidate"
		NPMPLUS_ENABLE_APPSEC_ON_UPDATE="$ENABLE_APPSEC_ON_UPDATE" \
			NPMPLUS_ENABLE_STRICT_BOOT_ON_UPDATE="$ENABLE_STRICT_BOOT_ON_UPDATE" \
			NPMPLUS_ENABLE_CF_ORIGIN_LOCK_ON_UPDATE="$ENABLE_CF_ORIGIN_LOCK_ON_UPDATE" \
			NPMPLUS_SETUP_CANDIDATE="$candidate" exec /usr/local/bin/npmplus-safe-update
	fi
	say "updating"
	# Resolve update channels once, then persist immutable digests in compose.
	# Later registry tag movement cannot silently change a deployed stack.
	NPMPLUS_IMAGE=$(pin_image "$NPMPLUS_IMAGE_CHANNEL")
	set_compose_service_image npmplus "$NPMPLUS_IMAGE"
	if grep -q "container_name: crowdsec" "$COMPOSE_FILE"; then
		CROWDSEC_IMAGE=$(pin_image "$CROWDSEC_IMAGE_CHANNEL")
		set_compose_service_image crowdsec "$CROWDSEC_IMAGE"
		ensure_crowdsec_metrics_port
		normalize_crowdsec_appsec_acquisition
		[[ "$ENABLE_APPSEC_ON_UPDATE" != "true" ]] || enable_crowdsec_appsec
	fi
	if grep -q "container_name: npmplus-caddy" "$COMPOSE_FILE"; then
		CADDY_IMAGE=$(pin_image "$CADDY_IMAGE_CHANNEL")
		set_compose_service_image npmplus-caddy "$CADDY_IMAGE"
	fi
	# refresh the generated host tooling (safe-update, backup, key heal) so
	# improvements reach existing installs, not just fresh ones
	install_host_tooling
	repair_admin_lan_proxy
	# anubis is release-pinned in the compose; move it to the latest release together
	# with its policy file so the two can never disagree
	if grep -q "npmplus-anubis" "$COMPOSE_FILE"; then
		ANUBIS_VERSION=$(anubis_latest_version)
		ANUBIS_IMAGE=$(pin_image "ghcr.io/techarohq/anubis:$ANUBIS_VERSION")
		set_compose_service_image anubis "$ANUBIS_IMAGE"
		# keep the catchall choice from the existing policy
		CATCHALL="n"
		grep -q "name: everything-else" /opt/anubis.yaml 2>/dev/null && CATCHALL="y"
		say "anubis -> $ANUBIS_VERSION (policy refreshed)"
		anubis_policy "$ANUBIS_VERSION" "$CATCHALL"
	fi
	grep -q "container_name: crowdsec" "$COMPOSE_FILE" && harden_auxiliary_service crowdsec crowdsec
	grep -q "container_name: npmplus-anubis" "$COMPOSE_FILE" && harden_auxiliary_service anubis anubis
	grep -q "container_name: npmplus-caddy" "$COMPOSE_FILE" && harden_auxiliary_service npmplus-caddy caddy
	sed -i 's/no-new-privileges:true/no-new-privileges=true/g' "$COMPOSE_FILE"
	if [[ -f /var/lib/npmplus/strict-boot-protection || "$ENABLE_STRICT_BOOT_ON_UPDATE" == "true" ]]; then
		configure_strict_boot_protection
	fi
	if [[ -f /var/lib/npmplus/cloudflare-origin-lock || "$ENABLE_CF_ORIGIN_LOCK_ON_UPDATE" == "true" ]]; then
		configure_cloudflare_origin_lock
	fi
	# installs made before the crowdsec UI page existed have no bouncer
	# key for it - backfill instead of showing "not wired" in the admin UI.
	# a present but rejected key means crowdsec's db lost the registration
	# (unclean shutdown rolled the sqlite back) - re-register then too
	if grep -q "container_name: crowdsec" "$COMPOSE_FILE"; then
		# a native crowdsec steals 127.0.0.1:8080 from the container and no
		# key heal can help while it exists - sweep before healing
		remove_native_crowdsec
		if [[ ! -s "$DATA_DIR/crowdsec/lapi-ui.key" ]] || ! bouncer_key_works "$(cat "$DATA_DIR/crowdsec/lapi-ui.key" 2>/dev/null)"; then
			say "registering the admin UI bouncer (crowdsec live ban view)"
			UIKEY=$(register_bouncer npmplus-ui || true)
			if [[ -n "$UIKEY" ]]; then
				mkdir -p "$DATA_DIR/crowdsec"
				echo "$UIKEY" >"$DATA_DIR/crowdsec/lapi-ui.key"
				chmod 600 "$DATA_DIR/crowdsec/lapi-ui.key"
			fi
		fi
		# same for the machine the unban action and alert context need;
		# bouncer keys are read-only in the lapi, those two need a machine login
		if [[ ! -s "$DATA_DIR/crowdsec/lapi-ui-machine.key" ]] || ! machine_key_works npmplus-ui "$(cat "$DATA_DIR/crowdsec/lapi-ui-machine.key" 2>/dev/null)"; then
			say "registering the admin UI machine (crowdsec unban + alert context)"
			UIPASSWORD=$(register_machine npmplus-ui || true)
			if [[ -n "$UIPASSWORD" ]]; then
				mkdir -p "$DATA_DIR/crowdsec"
				echo "$UIPASSWORD" >"$DATA_DIR/crowdsec/lapi-ui-machine.key"
				chmod 600 "$DATA_DIR/crowdsec/lapi-ui-machine.key"
			fi
		fi
		# the nginx bouncer: installs from before the "-o raw" fix never got a
		# key (crowdsec saw alerts but nothing was enforced at the proxy), and a
		# rejected key is worse - bans silently stop being enforced, no error
		# anywhere. empty or dead -> (re-)register, the bouncer reloads on restart
		CONF="$DATA_DIR/crowdsec/crowdsec.conf"
		if [[ -s "$CONF" ]]; then
			CONFKEY=$(sed -n 's/^API_KEY=//p' "$CONF")
			if [[ -z "$CONFKEY" ]] || ! bouncer_key_works "$CONFKEY"; then
				say "(re-)registering the nginx bouncer (bans must stay enforced)"
				KEY=$(register_bouncer npmplus || true)
				if [[ -n "$KEY" ]]; then
					sed -i "s|^ENABLED=.*|ENABLED=true|" "$CONF"
					sed -i "s|^API_KEY=.*|API_KEY=$KEY|" "$CONF"
					say "restarting npmplus to load the bouncer"
					docker compose -f "$COMPOSE_FILE" restart npmplus
				fi
			fi
		fi
	fi
	docker compose -f "$COMPOSE_FILE" pull
	# Docker can briefly retain a published port while replacing its old
	# container (most often Caddy on port 80). Give that release race one
	# bounded retry; a real port conflict still fails and triggers rollback.
	if ! docker compose -f "$COMPOSE_FILE" up -d; then
		say "deployment did not start cleanly - retrying once after Docker releases ports"
		sleep 3
		docker compose -f "$COMPOSE_FILE" up -d
	fi
	activate_installer_firewall_bouncer
	if [[ -f /var/lib/npmplus/cloudflare-origin-lock ]]; then
		if systemctl is-active --quiet npmplus-cloudflare-origin-lock.service; then
			/usr/local/sbin/npmplus-cloudflare-origin-lock refresh
		else
			systemctl start npmplus-cloudflare-origin-lock.service
		fi
		systemctl is-active --quiet npmplus-cloudflare-origin-lock.service
	fi
	if [[ -f /var/lib/npmplus/strict-boot-protection ]]; then
		systemctl restart npmplus-public.service
		systemctl is-active --quiet npmplus-public.service
	fi
	say "update done - check: docker compose -f $COMPOSE_FILE ps"
	exit 0
fi

TZ=$(ask "Timezone (TZ identifier, e.g. Europe/Berlin)" "$(cat /etc/timezone 2>/dev/null || echo UTC)")
ADMIN_EMAIL=$(ask "Initial admin email (empty = use setup wizard)" "")
ADMIN_PASSWORD=$(askpw "Initial admin password (empty = use setup wizard)" "")
if [[ -n "$ADMIN_EMAIL" && -z "$ADMIN_PASSWORD" ]] || [[ -z "$ADMIN_EMAIL" && -n "$ADMIN_PASSWORD" ]]; then
	echo "initial admin email and password must either both be set or both be empty" >&2
	exit 1
fi

USE_CROWDSEC="n"; confirm "Enable crowdsec?" "y" && USE_CROWDSEC="y"
USE_APPSEC="n"
USE_FWBOUNCER="n"
USE_STRICT_BOOT="n"
if [[ "$USE_CROWDSEC" == "y" ]]; then
	confirm "Enable crowdsec appsec (recommended WAF protection; disable per host if incompatible)?" "y" && USE_APPSEC="y"
	confirm "Enable the crowdsec firewall bouncer (kernel-level IP bans)?" "y" && USE_FWBOUNCER="y"
	if [[ "$USE_FWBOUNCER" == "y" ]]; then
		confirm "Keep public ports closed during boot until CrowdSec is enforcing bans?" "y" && USE_STRICT_BOOT="y"
	fi
fi
USE_ANUBIS="n"; confirm "Enable anubis (anti-bot proof-of-work)?" "y" && USE_ANUBIS="y"
CHALLENGE_ALL="n"
if [[ "$USE_ANUBIS" == "y" ]]; then
	# strongest anti-bot, but breaks non-browser clients (APIs, RSS, uptime
	# monitors). Safe for general reverse-proxy use only as an explicit opt-in.
	confirm "Challenge everything not matched by any rule?" "n" && CHALLENGE_ALL="y"
fi
USE_CADDY="n"; confirm "Enable caddy (port 80 -> https redirect, so NPMplus only serves https)?" "n" && USE_CADDY="y"
# orange cloud only: with plain dns the visitor ips arrive directly and must NOT be
# taken from cloudflare headers (spoofable by anyone then)
USE_CF="n"; confirm "Are your sites proxied through Cloudflare (orange cloud)?" "y" && USE_CF="y"
USE_CF_ORIGIN_LOCK="n"
if [[ "$USE_CF" == "y" && "$USE_STRICT_BOOT" == "y" ]]; then
	echo "  Optional: direct public access will be blocked; every public DNS record must stay orange-clouded."
	confirm "Lock ports 80/443 to Cloudflare and your private LAN?" "n" && USE_CF_ORIGIN_LOCK="y"
fi
USE_HOST_NETWORK="n"
confirm "Use host networking (only needed when proxy targets use host localhost/127.0.0.1)?" "n" && USE_HOST_NETWORK="y"

# HTTP/3 is always available in NPMplus (enable per host in the UI); it needs 443/udp.
USE_UFW="n"
EXPOSE_ADMIN="n"
ADMIN_BIND_IP=""
ADMIN_LAN_CIDR=""
if ! command -v ufw >/dev/null; then
	if confirm "ufw is not installed - install it via apt?" "y"; then
		apt-get update -qq && apt-get install -y -qq ufw
	else
		echo "skipping host firewall setup" >&2
	fi
fi
if command -v ufw >/dev/null; then
	confirm "Configure UFW firewall (allow SSH, 80, 443/tcp+udp)?" "y" && USE_UFW="y"
	if [[ "$USE_UFW" == "y" ]]; then
		if confirm "Allow the admin UI on port 81 from your private LAN?" "n"; then
			DETECTED_LAN_IP=$(detect_private_lan_ipv4 || true)
			DETECTED_LAN_CIDR=$(detect_private_lan_cidr || true)
			if [[ -z "$DETECTED_LAN_IP" || -z "$DETECTED_LAN_CIDR" ]]; then
				echo "could not detect a private IPv4 LAN; keeping the admin UI on localhost" >&2
			else
				ADMIN_BIND_IP="$DETECTED_LAN_IP"
				ADMIN_LAN_CIDR="$DETECTED_LAN_CIDR"
				private_ipv4 "$ADMIN_BIND_IP" || {
					echo "invalid or non-private LAN address; refusing to expose the admin UI" >&2
					exit 1
				}
				valid_private_ipv4_cidr "$ADMIN_LAN_CIDR" || {
					echo "invalid private IPv4 CIDR; refusing to expose the admin UI" >&2
					exit 1
				}
				EXPOSE_ADMIN="y"
				echo "detected private LAN: admin https://$ADMIN_BIND_IP:81, allowed subnet $ADMIN_LAN_CIDR"
			fi
		fi
	fi
fi
# OS security patches; docker engine updates still need a manual apt upgrade
USE_UNATTENDED="n"; confirm "Enable unattended-upgrades (automatic OS security updates)?" "y" && USE_UNATTENDED="y"

if [[ -s "$COMPOSE_FILE" ]]; then
	cp -a "$COMPOSE_FILE" "$COMPOSE_FILE.bak.$(date +%s)"
	echo "existing compose.yaml backed up"
fi

say "resolving immutable container image digests"
NPMPLUS_IMAGE=$(pin_image "$NPMPLUS_IMAGE_CHANNEL")
if [[ "$USE_CROWDSEC" == "y" ]]; then
	CROWDSEC_IMAGE=$(pin_image "$CROWDSEC_IMAGE_CHANNEL")
fi
if [[ "$USE_ANUBIS" == "y" ]]; then
	ANUBIS_VERSION=$(anubis_latest_version)
	ANUBIS_IMAGE=$(pin_image "ghcr.io/techarohq/anubis:$ANUBIS_VERSION")
fi
if [[ "$USE_CADDY" == "y" ]]; then
	CADDY_IMAGE=$(pin_image "$CADDY_IMAGE_CHANNEL")
fi

say "writing $COMPOSE_FILE"
mkdir -p "$DATA_DIR"

ENV_ADMIN=""
ADMIN_SECRET_MOUNT=""
ADMIN_SECRET_TOPLEVEL=""
ADMIN_BOOTSTRAP_ENABLED="false"
if [[ -n "$ADMIN_EMAIL" && -n "$ADMIN_PASSWORD" ]]; then
	ADMIN_BOOTSTRAP_ENABLED="true"
	(umask 077; printf '%s' "$ADMIN_PASSWORD" >"$ADMIN_SECRET_FILE")
	ADMIN_PASSWORD=""
	ADMIN_SECRET_MOUNT='    # NPMPLUS_BOOTSTRAP_ADMIN_MOUNT_BEGIN
    secrets:
      - npmplus_initial_admin_password
    # NPMPLUS_BOOTSTRAP_ADMIN_MOUNT_END'
	ENV_ADMIN="    # NPMPLUS_BOOTSTRAP_ADMIN_ENV_BEGIN"$'\n'"      - $(yaml_quote "INITIAL_ADMIN_EMAIL=$ADMIN_EMAIL")"$'\n'"      - \"INITIAL_ADMIN_PASSWORD_FILE=/run/secrets/npmplus_initial_admin_password\""$'\n'"    # NPMPLUS_BOOTSTRAP_ADMIN_ENV_END"
	ADMIN_SECRET_TOPLEVEL="# NPMPLUS_BOOTSTRAP_ADMIN_SECRET_BEGIN
secrets:
  npmplus_initial_admin_password:
    file: $ADMIN_SECRET_FILE
# NPMPLUS_BOOTSTRAP_ADMIN_SECRET_END"
fi
ENV_TZ="      - $(yaml_quote "TZ=$TZ")"
# Disable IPv6 only when the host has no global IPv6 address.
ENV_DISABLE_IPV6=""
FW_IPV6_ENABLED="false"
if command -v ip >/dev/null && ip -6 address show scope global | grep -q 'inet6 '; then
	FW_IPV6_ENABLED="true"
else
	ENV_DISABLE_IPV6="      - \"DISABLE_IPV6=true\""
fi
# needed for real visitor ips in logs/crowdsec when cloudflare proxies the traffic
ENV_CF=""
[[ "$USE_CF" == "y" ]] && ENV_CF="      - \"TRUST_CLOUDFLARE=true\""
ENV_DISABLE_HTTP=""
if [[ "$USE_CADDY" == "y" ]]; then
	ENV_DISABLE_HTTP="      - \"DISABLE_HTTP=true\""
fi
# crowdsec needs the access logs, so LOGROTATE must be on when it is enabled
ENV_LOGROTATE="      - \"LOGROTATE=true\""
[[ "$USE_CROWDSEC" == "y" ]] || ENV_LOGROTATE="#$ENV_LOGROTATE"
# http/3/quic tuning, optional (needs BPF/PERFMON/NET_ADMIN caps, see commented cap_add):
ENV_QUIC_BPF="#      - \"NGINX_QUIC_BPF=true\""

CROWDSEC_SERVICE_HOST="crowdsec"
ANUBIS_SERVICE_HOST="anubis"
BRIDGE_HTTP_PORT='      - "80:80/tcp"'
[[ "$USE_CADDY" == "y" ]] && BRIDGE_HTTP_PORT=""
IFS= read -r -d '' NPMPLUS_NETWORK_BLOCK <<EOF || true
    ports:
$BRIDGE_HTTP_PORT
      - "443:443/tcp"
      - "443:443/udp"
      - "127.0.0.1:81:81/tcp"
    extra_hosts:
      - "host.docker.internal:host-gateway"
EOF
ENV_ADMIN_BINDING='      - "NPM_LISTEN_LOCALHOST=false"'
if [[ "$USE_HOST_NETWORK" == "y" ]]; then
	CROWDSEC_SERVICE_HOST="127.0.0.1"
	ANUBIS_SERVICE_HOST="127.0.0.1"
	NPMPLUS_NETWORK_BLOCK='    network_mode: host'
	# Keep the host listener private even in host-network mode. Optional LAN
	# access is relayed through a UFW-governed systemd socket below.
	ENV_ADMIN_BINDING='      - "NPM_LISTEN_LOCALHOST=true"'
fi
ENV_ANUBIS=""
if [[ "$USE_ANUBIS" == "y" ]]; then
	ENV_ANUBIS="      - \"AUTH_REQUEST_ANUBIS_UPSTREAM=http://$ANUBIS_SERVICE_HOST:8923\"
      - \"ANUBIS_HONEYPOT_LOG_FILE=/run/npmplus-anubis/honeypot.addrs\""
fi
ENV_CROWDSEC=""
if [[ "$USE_CROWDSEC" == "y" ]]; then
	ENV_CROWDSEC="      - \"CROWDSEC_LAPI_URL=http://$CROWDSEC_SERVICE_HOST:8080\"
      - \"CROWDSEC_METRICS_URL=http://$CROWDSEC_SERVICE_HOST:6060/metrics\""
fi

PUBLIC_RESTART_POLICY="unless-stopped"
[[ "$USE_STRICT_BOOT" == "y" ]] && PUBLIC_RESTART_POLICY="on-failure"

CROWDSEC_BLOCK=""
if [[ "$USE_CROWDSEC" == "y" ]]; then
	IFS= read -r -d '' CROWDSEC_BLOCK <<EOF || true

  crowdsec:
    container_name: crowdsec
    restart: unless-stopped
    image: $CROWDSEC_IMAGE
    pull_policy: missing
    # NPMPLUS_AUX_HARDENING_BEGIN
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges=true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=64m
    healthcheck:
      test: ["CMD", "cscli", "lapi", "status"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 120s
    # NPMPLUS_AUX_HARDENING_END
    ports:
      - "127.0.0.1:6060:6060"
      - "127.0.0.1:7422:7422"
      - "127.0.0.1:8080:8080"
    environment:
$ENV_TZ
      - "USE_WAL=true"
      - "METRICS_PORT=6060"
      - "COLLECTIONS=ZoeyVid/npmplus"
    volumes:
      - "$CROWDSEC_DIR/conf:/etc/crowdsec"
      - "$CROWDSEC_DIR/data:/var/lib/crowdsec/data"
      - "$DATA_DIR/nginx/logs:/opt/npmplus/nginx/logs:ro"
EOF
fi

# The firewall bouncer has no Docker image. Its native package programs host
# iptables/ipset INPUT and FORWARD rules; installation is in the block below.

ANUBIS_BLOCK=""
if [[ "$USE_ANUBIS" == "y" ]]; then
	# pin image and policy file to the same release so they cannot drift apart:
	# a policy from main can be newer than the released image and fail to parse
	IFS= read -r -d '' ANUBIS_BLOCK <<EOF || true

  anubis:
    container_name: npmplus-anubis
    restart: $PUBLIC_RESTART_POLICY
    image: $ANUBIS_IMAGE
    pull_policy: missing
    # NPMPLUS_AUX_HARDENING_BEGIN
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges=true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=32m
    healthcheck:
      test: ["CMD", "/ko-app/anubis", "-healthcheck"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    # NPMPLUS_AUX_HARDENING_END
    ports:
      - "127.0.0.1:8923:8923"
    environment:
$ENV_TZ
      - "TARGET= " # important: this needs to be and stay one single space
      - "POLICY_FNAME=/etc/botPolicies.yaml"
    volumes:
      - "/opt/anubis.yaml:/etc/botPolicies.yaml:ro"
      - "/opt/anubis-data:/data"
EOF

	# Mount only the honeypot-log directory outside npmplus' /data bind. A nested
	# file bind under /data lets Docker create conflicting directory placeholders.
	HONEYPOT_LOG_MOUNT='      - "/opt/anubis-data/anubis:/run/npmplus-anubis:ro"'
else
	HONEYPOT_LOG_MOUNT=""
fi

CADDY_BLOCK=""
if [[ "$USE_CADDY" == "y" ]]; then
	IFS= read -r -d '' CADDY_BLOCK <<EOF || true

  npmplus-caddy:
    container_name: npmplus-caddy
    restart: $PUBLIC_RESTART_POLICY
    image: $CADDY_IMAGE
    pull_policy: missing
    # NPMPLUS_AUX_HARDENING_BEGIN
    read_only: true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    security_opt:
      - no-new-privileges=true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=16m
    healthcheck:
      test: ["CMD", "nc", "-z", "127.0.0.1", "80"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    # NPMPLUS_AUX_HARDENING_END
    ports:
      - "80:80"
    environment:
$ENV_TZ
EOF
fi

cat >"$COMPOSE_FILE" <<EOF
name: npmplus
services:
  npmplus:
    container_name: npmplus
    restart: $PUBLIC_RESTART_POLICY
    image: $NPMPLUS_IMAGE
    pull_policy: missing
$NPMPLUS_NETWORK_BLOCK
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
      - SETGID
      - SETUID
      - CHOWN
      - FOWNER
      - DAC_OVERRIDE
#      - BPF # required if you set NGINX_QUIC_BPF to true
#      - PERFMON # required if you set NGINX_QUIC_BPF to true
#      - NET_ADMIN # required if you set NGINX_QUIC_BPF to true
    security_opt:
      - no-new-privileges=true
$ADMIN_SECRET_MOUNT
    volumes:
      - "$DATA_DIR:/data"
$HONEYPOT_LOG_MOUNT
    environment:
$ENV_TZ
      - "PUID=1000"
      - "PGID=1000"
$ENV_ADMIN_BINDING
$ENV_ADMIN
$ENV_LOGROTATE
$ENV_QUIC_BPF
$ENV_DISABLE_HTTP
$ENV_DISABLE_IPV6
$ENV_CF
$ENV_ANUBIS
$ENV_CROWDSEC
$CROWDSEC_BLOCK
$ANUBIS_BLOCK
$CADDY_BLOCK
$ADMIN_SECRET_TOPLEVEL
EOF

chmod 600 "$COMPOSE_FILE"
mkdir -p "$DATA_DIR/nginx/logs"

if [[ "$USE_ANUBIS" == "y" ]]; then
	say "fetching anubis bot policy $ANUBIS_VERSION (status codes adjusted for auth_request)"
	anubis_policy "$ANUBIS_VERSION" "$CHALLENGE_ALL"
	prepare_anubis_data "$ANUBIS_IMAGE" # subdir holds the honeypot IP log
fi

if [[ "$USE_CROWDSEC" == "y" && "$USE_ANUBIS" == "y" ]]; then
	say "installing honeypot -> crowdsec auto-ban (every 5 min via cron)"
	write_root_file /usr/local/bin/anubis-honeypot-ban 755 <<'EOF'
#!/bin/bash
# bans IPs caught in anubis' honeypot - those hits are proven malicious by
# construction, so no false positives are possible
set -euo pipefail
LOG=/opt/anubis-data/anubis/honeypot.addrs
STATE=/opt/anubis-data/anubis-honeypot.pos
[ -s "$LOG" ] || exit 0
pos=$(cat "$STATE" 2>/dev/null || echo 0)
size=$(stat -c %s "$LOG")
[ "$pos" -gt "$size" ] && pos=0 # anubis resets the file at 64k
[ "$pos" -eq "$size" ] && exit 0
tail -c +$((pos + 1)) "$LOG" | while read -r ip; do
	case "$ip" in
		*[!0-9a-fA-F.:]*) ;; # not an address, skip
		*) docker exec crowdsec cscli decisions add --ip "$ip" --duration 24h --reason anubis-honeypot >/dev/null 2>&1 || true ;;
	esac
done
echo "$size" >"$STATE"
EOF
	printf '*/5 * * * * root /usr/local/bin/anubis-honeypot-ban\n' >/etc/cron.d/anubis-honeypot
	chmod 644 /etc/cron.d/anubis-honeypot
fi

if [[ "$USE_CROWDSEC" == "y" ]]; then
	say "starting crowdsec"
	# A native daemon can already own 127.0.0.1:8080. Remove it before the
	# container attempts to bind, otherwise set -e exits before cleanup runs.
	remove_native_crowdsec
	docker compose -f "$COMPOSE_FILE" up -d crowdsec
	mkdir -p "$CROWDSEC_DIR/conf/acquis.d" "$CROWDSEC_DIR/conf/bouncers"

	say "writing crowdsec acquisition config"
	{
		echo "filenames:"
		echo "  - /opt/npmplus/nginx/logs/*.log"
		echo "labels:"
		echo "  type: npmplus"
		if [[ "$USE_APPSEC" == "y" ]]; then
			echo "---"
			echo "listen_addr: 0.0.0.0:7422"
			echo "appsec_configs:"
			echo "  - crowdsecurity/appsec-default"
			echo "name: appsec"
			echo "source: appsec"
			echo "labels:"
			echo "  type: appsec"
		fi
	} >"$CROWDSEC_DIR/conf/acquis.d/npmplus.yaml"

	# register bouncer keys (retry until the LAPI is up)
	say "registering nginx bouncer (waiting for crowdsec LAPI...)"
	KEY=$(register_bouncer npmplus || true)
	if [[ -z "$KEY" ]]; then
		echo "could not register nginx bouncer automatically." >&2
		echo "run: docker exec crowdsec cscli bouncers add npmplus -o raw" >&2
		echo "then put the key into $DATA_DIR/crowdsec/crowdsec.conf and redeploy" >&2
	else
		say "writing NPMplus bouncer config"
		mkdir -p "$DATA_DIR/crowdsec"
		CONF="$DATA_DIR/crowdsec/crowdsec.conf"
		if [[ ! -s "$CONF" ]]; then
			# same defaults the image would seed on first start
			cat >"$CONF" <<EOF
ENABLED=true
API_URL=http://$CROWDSEC_SERVICE_HOST:8080
API_KEY=$KEY
USE_TLS_AUTH=false
CACHE_EXPIRATION=1
BOUNCING_ON_TYPE=all
FALLBACK_REMEDIATION=ban
REQUEST_TIMEOUT=3000
UPDATE_FREQUENCY=10
ENABLE_INTERNAL=false
# stream mode caches bans locally (pulled every UPDATE_FREQUENCY), so bans keep
# being enforced if the LAPI is down; live mode fails open on LAPI outages
MODE=stream
SCENARIOS_CONTAINING=
SCENARIOS_NOT_CONTAINING=
EXCLUDE_LOCATION=
BAN_TEMPLATE_PATH=/data/crowdsec/ban.html
REDIRECT_LOCATION=
RET_CODE=
CAPTCHA_PROVIDER=
SECRET_KEY=
SITE_KEY=
CAPTCHA_TEMPLATE_PATH=/data/crowdsec/captcha.html
CAPTCHA_EXPIRATION=3600
APPSEC_URL=
APPSEC_FAILURE_ACTION=passthrough
APPSEC_CONNECT_TIMEOUT=
APPSEC_SEND_TIMEOUT=
APPSEC_PROCESS_TIMEOUT=
ALWAYS_SEND_TO_APPSEC=false
APPSEC_DROP_UNREADABLE_BODY=false
SSL_VERIFY=true
EOF
			# The recommended prompt default enables AppSec. Keep the URL empty only
			# when the operator explicitly declines it for this installation.
			[[ "$USE_APPSEC" == "y" ]] && sed -i "s|^APPSEC_URL=.*|APPSEC_URL=http://$CROWDSEC_SERVICE_HOST:7422|" "$CONF"
			chmod 600 "$CONF"
		else
			# existing conf: just flip ENABLED and rotate the key
			sed -i "s|^ENABLED=.*|ENABLED=true|" "$CONF"
			sed -i "s|^API_KEY=.*|API_KEY=$KEY|" "$CONF"
			if [[ "$USE_APPSEC" == "y" ]] && grep -q '^APPSEC_URL=$' "$CONF"; then
				sed -i "s|^APPSEC_URL=.*|APPSEC_URL=http://$CROWDSEC_SERVICE_HOST:7422|" "$CONF"
			fi
		fi
	fi

	# dedicated read-only bouncer for the admin UI's live ban page; the backend
	# reads the key file at request time, so re-runs rotating it need no restart
	say "registering the admin UI bouncer (live ban view)"
	UIKEY=""
	[[ -s "$DATA_DIR/crowdsec/lapi-ui.key" ]] || UIKEY=$(register_bouncer npmplus-ui || true)
	if [[ -n "$UIKEY" ]]; then
		echo "$UIKEY" >"$DATA_DIR/crowdsec/lapi-ui.key"
		chmod 600 "$DATA_DIR/crowdsec/lapi-ui.key"
	else
		echo "could not register the admin UI bouncer - the UI's crowdsec page will show an error" >&2
		echo "run: docker exec crowdsec cscli bouncers add npmplus-ui -o raw" >&2
		echo "then put the key into $DATA_DIR/crowdsec/lapi-ui.key" >&2
	fi

	# machine login for the unban action and the alert context view (bouncer
	# keys are read-only in the lapi); also backfilled by --update above
	say "registering the admin UI machine (unban + alert context)"
	UIPASSWORD=""
	[[ -s "$DATA_DIR/crowdsec/lapi-ui-machine.key" ]] || UIPASSWORD=$(register_machine npmplus-ui || true)
	if [[ -n "$UIPASSWORD" ]]; then
		echo "$UIPASSWORD" >"$DATA_DIR/crowdsec/lapi-ui-machine.key"
		chmod 600 "$DATA_DIR/crowdsec/lapi-ui-machine.key"
	else
		echo "could not register the admin UI machine - unban and alert context will show an error" >&2
		echo "run: docker exec crowdsec cscli machines add npmplus-ui -a -f - --force" >&2
		echo "then put the password into $DATA_DIR/crowdsec/lapi-ui-machine.key" >&2
	fi

	if [[ "$USE_FWBOUNCER" == "y" ]]; then
		say "installing the firewall bouncer (protects host and Docker-forwarded traffic)"
		# crowdsec publishes no docker image for this bouncer, the deb is the
		# supported install; noninteractive keeps its debconf wizard silent
		if ! command -v crowdsec-firewall-bouncer >/dev/null; then
			run_verified_script "$PACKAGECLOUD_INSTALL_URL" "$PACKAGECLOUD_INSTALL_SHA256" >/dev/null
			# --no-install-recommends is load-bearing: the debian-packaged
			# bouncer Recommends a native crowdsec daemon, and a native
			# crowdsec binds 127.0.0.1:8080 before the container can - every
			# auth then hits an lapi that knows none of our keys (silent 403s)
			DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
				crowdsec-firewall-bouncer ipset iptables
			mkdir -p /var/lib/npmplus
			touch /var/lib/npmplus/installed-firewall-bouncer
			# belt and suspenders for installs predating the flag (and for
			# packagecloud hiccups): never let a native daemon survive here
			remove_native_crowdsec
		fi
		FWKEY=$(register_bouncer npmplus-firewall || true)
		if [[ -z "$FWKEY" ]]; then
			echo "could not register firewall bouncer automatically." >&2
			echo "run: docker exec crowdsec cscli bouncers add npmplus-firewall -o raw" >&2
			echo "then put the key into /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml and restart the service" >&2
		else
			rm -f /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml.local
			cat >/etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml <<EOF
# generated by setup-npmplus.sh, see https://docs.crowdsec.net/docs/bouncers/firewall/
api_url: http://127.0.0.1:8080/
api_key: $FWKEY
update_frequency: 10s
mode: iptables
pid_dir: /var/run/
# Required by Ubuntu's supported 0.0.25 systemd package. Newer bouncers ignore
# this deprecated setting, so retaining it is safe across supported hosts.
daemonize: true
log_mode: file
log_dir: /var/log/
log_level: info
log_compression: true
log_max_size: 100
log_max_backups: 3
log_max_age: 30
disable_ipv6: $([[ "$FW_IPV6_ENABLED" == "true" ]] && echo false || echo true)
iptables_chains:
  - INPUT
  - FORWARD
EOF
			chmod 600 /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml
			install_firewall_bouncer_boot_gate
			crowdsec-firewall-bouncer -c /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml -t
			systemctl enable crowdsec-firewall-bouncer >/dev/null
			systemctl restart crowdsec-firewall-bouncer
			systemctl is-active --quiet crowdsec-firewall-bouncer
			firewall_bouncer_covers_public_paths
			mkdir -p /var/lib/npmplus
			touch /var/lib/npmplus/installed-firewall-bouncer
			echo "firewall bouncer: host INPUT + Docker FORWARD bans, service crowdsec-firewall-bouncer"
		fi
		if [[ "$USE_STRICT_BOOT" == "y" ]]; then
			configure_strict_boot_protection
		fi
	fi
fi

if [[ "$USE_STRICT_BOOT" != "y" ]]; then
	remove_strict_boot_protection
fi
if [[ "$USE_CF_ORIGIN_LOCK" != "y" ]]; then
	remove_cloudflare_origin_lock
fi

if [[ "$USE_UFW" == "y" ]]; then
	say "configuring UFW"
	# `ufw show added` exposes configured rules even while UFW is inactive and
	# catches DENY/LIMIT-only rule sets too.
	if ufw show added 2>/dev/null | grep -qE '^[[:space:]]*ufw[[:space:]]' && ! confirm "UFW already has rules - reset them to the recommended set?" "n"; then
		echo "keeping existing UFW rules - only adding 80/443 if missing"
	else
		SSH_PORT=22
		if [[ -n "${SSH_CONNECTION:-}" ]]; then
			SSH_PORT=${SSH_CONNECTION##* }
		elif command -v sshd >/dev/null; then
			# sshd -T can fail when a disposable/new host has incomplete SSH
			# host configuration. Keep the safe port-22 fallback instead of
			# letting pipefail abort firewall configuration.
			SSH_PORT=$(sshd -T 2>/dev/null | awk '$1 == "port" {print $2; exit}' || true)
			SSH_PORT=${SSH_PORT:-22}
		fi
		SSH_PORT=$(ask "SSH port to keep open" "$SSH_PORT")
		[[ "$SSH_PORT" =~ ^[0-9]+$ && "$SSH_PORT" -ge 1 && "$SSH_PORT" -le 65535 ]] || {
			echo "invalid SSH port; refusing to reset UFW" >&2
			exit 1
		}
		ufw --force reset >/dev/null
		SSH_FROM=""
		if confirm "Restrict ssh to a source subnet (e.g. 192.168.1.0/24)?" "n"; then
			read -r -p "  subnet (blank = anywhere): " SSH_FROM || true
			[[ "$SSH_FROM" =~ ^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(/([0-9]|[12][0-9]|3[0-2]))?$ ]] || SSH_FROM=""
			[[ -z "$SSH_FROM" ]] && echo "  not a valid cidr - ssh stays reachable from anywhere"
		fi
		if [[ -n "$SSH_FROM" ]]; then
			ufw allow from "$SSH_FROM" to any port "$SSH_PORT" proto tcp comment 'ssh' >/dev/null  # first, so you stay logged in
		else
			ufw allow "$SSH_PORT"/tcp comment 'ssh' >/dev/null # first, so you stay logged in
		fi
	fi
	ufw allow 80/tcp comment 'http' >/dev/null
	ufw allow 443/tcp comment 'https' >/dev/null
	ufw allow 443/udp comment 'http3-quic' >/dev/null  # required for HTTP/3
	# Remove only rules carrying the comment used by older versions of this
	# installer. Delete from highest to lowest because UFW renumbers after each
	# deletion; unrelated operator-owned port 81 rules are left untouched.
	while read -r ADMIN_RULE_NUMBER; do
		[[ -n "$ADMIN_RULE_NUMBER" ]] || continue
		ufw --force delete "$ADMIN_RULE_NUMBER" >/dev/null
	done < <(
		ufw status numbered 2>/dev/null |
			awk '/81\/tcp/ && /npmplus-admin/ { line=$0; sub(/^[^[]*\[/, "", line); sub(/\].*/, "", line); gsub(/[[:space:]]/, "", line); if (line ~ /^[0-9]+$/) print line }' |
			sort -rn
	)
	if [[ "$EXPOSE_ADMIN" == "y" ]]; then
		ufw allow from "$ADMIN_LAN_CIDR" to "$ADMIN_BIND_IP" port 81 proto tcp comment 'npmplus-admin-lan' >/dev/null
		echo "admin UI LAN rule: $ADMIN_LAN_CIDR -> $ADMIN_BIND_IP:81"
	else
		echo "admin UI stays on localhost - reach it via ssh tunnel: ssh -L 8081:localhost:81 <host>"
	fi
	ufw --force enable >/dev/null
	echo "ufw active: $(ufw status | head -1)"
fi

if [[ "$USE_UNATTENDED" == "y" ]]; then
	say "enabling unattended-upgrades"
	apt-get install -y -qq unattended-upgrades
	printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' >/etc/apt/apt.conf.d/20auto-upgrades
fi

if [[ "$USE_CF_ORIGIN_LOCK" == "y" ]]; then
	say "enabling the Cloudflare origin lock"
	configure_cloudflare_origin_lock
	systemctl start npmplus-cloudflare-origin-lock.service
	systemctl is-active --quiet npmplus-cloudflare-origin-lock.service
fi

say "deploying"
if [[ "$USE_STRICT_BOOT" == "y" ]]; then
	systemctl start npmplus-public.service
	systemctl is-active --quiet npmplus-public.service
else
	docker compose -f "$COMPOSE_FILE" up -d
fi

# Docker-published ports traverse its forwarding rules before ordinary UFW
# INPUT filtering. Keep the container on 127.0.0.1 and expose LAN access through
# systemd-socket-proxyd, whose host socket is governed by the UFW rule above.
if [[ "$EXPOSE_ADMIN" == "y" ]]; then
	configure_admin_lan_proxy "$ADMIN_BIND_IP"
	echo "admin UI: https://$ADMIN_BIND_IP:81 (private LAN $ADMIN_LAN_CIDR only)"
else
	remove_admin_lan_proxy
fi

if [[ "$ADMIN_BOOTSTRAP_ENABLED" == "true" ]]; then
	finalize_admin_bootstrap
fi

install_host_tooling

say "done"
if [[ "$EXPOSE_ADMIN" == "y" ]]; then
	echo "admin UI: https://<host>:81"
else
	echo "admin UI: https://localhost:81 via ssh tunnel: ssh -L 8081:localhost:81 <host>"
fi
if [[ "$ADMIN_BOOTSTRAP_ENABLED" != "true" ]]; then
	echo "first-run setup token: docker exec npmplus cat /data/npmplus/setup-token"
fi
if [[ "$USE_HOST_NETWORK" != "y" ]]; then
	echo "container networking: bridge (use host.docker.internal for proxy targets running on this host)"
fi
if [[ "$USE_CADDY" == "y" ]]; then
	echo "caddy: port 80 now redirects everything to https"
fi
echo "http/3: enable it per host in the UI; needs 443/udp reachable (ufw: done)"
echo "safe-update: monthly cron, snapshots then updates, auto-reverts on failure (log: /var/log/npmplus-update.log)"
echo "backup: daily cron, 7 kept in /var/backups/npmplus (log: /var/log/npmplus-backup.log)"
if [[ "$USE_ANUBIS" == "y" ]]; then
	echo "anubis: enable per-host via the Auth Request selection in the host form"
fi
if [[ "$USE_APPSEC" == "y" ]]; then
	echo "appsec: WAF protection is on; use each proxy host's AppSec protection switch for compatibility exceptions"
fi
if [[ "$USE_STRICT_BOOT" == "y" ]]; then
	echo "protected startup: ports 80/443 open only after CrowdSec INPUT + FORWARD rules are active"
fi
if [[ "$USE_CF_ORIGIN_LOCK" == "y" ]]; then
	echo "cloudflare origin lock: public 80/443 accepts Cloudflare and private/local sources only"
fi
if [[ "$USE_CROWDSEC" == "y" && -z "${KEY:-}" ]]; then
	echo "crowdsec: finish manually, see messages above"
fi
