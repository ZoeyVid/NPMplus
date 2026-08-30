# Internationalisation support

This folder contains the translations and the scripts to maintain them. The code that loads them lives in `frontend/src/locale`.

```
translations/
├── lang-list.json      language names shown in the picker
├── ui/<code>.json      UI strings, `en.json` is the reference
└── help/<code>/*.md    help modal documents
```

All files are picked up automatically at build time, so adding files here never requires a code change.

## Sorting translations in languages

Run `./sort-locale.sh`.

## Adding new translations

Add the key to `ui/en.json` first, then to the other files in `ui`. Follow the conventions already there.

## Checking for missing translations in languages

Run `./check-locale.sh [code]`.

## Adding a whole new language

- `lang-list.json`: add `<code>` with the native language name and the flag code shown in the picker
- `ui/<code>.json`: copy `ui/en.json` and translate it
- `help/<code>/*.md`: copy `help/en` and translate it, missing files fall back to `en`
