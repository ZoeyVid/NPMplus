# Internationalisation support

## Adding new translations

Modify the files in the `src` folder. Follow the conventions already there.

When the development stack is running, it will sort the locale lang files
for you when you save.


## Adding a whole new language

There's a fair bit you'll need to touch. Here's a list that may
not be complete by the time you're reading this:

- frontend/src/locale/src/[yourlang].json
- frontend/src/locale/src/lang-list.json
- frontend/src/locale/src/HelpDoc/[yourlang]/*
- frontend/src/locale/src/HelpDoc/index.tsx
- frontend/src/locale/IntlProvider.tsx
- frontend/src/locale/scripts/check-locales.js


## Checking for missing translations in languages

Run `node frontend/src/locale/scripts/check-locales.js`.
