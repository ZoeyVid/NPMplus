#!/usr/bin/env sh

if ! command -v jq > /dev/null 2>&1; then
	jq || exit 1
fi

SRC="$(dirname "$0")/src"

for file in "$SRC"/*.json; do
	echo "Sorting ${file##*/}"
	tmp=$(mktemp) && jq --tab --sort-keys . "$file" > "$tmp" && mv "$tmp" "$file"
done
echo "Done"
