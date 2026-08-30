#!/usr/bin/env sh

if ! command -v jq > /dev/null 2>&1; then
	jq || exit 1
fi

SRC="$(dirname "$0")"

if [ -n "$1" ]; then
	if [ "$1" = "en" ]; then
		echo "ERROR: \`en\` is the reference language and cannot be checked against itself"
		exit 1
	fi
	if [ ! -s "$SRC/ui/$1.json" ]; then
		echo "ERROR: \`$1\` does not exist in $SRC/ui"
		exit 1
	fi
	set -- "$SRC/ui/$1.json"
else
	set --
	for file in "$SRC"/ui/*.json; do
		case "$file" in */en.json) continue ;; esac
		set -- "$@" "$file"
	done
fi

for path in "$@"; do
	file="${path##*/}"
	code="${file%.json}"

	if ! jq -e --arg code "$code" 'has($code)' "$SRC/lang-list.json" >/dev/null; then
		echo "lang-list.json: missing code: $code"
	fi

	for key in $(jq -r 'keys[]' "$SRC/ui/en.json"); do
		if ! jq -e --arg key "$key" 'has($key)' "$path" >/dev/null; then
			echo "ui/$file: missing key: $key"
		fi
	done

	for key in $(jq -r 'keys[]' "$path"); do
		if ! jq -e --arg key "$key" 'has($key)' "$SRC/ui/en.json" >/dev/null; then
			echo "ui/$file: unknown key: $key"
		fi
	done

	for doc in "$SRC"/help/en/*.md; do
		if [ ! -s "$SRC/help/$code/${doc##*/}" ]; then
			echo "help/$code: missing doc: ${doc##*/}"
		fi
	done
done
