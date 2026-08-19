# DeployDeck

DeployDeck is a native-feeling macOS desktop console for everyday Vercel and Cloudflare deployment work. It keeps API tokens in the main process, never in the renderer, and talks to the official Vercel and Cloudflare APIs.

It covers:

- Vercel projects, deployments, build logs, runtime logs, domains, and environment variables
- Cloudflare Pages projects, deployments, build logs, domains, and environment variables
- Cloudflare Workers scripts, versions, deployments, live tail, routes, custom domains, variables, and secrets
- Cloudflare DNS zones and common record types
- A unified deployments table, command palette, menu bar status, and native notifications
- Watched projects, live build log refresh, log export, and copyable domain verification records

## Requirements

- macOS
- Node.js 20 or later
- npm

## Installation

```bash
npm install
```

## Development

```bash
npm start
npm run typecheck
npm run lint
```

## Packaging

```bash
npm run package
npm run make
```

`make` produces a `.dmg` and a `.zip` for macOS. `package` builds the `.app` only. Ordinary `start` uses the host architecture.

On Node 26, Electron Forge's packager hangs while extracting the Electron zip (`extract-zip` never finishes). `npm run make` therefore builds production Vite bundles and assembles the macOS app with `ditto` and `hdiutil`.

## Tokens

### Vercel personal access token

1. Open [https://vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Create a token with access to the teams you want to manage
3. Paste it into DeployDeck and click Connect

### Cloudflare API token

1. Open [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create a custom token
3. Grant only the permissions you actually use

Recommended Cloudflare permissions:

- Account read
- Account / Cloudflare Pages read and write
- Account / Workers Scripts read and write
- Zone read
- Zone / DNS read and write

If a feature is denied, the provider error is shown in place. You do not need every permission to use the rest of the app.

## Credential storage

Tokens are encrypted with Electron `safeStorage` and stored only as ciphertext in `electron-store` under your user data directory. They are decrypted in the Electron main process for API calls. The renderer never receives a token.

## Known provider limits

- Cloudflare secret values cannot be read after they are created. DeployDeck shows them as permanently masked.
- Vercel runtime logs are streamed through the official logs API and may be empty or unavailable depending on the deployment, plan, or token scope. Build logs remain available through deployment events.
- Native notifications can be blocked on unsigned development builds. They fail quietly.

## Optional signing and notarization

This project does not ship signing or auto-update infrastructure. To distribute outside your own Mac:

1. Sign the packaged app with your Developer ID
2. Notarize the `.dmg` or `.zip` with Apple
3. Staple the ticket to the disk image

See Apple's current notarization notes and Electron Forge's signing docs when you need a public release.
