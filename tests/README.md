# Tests

## Backend
The tests can be launched with the command

```bash
docker run --rm --entrypoint node -v "$PWD/backend:/app/backend:ro" -v "$PWD/tests:/app/tests:ro" npmplus-npmplus:latest --test /app/tests/backend-<name_of_test_file>.mjs
```

or to run all tests use the command
```bash
docker run --rm --entrypoint node -v "$PWD/backend:/app/backend:ro" -v "$PWD/tests:/app/tests:ro" npmplus-npmplus:latest --test /app/tests/backend-*.mjs
```

## Frontend
The frontend tests use the following
```bash
docker run --rm --entrypoint sh -v "$PWD/frontend:/source/frontend:ro" -v "$PWD/backend:/source/backend:ro"  -v "$PWD/tests:/source/tests:ro" node:26-alpine -c '
        mkdir -p /app
        cp -R /source/. /app/
        npm install -g pnpm@12.23.0
        cd /app/frontend
        pnpm install --frozen-lockfile
        cd /app/backend
        pnpm install --frozen-lockfile
        cd /app
        ln -s frontend/node_modules node_modules
        ./frontend/node_modules/.bin/vitest run --config tests/frontend-vitest.config.js \
        tests/frontend-<name_of_test_file>.jsx
    '
```

or to run all tests use the command

```bash
docker run --rm --entrypoint sh -v "$PWD/frontend:/source/frontend:ro" -v "$PWD/backend:/source/backend:ro"  -v "$PWD/tests:/source/tests:ro" node:26-alpine -c '
        mkdir -p /app
        cp -R /source/. /app/
        npm install -g pnpm@12.23.0
        cd /app/frontend
        pnpm install --frozen-lockfile
        cd /app/backend
        pnpm install --frozen-lockfile
        cd /app
        ln -s frontend/node_modules node_modules
        ./frontend/node_modules/.bin/vitest run --config tests/frontend-vitest.config.js
    '
```
