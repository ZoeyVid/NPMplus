# Internationalisation support

## Sorting translations in languages

Run `./sort-locale.sh`.

## Adding new translations

Modify the files in the `src` folder. Follow the conventions already there. Make sure the file stays sorted.

## Checking for missing translations in languages

Run `./check-locale.sh [code]`.

## Adding a whole new language

There's a fair bit you'll need to touch. Here's a list that may not be complete by the time you're reading this:

- IntlProvider.tsx
- src/lang-list.json
- src/[yourlang].json
- src/HelpDoc/index.ts
- src/HelpDoc/[yourlang]/*
- Utils.ts

Make sure the files are sorted.
