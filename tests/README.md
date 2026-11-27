# Tests

## Backend
The tests can be launched with the command

```bash
docker run --rm --entrypoint node -v "$PWD/backend:/app/backend:ro" -v "$PWD/tests:/app/tests:ro" npmplus-npmplus:latest --test /app/tests/<name_of_test_file>.mjs
```

or to run all tests use the command
```bash
docker run --rm --entrypoint node -v "$PWD/backend:/app/backend:ro" -v "$PWD/tests:/app/tests:ro" npmplus-npmplus:latest --test /app/tests/backend-*.mjs
```

