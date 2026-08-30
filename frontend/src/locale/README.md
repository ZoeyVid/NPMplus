# Internationalisation support

## Sorting translations in languages

Run `./scripts/sort-locales.sh`.

## Adding new translations

Modify the files in the `src` folder. Follow the conventions already there. Make sure the file stays sorted.

## Checking for missing translations in languages

Run `./scripts/check-locales.sh`.

## Adding a whole new language

There's a fair bit you'll need to touch. Here's a list that may not be complete by the time you're reading this:

- src/[yourlang].json
- src/lang-list.json
- src/HelpDoc/[yourlang]/*
- src/HelpDoc/index.tsx
- src/locale/IntlProvider.tsx

Make sure the files are sorted.
