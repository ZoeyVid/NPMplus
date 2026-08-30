#!/usr/bin/env sh

if ! command -v jq > /dev/null 2>&1; then
	jq || exit 1
fi

SRC="$(dirname "$0")/src"

if [ -n "$1" ]; then
	if [ "$1" = "en" ]; then
		echo "ERROR: \`en\` is the reference language and cannot be checked against itself"
		exit 1
	fi
	if [ "$1" = "lang-list" ]; then
		echo "ERROR: \`lang-list\` is not a language and cannot be checked"
		exit 1
	fi
	if [ ! -s "$SRC/$1.json" ]; then
		echo "ERROR: \`$1\` does not exist in $SRC"
		exit 1
	fi
	set -- "$SRC/$1.json"
else
	set --
	for file in "$SRC"/*.json; do
		case "$file" in */lang-list.json | */en.json) continue ;; esac
		set -- "$@" "$file"
	done
fi

for path in "$@"; do
	file="${path##*/}"
	code="${file%.json}"

	if ! jq -e --arg code "$code" 'any(keys[]; startswith("locale-\($code)-"))' "$SRC/lang-list.json" >/dev/null; then
		echo "lang-list.json: missing code: $code"
	fi

	for key in $(jq -r 'keys[]' "$SRC/en.json"); do
		if ! jq -e --arg key "$key" 'has($key)' "$path" >/dev/null; then
			echo "$file: missing key: $key"
		fi
	done

	for key in $(jq -r 'keys[]' "$path"); do
		if ! jq -e --arg key "$key" 'has($key)' "$SRC/en.json" >/dev/null; then
			echo "$file: unknown key: $key"
		fi
	done
done
