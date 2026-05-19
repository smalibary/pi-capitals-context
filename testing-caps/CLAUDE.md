# testing-caps — Local Dev Environment

This folder is used to test `pi-capitals-context` locally before publishing to npm.

## How to switch to local dev mode

Edit `C:\Users\salim\.pi\agent\settings.json` — find the `packages` array and change:

```json
"npm:pi-capitals-context",
```

to:

```json
"..\\..\\..\\..\\CLI\\pi-projects\\pi-capitals-context",
```

Then restart pi from this folder (`C:\CLI\pi-projects\pi-capitals-context\testing-caps`).

## How to switch back to npm (for other projects)

Reverse the above — change back to `"npm:pi-capitals-context"`.

Then run `pi update` to make sure the latest published version is installed.

## Publishing a new version

1. Switch settings to npm (above)
2. Bump version in `C:\CLI\pi-projects\pi-capitals-context\package.json`
3. Commit + push + tag: `git tag vX.Y.Z && git push origin master && git push origin vX.Y.Z`
4. GitHub Actions auto-publishes to npm

## Current npm version

`pi-capitals-context@2.0.0`
