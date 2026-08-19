# DeployDeck

DeployDeck is a native-feeling macOS desktop console for everyday Vercel and Cloudflare deployment work. It keeps API tokens in the main process, never in the renderer, and talks to the official Vercel and Cloudflare APIs.

It covers:

- Vercel projects, deployments, build logs, runtime logs, domains, and environment variables
- Cloudflare Pages projects, deployments, build logs, domains, and environment variables
- Cloudflare Workers scripts, versions, deployments, live tail, routes, custom domains, variables, and secrets
- Cloudflare DNS zones and common record types
- A unified deployments table, command palette, menu bar status, and native notifications

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

## Sign-in

DeployDeck signs in through the system browser with OAuth (Authorization Code + PKCE). The callback is always `http://127.0.0.1:17342/oauth/callback`. Copy `.env.example` to `.env` and set the public client IDs. Client secrets must not be added to the app.

Pasting a personal or API token is still available as a fallback, including for accounts that already have a saved token.

### Vercel — Sign in with Vercel

1. Create a Sign in with Vercel app
2. Set client authentication to `none`
3. Add the callback URI above
4. Enable `openid`, `email`, `profile`, and `offline_access`
5. Put the client ID in `VERCEL_OAUTH_CLIENT_ID`

Vercel team-resource API permissions for these access tokens are still in private beta. If sign-in succeeds but project or team calls fail, paste a token instead.

### Vercel personal access token

1. Open [https://vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Create a token with access to the teams you want to manage
3. In DeployDeck, open **Or paste a token** and connect

### Cloudflare — OAuth client

1. Open **Manage Account → OAuth clients** in the Cloudflare dashboard
2. Create a client with response type `code`, grant types `authorization_code` and `refresh_token`, and token authentication `none`
3. Add the same callback URI
4. Select scopes that match the permissions below. Cloudflare requires the authorization URL to include an explicit scope list. DeployDeck reuses previously granted scopes or preflights its known scope ids; set `CLOUDFLARE_OAUTH_SCOPES` to the client's exact ids for deterministic first sign-in.
5. Put the client ID in `CLOUDFLARE_OAUTH_CLIENT_ID`

New clients are private: only members of the account that created the client can authorize. Making a client public requires domain verification and cannot be undone.

DeployDeck stores the granted scope list with the encrypted OAuth credential. Cloudflare surfaces that were not granted are not polled or shown as available, so one missing permission does not break the rest of the workspace. Reconnect after changing the client scopes.

### Cloudflare API token

1. Open [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create a custom token
3. Grant only the permissions you actually use

Recommended Cloudflare permissions (OAuth scopes and API tokens):

- Account Settings → Read (`account-settings.read`)
- Pages / Cloudflare Pages → Edit
- Workers / Workers Scripts → Edit (`workers-scripts.edit`)
- Workers Routes → Edit (`workers-routes.write`)
- Workers Tail → Read (`workers-tail.read`)
- Zone → Read (`zone.read`)
- DNS → Edit (`dns.write`)

If a feature is denied, the provider error is shown in place. You do not need every permission to use the rest of the app.

## Credential storage

OAuth access and refresh tokens, and pasted API tokens, are encrypted with Electron `safeStorage` and stored only as ciphertext in `electron-store` under your user data directory. They are decrypted in the Electron main process for API calls. The renderer never receives a token. Existing pasted tokens keep working until you reconnect.

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
