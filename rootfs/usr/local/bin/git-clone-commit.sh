#!/usr/bin/env sh

mkdir -p "$3"
cd "$3" || exit 1
git init
git fetch --depth 1 "$1" "$2"
git checkout FETCH_HEAD
