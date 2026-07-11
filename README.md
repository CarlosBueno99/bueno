# Bueno

Personal dashboard for Spotify, Steam/CS2, location history, private notes, and small utilities.

The project is a React single-page app backed by Convex and a small Hono API. Convex owns authenticated data, real-time reads, scheduled jobs, and most third-party REST calls. Hono handles HTTP endpoints that need a regular Node.js runtime, including Spotify callbacks, Apple Shortcuts location ingestion, and Steam Game Coordinator access for CS2 demos.

## Architecture

| Layer | Files | Responsibility |
| --- | --- | --- |
| React app | `src/`, `components/` | Vite app, TanStack Router routes, Clerk auth UI, Convex hooks, shadcn/ui components |
| API server | `server/`, `api/[...route].ts` | Hono routes for `/api/*`, CORS, Clerk middleware, Steam GC, Spotify callback, location ingestion |
| Convex backend | `convex/` | Database schema, queries, mutations, actions, internal actions, scheduled jobs, Clerk JWT validation |
| Static assets | `public/`, `dist/static` | Vite assets and production client build |
| Deployment config | `vercel.json`, `vite.config.ts` | Vercel static output, SPA rewrites, Vite dev proxy to the Hono server |

Runtime flow:

1. The browser loads the Vite React app.
2. Clerk authenticates the user and provides tokens to Convex through `ConvexProviderWithClerk`.
3. UI routes call Convex queries, mutations, and actions directly for app data.
4. UI routes call `/api/*` for Node-only HTTP work.
5. Convex cron jobs refresh cached data and ask Hono to enrich and archive new CS2 matches.

## Tech Stack

- React 19, Vite, TypeScript, TanStack Router
- Tailwind CSS v4 and shadcn/ui-style Radix primitives
- Clerk for authentication
- Convex for real-time data, server functions, and cron jobs
- Hono for the Node API layer
- Steam Web API, Steam Game Coordinator, Spotify Web API, Leaflet/OpenStreetMap, AWS S3

## Project Structure

```text
.
|-- api/[...route].ts          # Vercel serverless Hono adapter
|-- components/                # Shared React components and UI primitives
|-- convex/                    # Convex schema, functions, actions, crons
|-- docs/                      # Operational docs, currently S3 setup
|-- public/                    # Static assets
|-- server/                    # Local/Node Hono server and route modules
|-- src/
|   |-- lib/api.ts             # API base URL helper
|   |-- providers/             # Convex + Clerk provider wiring
|   `-- routes/                # TanStack Router file routes
|-- vite.config.ts             # Vite plugins, aliases, dev proxy
`-- vercel.json                # Static build output and SPA rewrite
```

## App Routes

| Route | Purpose |
| --- | --- |
| `/` | Main dashboard with Spotify, Steam, CS2, and currently playing data |
| `/admin` | Owner/admin workflows: Spotify connection, CS2 match fetch, demo archive actions |
| `/settings` | User, website, Steam, Spotify, and CS2 settings |
| `/location` | Location history map and navigation links |
| `/match` | Parsed CS demo viewer backed by `/api/cs` |
| `/editor` | Private notes editor |
| `/lucky-numbers` | Client-only lottery number generator |
| `/brand` | Local design/brand preview page |

## API Routes

The same route registrations are used by `server/index.ts` for local/Node hosting and by `api/[...route].ts` for Vercel.

| Route | Method | Handler | Purpose |
| --- | --- | --- | --- |
| `/api/spotify-callback` | `GET` | `server/routes/spotify.ts` | Spotify OAuth callback; exchanges the code through Convex and redirects to the admin page |
| `/api/location` | `POST` | `server/routes/location.ts` | Authenticated external location ingestion, intended for Apple Shortcuts or similar automations |
| `/api/cs` | `GET` | `server/routes/cs.ts` | Reads a local parsed demo JSON file and returns normalized match stats |
| `/api/cs/download` | `GET` | `server/routes/cs.ts` | Looks up one CS2 demo URL by share code through Steam GC |
| `/api/cs/matches` | `GET` | `server/routes/cs.ts` | Batch fetches CS2 demo URLs and match metadata for share codes |
| `/api/cs/archive` | `POST` | `server/routes/cs.ts` | Downloads a demo and uploads it to S3 |

## Convex Backend

Key tables in `convex/schema.ts`:

- `users`, `permissions`: Clerk-backed user records and role checks.
- `websiteSettings`: per-user integration settings and tokens.
- `spotifyData`, `steamData`: cached dashboard data refreshed by scheduled jobs.
- `locations`: location history records.
- `cs2Matches`, `cs2Demos`: CS2 match metadata, demo archive status, and parsed demo data.
- `privateNotes`, `tasks`: authenticated personal data.

Important Convex modules:

- `convex/auth.ts`: current user lookup, user creation/update, permission management.
- `convex/spotify.ts` and `convex/spotifyActions.ts`: Spotify data refresh, OAuth token exchange, currently playing lookup.
- `convex/spotifyQueries.ts`: Spotify read helpers.
- `convex/steamApi.ts` and `convex/steamQueries.ts`: Steam profile and CS2 stats refresh/read paths.
- `convex/cs2Actions.ts`: CS2 share-code discovery, Hono orchestration, and match persistence.
- `convex/locations.ts`: location insert and history queries.
- `convex/websiteSettings.ts`: integration and CS2 settings.
- `convex/crons.ts`: scheduled Spotify, Steam, and complete CS2 processing jobs.

Current cron schedule:

| Job | Interval |
| --- | --- |
| Refresh Spotify data for all users | 10 minutes |
| Refresh Steam data for the main user | 1 hour |
| Fetch, enrich, and archive new Counter-Strike games | 30 minutes |

## Local Development

Install dependencies:

```bash
pnpm install
```

Create local environment files:

```bash
cp .env.local.example .env.local
```

Start Convex in one terminal:

```bash
pnpm exec convex dev
```

Start the Vite client and Hono server in another terminal:

```bash
pnpm dev
```

Local URLs:

- Vite client: `http://127.0.0.1:5173`
- Hono API server: `http://127.0.0.1:3000`
- Vite proxies `/api/*` to the Hono server during development.

## Scripts

| Script | Command | Description |
| --- | --- | --- |
| `pnpm dev` | `concurrently "vite" "tsx watch --env-file=.env.local server/index.ts"` | Runs the Vite app and local Hono API server |
| `pnpm build` | `convex deploy --cmd "pnpm run build:app" --cmd-url-env-var-name VITE_CONVEX_URL` | Builds the app, then deploys Convex only if the build succeeds |
| `pnpm build:app` | `vite build && pnpm run build:server` | Builds the static client and Node server without deploying Convex |
| `pnpm build:server` | `esbuild server/index.ts --bundle --platform=node --outfile=dist/server.js --packages=external` | Bundles the Hono Node server |
| `pnpm start` | `pnpm run start:server` | Starts the production Node server |
| `pnpm start:server` | `NODE_ENV=production node dist/server.js` | Serves API routes and, when present, `dist/static` |

## Environment Variables

Use `.env.local` for the Vite client and local Hono server.

```bash
# Client-side. These are bundled by Vite.
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_API_URL=
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://metrics-ingest.example.com
VITE_POSTHOG_UI_HOST=https://us.posthog.com

# Server-side for Hono.
FRONTEND_URL=http://localhost:5173
STEAM_USERNAME=your_steam_username
STEAM_PASSWORD=your_steam_password
CS2_ARCHIVE_INTERNAL_SECRET=your-internal-secret
LOCATION_API_KEY=your-location-api-key

# Also used by /api/cs/archive when archiving through Hono.
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
CS2_DEMOS_S3_PATH=s3://your-bucket-name/optional-prefix
```

Set Convex environment variables with `pnpm exec convex env set` or in the Convex dashboard:

```bash
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain.clerk.accounts.dev
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
STEAM_API_KEY=your_steam_api_key
CS2_API_BASE_URL=https://api.example.com
CS2_ARCHIVE_INTERNAL_SECRET=use-the-same-value-configured-on-the-hono-service
```

Notes:

- `VITE_*` values are public at build time.
- Non-`VITE_*` values are server-only and must not be exposed in client code.
- `FRONTEND_URL` controls CORS and OAuth redirects for the Hono server.
- `VITE_API_URL` can stay empty when the API is same-origin. Set it to the backend origin when deploying frontend and API separately.
- `CS2_API_BASE_URL` must be the publicly reachable Hono origin. The same `CS2_ARCHIVE_INTERNAL_SECRET` value must be configured in both Convex and the Hono service.
- See `docs/AWS_S3_SETUP.md` for the S3 bucket and IAM setup used by CS2 demo archiving.

## Deployment

There are two supported shapes:

### Combined Node Service

Run the built Hono server as the single web process:

```bash
pnpm build
pnpm start
```

This serves `/api/*` from Hono and serves the built Vite client from `dist/static`.

`pnpm build` requires a Convex deployment selection. In CI or Railway, set the
server-only `CONVEX_DEPLOY_KEY` secret for the target deployment. Use
`pnpm build:app` when you only want build artifacts and do not want to deploy
Convex.

### Static Frontend plus API

Vercel uses `vercel.json` to build the frontend with `vite build`, publish `dist/static`, and rewrite SPA routes to `index.html`. The Hono API can run through `api/[...route].ts` on Vercel or as a separate Node service. When the API is separate, set `VITE_API_URL` to the API origin and `FRONTEND_URL` to the frontend origin.

Convex is deployed independently with the Convex CLI or dashboard.

## Security Model

- Clerk authenticates users in the browser and Convex validates Clerk JWTs through `convex/auth.config.ts`.
- Convex functions enforce user identity and role checks before returning protected data.
- Admin-only and owner-only UI paths check `api.auth.getUserPermission`.
- Steam credentials, Spotify secrets, AWS credentials, location API keys, and refresh tokens stay server-side.
- CS2 demo URL retrieval lives in Hono because it depends on Steam's persistent Game Coordinator connection and Node libraries.
