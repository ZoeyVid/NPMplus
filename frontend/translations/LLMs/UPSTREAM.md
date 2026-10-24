# Merging upstream translations

NPMplus is a fork of [Nginx Proxy Manager](https://github.com/NginxProxyManager/nginx-proxy-manager). Upstream keeps its translations in another place and format, so `git merge` cannot apply them here. `merge-upstream.sh` converts them and merges them into `frontend/translations`. All paths below are relative to `frontend/translations`, the scripts can be run from any directory in the repository.

## Differences to upstream

| | Upstream | NPMplus |
|---|---|---|
| UI strings | `frontend/src/locale/src/<code>.json` | `frontend/translations/ui/<code>.json` |
| Format | `"key": { "defaultMessage": "text" }` | `"key": "text"`, tabs, keys sorted with `sort-locale.sh` |
| Help docs | `frontend/src/locale/src/HelpDoc/<code>/*.md` and `index.ts` | `frontend/translations/help/<code>/*.md`, no `index.ts` |
| Language list | `"locale-<code>-<REGION>": { "defaultMessage": "<name>" }` | `"<code>": { "flag": "<region>", "name": "<native name>" }` |
| Right to left | `rtlLocales` in `IntlProvider.tsx` | `"rtl": true` in `lang-list.json`, these languages are hidden in the language picker for now |
| Registration | imports in `IntlProvider.tsx`, `HelpDoc/index.ts` and `HelpDoc/<code>/index.ts` | automatic |

Renamed keys:

| Upstream | NPMplus |
|---|---|
| `2fa.title` | `mfa.title` |
| `2fa.backup-*`, `2fa.regenerate*` | `mfa.backup-*`, `mfa.regenerate*` |
| `2fa.*` | `totp.*` |
| `login.2fa-*` | `login.totp-*` |
| `user.two-factor` | `user.mfa` |

Replaced text, in every language:

| Upstream | NPMplus |
|---|---|
| `Nginx Proxy Manager`, `NPM` | `NPMplus` |
| `Let's Encrypt` | `Certbot` |
| `SSL/TLS`, `TLS/SSL`, `SSL` | `TLS` |
| `SSL` in `domains.force-ssl` | `HTTPS` |

Some English texts are reworded in NPMplus, for example "Two-Factor Authentication" is "TOTP" or "MFA". These cannot be converted automatically, the script prints them instead.

## Usage

```sh
LLMs/merge-upstream.sh [old-ref] [new-ref]
```

- `new-ref`: the upstream commit to merge, default `upstream/develop`
- `old-ref`: the upstream commit merged last time, default `git merge-base HEAD <new-ref>`

The script needs a remote with upstream, for example `git remote add upstream https://github.com/NginxProxyManager/nginx-proxy-manager.git`.

It only looks at what upstream changed between `old-ref` and `new-ref`, for every language:

- UI keys are converted (key, text) and compared with the old upstream value. A key is taken over if NPMplus has no value, still has the old upstream value or already has the new one. For other languages than `en` the English text in `ui/en.json` must also match the converted upstream English text, so `en` is processed first.
- Help docs are converted and merged with `git merge-file`, the same way git merges files.

Everything else is printed:

| Message | Meaning | What to do |
|---|---|---|
| `missing in or reworded by en.json, translate manually: <text>` | The key is missing in `ui/en.json` or NPMplus uses another English text | Translate the text from `ui/en.json`, the upstream text helps as a reference |
| `changed by NPMplus and upstream, merge manually: <text>` | NPMplus changed the text and upstream too, the NPMplus text was kept | Compare both and keep the better one |
| `removed upstream` | Upstream deleted the key | Delete it if NPMplus does not use it anymore |
| `help/<code>/<doc>: conflicts, merge manually` | The file contains conflict markers | Resolve the conflict markers |
| `New language: <code>` | Upstream has a language NPMplus does not have | See [New upstream languages](#new-upstream-languages) |

## Updated upstream translations

1. `git fetch upstream`
2. `git merge upstream/develop`. If upstream changed translations, git reports conflicts for `frontend/src/locale/src`, because these files do not exist in NPMplus anymore.
3. Run `LLMs/merge-upstream.sh` before committing the merge. While the merge is not committed, the default `old-ref` is still the upstream commit merged last time. If the merge is already committed, pass it yourself, for example `LLMs/merge-upstream.sh "$(git merge-base HEAD^1 HEAD^2)"` if `HEAD` is the merge commit.
4. Handle the printed messages.
5. Remove the upstream files again: `git rm -r :/frontend/src/locale/src`
6. Check the result with `check-locale.sh`

## New upstream languages

The script handles a new upstream language like an update with an empty old version. It:

- creates `ui/<code>.json` from the upstream file, without the keys NPMplus rewords (they are printed)
- creates `help/<code>/` from the upstream help docs
- adds `<code>` to `lang-list.json`: `flag` is the region of the upstream key `locale-<code>-<REGION>` in lowercase, `name` is its `defaultMessage` and `rtl` is set if upstream lists the language in `rtlLocales`

Check by hand:

- `name` in `lang-list.json` must be the native name, upstream sometimes uses the English one (for example `German`)
- `flag` in `lang-list.json`
- translate the printed keys and the keys only NPMplus has, `check-locale.sh <code>` lists them
- translated product names are not replaced, for example `Bainisteoir Proxy Nginx` or `Nginx 代理管理器`
- grammar around replaced names, for example `du NPMplus` instead of `de NPMplus` in French

## Limits

- Only the patterns listed above are replaced.
- Help docs deleted upstream are not deleted or reported.
- Keys that NPMplus adds itself are never touched.
