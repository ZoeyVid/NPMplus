#!/usr/bin/env sh
set -e

SRC="$(dirname "$0")/../src"

if ! command -v jq > /dev/null 2>&1; then
	echo "jq could not be found, please install it to sort the locale files."
	exit 1
fi

for file in "$SRC"/*.json; do
	if [ -f "$file" ]; then
		if [ ! -s "$file" ]; then
			echo "Skipping empty file ${file##*/}"
			continue
		fi

		original_content=$(cat "$file")
		sorted_content=$(jq --tab --sort-keys . "$file")
		if [ "$original_content" = "$sorted_content" ]; then
			echo "${file##*/} is already sorted"
			continue
		fi

		echo "Sorting ${file##*/}"
		echo "$sorted_content" > "$file"
	fi
done
