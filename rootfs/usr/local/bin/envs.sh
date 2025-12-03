#!/usr/bin/env sh

echo "
-------------------------------------
 _ _  ___  __ __       _
| \ || . \|  \  \ ___ | | _ _  ___
|   ||  _/|     || . \| || | |[_-[
|_\_||_|  |_|_|_||  _/|_| \__|/__/
                 |_|
-------------------------------------
Version:  $(jq -r .version /app/package.json)
Date:     $(date)
-------------------------------------
"


if [ "$(whoami)" != "root" ] || [ "$(id -u)" != "0" ] || [ "$(id -g)" != "0" ]; then
	echo "-----------------------------------------------------------------------------------------------"
	echo "This docker container must be run as root, do not specify a user. Please use PUID/PGID instead."
	echo "-----------------------------------------------------------------------------------------------"
    sleep inf
fi

if [ ! -d /data ]; then
	echo "----------------------------------------------"
	echo "/data is not mounted! Check your compose.yaml."
	echo "----------------------------------------------"
    sleep inf
fi


touch /data/.env
# shellcheck source=/dev/null
. /data/.env
if [ -s /tmp/env.sha512sum ] && [ "$(cat /tmp/env.sha512sum)" != "$(sha512sum < /data/.env)" ]; then
    echo "You need to recreate the NPMplus container after changing the .env file, restarting the container after changing the .env file is not supported"
    sleep inf
fi
sha512sum < /data/.env > /tmp/env.sha512sum

# Run Node.js validation script
# Capture output to evaluate exports
# We redirect stderr to &2 so errors show up
VALIDATION_OUTPUT=$(node /app/validate-env.cjs)
VALIDATION_EXIT_CODE=$?

if [ $VALIDATION_EXIT_CODE -ne 0 ]; then
    # If the script failed, it should have printed the error to stderr
    echo "Validation failed."
    sleep inf
fi

# Eval the exported variables
eval "$VALIDATION_OUTPUT"


# Template Version Hash Check (kept in shell for simplicity as it involves piping many unix tools)
export TV="5a"
if [ ! -s /data/npmplus/env.sha512sum ] || [ "$(cat /data/npmplus/env.sha512sum)" != "$( (grep "env\.[A-Z0-9_]\+" -roh /app/templates | sed "s|env.||g" | sort | uniq | xargs printenv; echo "$TV") | tr -d "\n" | sha512sum | cut -d" " -f1)" ]; then
    echo "At least one env or the template version changed, all hosts will be regenerated."
    export REGENERATE_ALL="true"
fi

exec migration.sh
