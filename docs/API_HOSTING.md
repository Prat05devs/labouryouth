# Hosting Labour Youth on Hostinger Cloud and Supabase
Updated: 13 October 2026 (Decision 31). Audience: the owner and whoever sets up the servers. Follow the steps in order; each ends with a check so you know it worked before moving on. This replaces the earlier Railway and Vercel plan.

## What you will end up with
| Piece | Service | Holds |
|---|---|---|
| Database | Supabase, PostgreSQL with PostGIS, region South Asia (Mumbai) | Accounts, jobs, offers, attendance, ledger |
| Private documents | Supabase Storage, one private bucket | Worker photos and ID documents |
| API | Hostinger Cloud, Node.js Web App, root `apps/server` | The Express server at `https://api.<your-domain>` |
| Website and admin | Hostinger Cloud, Node.js Web App, root `apps/web` | Public site and operations console at `https://<your-domain>` |
| Domain | GoDaddy (stays there) | DNS records pointing at Hostinger |

`<your-domain>` stands for the domain registered at GoDaddy. Nothing in this guide needs the domain moved.

Costs change; check each pricing page. Supabase's free plan pauses inactive projects and keeps limited backups, so move to a paid plan before real users rely on it.

## Before you start
- The latest code pushed to GitHub, including `apps/server`. Hostinger builds only what is on GitHub.
- Your Mac with the project checked out and Node.js 24 (`nvm use 24`), for the one-off database steps.
- A password manager. Every secret below goes there and into the hosting panels, never into Git, chat or documents.

## Stage 1: staging (gets the app working)
Staging uses `APP_ENV=staging`. It works fully except password-reset email.

### Step 1. Database on Supabase
1. At https://supabase.com create a project `labour-youth-staging`, region **South Asia (Mumbai)**, with a strong generated database password that has no `@ : / #` characters. Save it.
2. **Database > Extensions**: enable `postgis`.
3. **Connect**: copy the **Session pooler** connection string (not Transaction pooler, not Direct). Put your password in it and add `?ssl=require` at the end:
   `postgresql://postgres.<project-ref>:<password>@<pooler-host>.pooler.supabase.com:5432/postgres?ssl=require`
4. **Database > Settings > SSL Configuration**: download the CA certificate. Its contents become `DATABASE_CA_CERT` (Step 4). With it the API verifies it is talking to Supabase and not an impostor; production refuses to start without it.

Why Session pooler: Hostinger connects over IPv4 and Supabase's direct connection needs IPv6. The Transaction pooler breaks prepared statements.

**Check:** the string starts with `postgresql://`, uses port `5432` and ends with `?ssl=require`.

### Step 2. Private document bucket on Supabase
1. **Storage > New bucket**: name `private-documents`, **Public bucket: off**. Leave file-size and type limits empty; the API enforces 10 MB and JPEG, PNG or PDF itself.
2. **Project Settings > API Keys**: copy the **secret / service_role** key. It bypasses Supabase's row security, so it must only ever be set on the API server. Never put it in the app, the website or a `NEXT_PUBLIC_`/`EXPO_PUBLIC_` variable.

**Check:** the bucket shows as private.

### Step 3. Create the tables, catalog and first admin (from your Mac)
Run these once, pointed at Supabase. They read the variables you pass on the command line, so your local `.env` stays untouched.
```sh
cd apps/server
npm ci
export DATABASE_URL='<the string from Step 1>'
export DATABASE_CA_CERT="$(cat ~/Downloads/<supabase-ca-file>.crt)"
export JWT_SECRET='<the secret from Step 4>'
npm run migrate          # creates every table (also runs automatically on each start)
npm run seed             # Dehradun area, 23 services with Hindi names, 9 localities; no users, no listings
npm run bootstrap-admin  # asks for email, mobile, name and a 12+ character password; nothing is logged
```
**Check:** `migrate` prints `Applied 0001_baseline.sql`, `seed` prints `Seed complete.`, and the admin script prints `Admin created. No password was logged.`

### Step 4. Secrets to generate
On the Mac, run this twice and save the results as `JWT_SECRET` and `WEB_SESSION_SECRET`:
```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
The API refuses to start if `JWT_SECRET` is shorter than 48 characters.

### Step 5. The API on Hostinger
1. hPanel: **Websites > Add Website > Node.js Web App > Import Git repository**, and pick the GitHub repository.
2. Settings (Hostinger pre-fills some; set them to these):

   | Setting | Value |
   |---|---|
   | Framework preset | Express (or Other) |
   | Branch | the branch you deploy, usually `main` |
   | Root directory | `apps/server` |
   | Node.js version | 24 (22 also works) |
   | Build command | `build` |
   | Entry file | `dist/src/start.js` |

   The entry file applies any new database migrations, then starts the server.
3. Environment variables (hPanel, the app's environment settings). Values in angle brackets are yours:
   ```
   APP_ENV=staging
   DATABASE_URL=<Step 1 string, ending ?ssl=require>
   DATABASE_CA_CERT=<contents of the Supabase CA file; one line with \n between lines is accepted>
   JWT_SECRET=<Step 4>
   JWT_ISSUER=labour-youth
   JWT_AUDIENCE=labour-youth-app
   ALLOWED_ORIGINS=https://<your-domain>
   STORAGE_DRIVER=supabase
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<Step 2>
   SUPABASE_STORAGE_BUCKET=private-documents
   TRUST_PROXY_HOPS=1
   MAX_UPLOAD_BYTES=10485760
   GEOFENCE_RADIUS_METERS=150
   MAX_LOCATION_ACCURACY_METERS=50
   MAX_LOCATION_AGE_SECONDS=120
   CHECK_IN_EARLY_MINUTES=30
   CHECK_IN_LATE_MINUTES=120
   ```
   Do not set `PORT`; Hostinger provides it. Staging and production refuse to start unless `STORAGE_DRIVER=supabase`.
4. Deploy. Then attach the subdomain `api.<your-domain>` to this app in hPanel.

**Check:** `https://<temporary Hostinger address>/health` shows `{"status":"ok"}` and `/ready` shows `{"status":"ready"}`. If the build log ends with an error naming a variable, fix that variable and redeploy.

### Step 6. Point the GoDaddy domain at Hostinger
In hPanel, open the domain or subdomain you attached; Hostinger shows the exact DNS records it needs (an A record or CNAME for `@`, `www` and `api`). In GoDaddy, **My Products > Domain > DNS**, add or edit exactly those records. Remove any old records for the same names that point elsewhere. Do not change GoDaddy's nameservers unless you decide to move DNS management to Hostinger.

DNS can take from minutes to a few hours. Hostinger issues the free HTTPS certificate once the records resolve.

**Check:** `https://api.<your-domain>/api/v1/services` lists the 23 services over HTTPS with a valid padlock.

### Step 7. Check the client address seen by the API
Rate limits count requests per client address, which the API reads from the proxy header Hostinger adds (`TRUST_PROXY_HOPS=1`). Hostinger does not document how many proxies sit in front of a Node app, so confirm it once:
1. From your Wi-Fi, open `https://api.<your-domain>/api/v1/public/jobs` and refresh it quickly more than 60 times in one minute. It should start answering with `RATE_LIMITED`.
2. Within that same minute, open the same address on a phone using mobile data (Wi-Fi off). It must still work.

If the phone is also limited, every visitor shares one address: tell the developer, because `TRUST_PROXY_HOPS` must be changed before launch.

### Step 8. The website on Hostinger
1. Add a second Node.js Web App from the same repository: framework **Next.js**, root directory `apps/web`, Node 24, build command `build`, output `.next`.
2. Environment variables:
   ```
   API_ORIGIN=https://api.<your-domain>
   WEB_ORIGIN=https://<your-domain>,https://www.<your-domain>
   WEB_SESSION_SECRET=<Step 4>
   SUPPORT_EMAIL=<real support address, when decided>
   INSTAGRAM_URL=https://www.instagram.com/labour.youth/
   IOS_APP_URL=<App Store link, once it exists>
   ANDROID_APP_URL=<Play Store link, once it exists>
   REVIEWED_PAGES=<leave empty until the policies are reviewed>
   ```
3. Attach `<your-domain>` and `www.<your-domain>`.

`apps/web` is part of the repository's npm workspace and has no lockfile of its own. If Hostinger's build fails or installs different versions than local, the fix is a developer task (a lockfile for `apps/web`), not a hosting setting.

**Check:** the home page loads over HTTPS and `/admin` signs in with the admin from Step 3.

### Step 9. Point the app at the hosted API
```sh
cd apps/mobile
LY_RELEASE=1 EXPO_PUBLIC_API_URL=https://api.<your-domain>/api/v1 EXPO_PUBLIC_WEB_URL=https://<your-domain> npx expo run:ios --device --configuration Release
```
For TestFlight and the stores follow [RELEASE.md](RELEASE.md) with the same values.

**Check on the phone:** no connection banners, the service grid fills, and registration, sign-in and the Jobs and Workers tabs work.

## Stage 2: production (before real users)
1. **Email.** An SMTP provider and a sender on your domain: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` on the API app.
2. **Password-reset page.** The reset email links to `PASSWORD_RESET_URL?token=...`, which must be an `https://` page. It does not exist yet and must be built first.
3. **Database certificate.** `DATABASE_CA_CERT` must be set; production refuses an unverified or unencrypted database connection.
4. **Paid Supabase plan** with backups, and a written, rehearsed restore procedure ([RELEASE.md](RELEASE.md)).
5. Set `APP_ENV=production` on the API app. If anything is missing, the build log names it and the API does not start.

## Day to day
- **Deploying:** push to the connected branch; Hostinger rebuilds both apps. Database migrations apply automatically when the API starts.
- **Database changes:** only through new files in `apps/server/migrations` (applied in name order, each once). Never edit tables by hand in Supabase.
- **Secrets:** rotating `JWT_SECRET` signs everyone out; rotate it only on purpose. Rotate the Supabase service key if it is ever exposed.
- **Logs:** each Hostinger app's deployment and runtime logs in hPanel. The API logs error types and request IDs, never passwords, tokens or document contents.

## Known limits
- One API instance is expected. Uploads go to Supabase Storage, so scaling out is possible, but rate limits and idempotency rely on the database and have only been tested with one instance.
- Hostinger's Node.js apps are a managed platform: the exact proxy setup (Step 7) and build environment are not documented in detail and must be confirmed on the first deploy.

## Verified so far
Locally on 13 October 2026: the API builds, `dist/src/start.js` applies migrations and serves `/health`, `/ready` and `/api/v1/services` with its security headers, and the 46 integration tests pass on PostgreSQL/PostGIS. Supabase, Hostinger and the GoDaddy DNS change have not been set up yet; the steps follow their documentation as of this date, and panel labels may differ slightly.

Sources: [Hostinger Node.js apps overview](https://docs.hostinger.com/node.js/overview), [Hostinger: creating an app](https://docs.hostinger.com/node.js/creating-an-app), [Hostinger: deploying from GitHub](https://docs.hostinger.com/node.js/github), [Supabase connection strings](https://supabase.com/docs/reference/postgres/connection-strings), [Supabase Storage](https://supabase.com/docs/guides/storage).
