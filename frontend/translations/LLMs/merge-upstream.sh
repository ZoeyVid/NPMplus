#!/usr/bin/env sh

if ! command -v jq > /dev/null 2>&1; then
	jq || exit 1
fi

SRC="$(dirname "$0")/.."
UP="frontend/src/locale/src"
NEW="${2:-upstream/develop}"
OLD="${1:-$(git merge-base HEAD "$NEW")}" || exit 1
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

RULES=$(cat <<'EOF'
def nkey: if . == "2fa.title" then "mfa.title" elif test("^2fa\\.(backup-|regenerate)") then sub("^2fa"; "mfa") elif startswith("2fa.") then sub("^2fa"; "totp") elif startswith("login.2fa-") then sub("^login\\.2fa-"; "login.totp-") elif . == "user.two-factor" then "user.mfa" end;
def ntext($key): gsub("Nginx Proxy Manager"; "NPMplus") | gsub("(?<![A-Za-z])NPM(?![A-Za-z])"; "NPMplus") | gsub("Let's\\s+Encrypt"; "Certbot") | gsub("SSL/TLS|TLS/SSL"; "TLS") | gsub("(?<![A-Za-z])SSL(?![A-Za-z])"; if $key == "domains.force-ssl" then "HTTPS" else "TLS" end);
def conv: with_entries(.key as $k | {key: ($k | nkey), value: (.value.defaultMessage | ntext($k))});
EOF
)

git show "$NEW:$UP/en.json" > "$TMP/en.json" || exit 1

for code in en $(git ls-tree --full-tree --name-only "$NEW:$UP" | sed -n 's/\.json$//p' | grep -vx -e en -e lang-list); do
	ui="$SRC/ui/$code.json"

	if [ ! -s "$ui" ]; then
		echo "New language: $code"
		echo '{}' > "$ui"
		mkdir -p "$SRC/help/$code"
		git show "$NEW:$UP/lang-list.json" > "$TMP/list.json"
		jq --tab --sort-keys --arg code "$code" --slurpfile up "$TMP/list.json" \
			--argjson rtl "$(git show "$NEW:frontend/src/locale/IntlProvider.tsx" | grep -q "rtlLocales = .*\"$code\"" && echo true || echo false)" \
			'.[$code] = {flag: $code, name: $code} + (first($up[0] | to_entries[] | select(.key | startswith("locale-\($code)-")) | {flag: (.key | split("-")[2] | ascii_downcase), name: .value.defaultMessage}) // {}) + if $rtl then {rtl: true} else {} end' \
			"$SRC/lang-list.json" > "$TMP/out.json" && mv "$TMP/out.json" "$SRC/lang-list.json"
	fi

	git show "$OLD:$UP/$code.json" > "$TMP/old.json" 2>/dev/null || echo '{}' > "$TMP/old.json"
	git show "$NEW:$UP/$code.json" > "$TMP/new.json"
	jq --arg code "$code" --slurpfile old "$TMP/old.json" --slurpfile new "$TMP/new.json" --slurpfile upen "$TMP/en.json" --slurpfile en "$SRC/ui/en.json" "$RULES"'
		($old[0] | conv) as $base | ($new[0] | conv) as $theirs | ($upen[0] | conv) as $upen | $en[0] as $en
		| reduce ($theirs | to_entries[] | select($base[.key] != .value)) as {key: $k, value: $v} ({file: ., notes: []};
			if $code != "en" and ($en[$k] == null or $upen[$k] != $en[$k]) then .notes += ["\($k): missing in or reworded by en.json, translate manually: \($v)"]
			elif .file[$k] | IN(null, $base[$k], $v) then .file[$k] = $v
			else .notes += ["\($k): changed by NPMplus and upstream, merge manually: \($v)"] end)
		| reduce ($base | keys[] | select(in($theirs) | not)) as $k (.; if .file | has($k) then .notes += ["\($k): removed upstream"] end)
	' "$ui" > "$TMP/out.json" || exit 1
	jq --tab --sort-keys .file "$TMP/out.json" > "$ui"
	jq -r --arg file "ui/$code.json" '.notes[] | "\($file): \(.)"' "$TMP/out.json"

	for doc in $(git ls-tree --full-tree --name-only "$NEW:$UP/HelpDoc/$code" 2>/dev/null | grep '\.md$'); do
		git show "$OLD:$UP/HelpDoc/$code/$doc" 2>/dev/null | jq -Rjs "$RULES ntext(\"\")" > "$TMP/base.md"
		git show "$NEW:$UP/HelpDoc/$code/$doc" | jq -Rjs "$RULES ntext(\"\")" > "$TMP/theirs.md"
		cmp -s "$TMP/base.md" "$TMP/theirs.md" && continue
		if [ ! -e "$SRC/help/$code/$doc" ]; then
			cp "$TMP/theirs.md" "$SRC/help/$code/$doc"
		elif ! git merge-file -L NPMplus -L "$OLD" -L "$NEW" "$SRC/help/$code/$doc" "$TMP/base.md" "$TMP/theirs.md"; then
			echo "help/$code/$doc: conflicts, merge manually"
		fi
	done
done
echo "Done"
