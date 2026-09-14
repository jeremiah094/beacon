# Beacon

A competitive Apex Legends esports league management app for Ireland — player-facing screens on iOS, Android and web (via React Native Web), plus a web-first admin console for running a league. Built with Expo (expo-router) and Supabase (Postgres, Auth, RLS, Realtime, Edge Functions, pg_cron).

## Layout

```
apps/beacon      Expo app (iOS / Android / Web) — player + admin screens
packages/types   Generated Supabase database types, shared by the app
supabase/        SQL migrations and Edge Functions (source of truth for the schema)
```

## Local development

```
npm install                 # from the repo root — npm workspaces
cd apps/beacon
npm run web                 # or: npm run ios / npm run android
```

`apps/beacon/.env` already contains the Supabase project URL and publishable (anon) key — both are safe to ship client-side and are covered by Row Level Security. The apexlegendsapi.com key is **not** in this repo; it's stored only as a Supabase Edge Function secret used by `apex-link-id`.

## Supabase

- Migrations: `supabase/migrations/*.sql`, applied in filename order — this is the source of truth for the schema, RLS policies, triggers and the `standings` view.
- Edge Functions: `supabase/functions/{apex-link-id,lineup-lock,match-notify}`.
- Regenerate `packages/types/database.ts` after any schema change (`mcp__Supabase__generate_typescript_types` or `supabase gen types typescript`).

## Mobile builds (EAS)

`apps/beacon/eas.json` defines three build profiles — `development` (dev client, internal distribution), `preview` (internal, Android APK), and `production` (store-ready). The project is already linked to EAS (`extra.eas.projectId` in `app.json`), so push notification registration (`lib/hooks/usePushRegistration.ts`) is live — no further setup needed there.

To build, sign in with whichever Expo account owns that project, then run the npm scripts (each runs `eas build` under the hood):

```
cd apps/beacon
npx eas-cli login
npm run build:development
npm run build:preview
npm run build:production
npm run submit:production     # after a production build, submits to the app stores
```

## Web deploy

`app.json` is configured for static export (`web.output: "static"`). The same build serves both the player routes and the `(admin)` console — there's no separate admin deployment.

**Via EAS Hosting, from a terminal** (needs the same `eas login` as the mobile builds above):

```
cd apps/beacon
npm run deploy:web            # expo export --platform web && eas deploy — prints a preview URL
npm run deploy:web:prod       # same, but --prod (stable production URL / custom domain)
```

**Via EAS Hosting, with no terminal** — `.github/workflows/deploy-web.yml` runs the same deploy on GitHub's runners (which have normal internet access, unlike this sandbox). One-time setup, entirely in a browser:

1. Create a token at [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens).
2. Add it as a repo secret: GitHub → this repo → **Settings → Secrets and variables → Actions → New repository secret** → name it `EXPO_TOKEN`, paste the token, save. (Never paste this token into a chat with an AI — the GitHub secrets UI is the only place it should go.)
3. Go to the **Actions** tab → **Deploy web (EAS Hosting)** → **Run workflow**. Check "Deploy to the production alias" for a stable URL, leave it unchecked for a preview URL.
4. Watch the run; the deploy step's log prints the URL EAS Hosting assigned.

**Via any other static host** — build once, deploy `dist/` anywhere (Cloudflare Pages, Netlify, Vercel, S3 + CloudFront, etc):

```
cd apps/beacon
npm run web:build             # writes apps/beacon/dist
```
