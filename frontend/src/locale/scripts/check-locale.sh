#!/usr/bin/env sh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)/src/locale"

if ! command -v jq > /dev/null 2>&1; then
	echo "jq could not be found, please install it to check the locale files."
	exit 1
fi

if [ ! -d "$DIR/lang" ]; then
	echo "ERROR: \`src/locale/lang\` does not exist, run \`pnpm formatjs compile-folder src/locale/src src/locale/lang\` first"
	exit 1
fi

set --
for file in "$DIR"/src/*.json; do
	case "$file" in */lang-list.json) continue ;; esac
	set -- "$@" "$file"
done

CODES=$(printf '%s\n' "$@" | jq -Rn '[inputs | split("/") | last | rtrimstr(".json")]')

errors=$(jq -r --argjson codes "$CODES" '[keys_unsorted[] | split("-")[1]] as $listed | $codes[] as $code | select($listed | index($code) | not) | "ERROR: `\($code)` language does not exist in lang-list.json"' "$DIR/src/lang-list.json")

warnings=$(jq -rn --argjson codes "$CODES" '
	[inputs] as $docs
	| (reduce ($docs | map(keys_unsorted) | add)[] as $k ({o:[],s:{}}; if .s[$k] then . else {o:(.o+[$k]), s:(.s+{($k):true})} end) | .o) as $all
	| range(0; $docs | length) as $i
	| $all[] | select($docs[$i][.] == null) | "WARN: `\($codes[$i])` does not contain item: `\(.)`"
' "$@")

[ -n "$errors" ] && printf '%s\n' "$errors"
[ -n "$warnings" ] && printf '%s\n' "$warnings"

if [ -n "$errors" ]; then
	exit 1
fi

echo "Locale check passed"
