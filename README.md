# PIC Competition Software — Cloudflare Free edition

A separate, standalone edition of Penny International College's competition software. Host sign-in uses your own email and password. Contestants and the audience display use the six-digit session code. No ChatGPT login, Render subscription, R2 bucket or paid persistent disk is required by this package.

The existing buzzer algorithm is unchanged. All six classes, four student places per class, omission controls, rounds, questions, circular timers, server-ordered buzzes, scoring, response-time statistics, sounds, homepage photos and branding uploads are retained. Accounts, scores and uploaded logos persist in Cloudflare D1; bundled photos are static assets. This installation starts fresh and does not import data from your existing app.

## Easiest installation: your computer, no GitHub needed

You need a Cloudflare account and **Node.js 24 LTS** installed on a computer. You authorize Cloudflare in your own browser; no one needs your Cloudflare password or administrator access.

1. Extract the ZIP and open the `pic-cloudflare` folder. On Windows, right-click inside the folder and choose **Open in Terminal**. Make sure `package.json` is directly in the folder you opened.
2. Run:

   ```sh
   npm ci
   npm run setup
   ```

3. The setup command opens Cloudflare sign-in in your browser. Sign in and authorize Wrangler, Cloudflare's deployment tool. Return to the terminal.
4. At **Existing D1 database ID**, press Enter to create a new database. At **New database name**, press Enter to use `pic-competition`. If you have already created one, paste that database's ID instead; use a fresh database for this installation, not another app's database.
5. If Cloudflare asks which account to use, choose your intended account. Review and approve the database migrations when prompted.
6. Choose to create the first host. Enter your email, displayed name and a unique password of 12–256 characters. The password is masked in the terminal. It is hashed before being sent to D1 and is not saved in the project or printed in command arguments.
7. Deploy:

   ```sh
   npm run deploy
   ```

8. Open the `https://pic-competition.…workers.dev` address printed by Wrangler. If Cloudflare asks you to choose a Workers subdomain, complete that prompt first. Choose **Host sign in**, use your new account, create a session and share its code with contestants.

You do not need to upload anything to GitHub for this route. Keep the folder: `wrangler.jsonc` now contains your database ID, which you need for future updates. The database ID is configuration, not a password.

If Windows reports that `npm.ps1` cannot run, use `npm.cmd` instead of `npm` in the commands above. Do not disable your computer's security settings just to run this package.

### If database creation says the name already exists

Open Cloudflare Dashboard → **Storage & databases → D1**, open the intended database, and copy its database ID. Run `npm run setup` again and paste the ID at the first prompt. Only reuse a database belonging to this app. Re-running migrations skips files already applied by Wrangler.

### If you skipped the first host

Run `npm run host:create`, enter the host details, then sign in on the deployed site. There is no public registration page or first-visitor account claim.

## Optional GitHub deployment

After the first successful setup and deployment, you can use your GitHub repository for future automatic updates:

1. Upload the source files and folders to the repository root. Include `wrangler.jsonc` with the real database ID. Exclude `node_modules`, `.wrangler`, `dist`, `.worker-build`, local environment files and any credentials.
2. In the existing Cloudflare Worker's **Settings → Builds**, connect that GitHub repository. Give **Cloudflare**, not ChatGPT, access to build the repository.
3. Set the build command to `npm run check && npm run build`; set the deploy command to `npx wrangler deploy`. Use Node 24 in the build environment. Keep the Worker name `pic-competition` matching the Wrangler configuration.
4. Apply future schema migrations with `npm run db:migrate` before deploying code that needs them. A build does not silently alter the production database or create accounts.

Do not deploy the earlier Render ZIP over this version; they use different runtime and storage implementations.

## Host account administration

Use the terminal in your project folder, authenticated to the correct Cloudflare account:

```sh
npm run host:create
npm run host:create -- --reset
```

The first command adds a host. If the email already exists, it fails instead of overwriting the account. `--reset` updates an existing account's password and revokes its previous sign-ins while retaining its competitions. It can also create the account if it does not exist. For an existing account, its displayed name stays unchanged on reset.

There is no email password-recovery service. Administrators reset passwords through this command. Do not put passwords in GitHub, screenshots or chat. The scripts temporarily store only SQL containing the password hash in the system's temporary folder and remove it afterwards.

## Free allowance and competition duration

This is configured for Workers + D1 and does not enable a paid subscription. Free does **not** mean unlimited:

- Workers Free currently allows **100,000 dynamic requests per day**. Static asset requests are separate from API polling.
- D1 Free currently includes **5 million rows read per day** and **100,000 rows written per day**, with **5 GB total storage** and a smaller per-database free-plan limit.
- Foreground competition screens refresh about every **2 seconds**; hidden tabs refresh about every **5 seconds**. Buzz taps and host actions are sent immediately. Timers animate locally between refreshes. Public snapshots can be cached at an edge location for **1 second** to reduce D1 reads. Mutation requests always bypass this snapshot cache.
- With 24 contestants, one host and one display, foreground polling alone can approach **46,800 API requests per hour**, before retries and other activity. Extra displays, duplicate tabs and other Workers on the account consume the allowance too. D1 row usage depends on question count, buzz history, caching and network locations, so it cannot be predicted from request count alone.
- On a free plan, reaching a quota can interrupt the competition until the quota resets. Test a realistic rehearsal, check Workers and D1 usage in the dashboard, and avoid promising uninterrupted multi-hour events on a free allowance. This package does not keep the service artificially awake or bypass quota enforcement.
- Logos retain the 2 MB upload limit. They are stored in D1 in smaller chunks, without an R2 subscription. Existing homepage photos do not consume D1 storage or row reads when displayed.

Check the current official limits before a competition: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## Local rehearsal and validation

Local testing does not publish or charge a Cloudflare account:

```sh
npm ci
npm run setup -- --local
npm run dev
```

Use the local URL printed by Wrangler. Local accounts and data are separate from production. To add/reset local hosts, append `--local` to the host command, for example `npm run host:create -- --local --reset`.

To run the automated checks:

```sh
npm test
```

The pretest step checks TypeScript, builds the frontend and validates/bundles the Worker with a deployment dry run. The tests cover the original gameplay rules plus independent authentication, rate limits, same-origin protection, real D1 concurrent buzzing/scoring and full 2 MB logo upload/retrieval/removal in Cloudflare's local runtime. No test uses a production database. The original `lib/game.ts` is copied unchanged from the Render export.

The production assets and Worker bundle have been built successfully. Local D1 migrations and account creation were tested. This package has **not** been deployed to your Cloudflare account; a local runtime cannot prove free-plan CPU usage or account-specific quotas. Rehearse on the deployed free account before the event.

## Domain later

First test the generated `workers.dev` address. When ready, add your domain to the appropriate Cloudflare account, complete any required DNS setup, then open the Worker's **Settings → Domains & Routes** and add the custom domain.

With `APP_ORIGIN` blank, same-origin checks use the actual request origin, so both the generated address and a correctly attached custom domain can operate. To restrict writes to one public address, set `vars.APP_ORIGIN` in `wrangler.jsonc` to the exact `https://…` origin, with no trailing slash, and redeploy. Use the same chosen address on all competition devices. Keep preview deployments on a separate database if you add previews later.

## Persistence and backups

D1 persists independently of Worker redeploys. Keep its database ID unchanged across app updates. Do not delete the database to redeploy the app. Sessions still follow the existing 24-hour availability rule; this export does not introduce indefinite session archives.

Export a backup before important events:

```sh
npx wrangler d1 export DB --remote --output=pic-backup.sql
```

The export includes host password hashes, active session hashes, contestant access tokens and uploaded logo chunks. Keep it private and out of GitHub. Database Time Travel and retention depend on the selected Cloudflare plan. Deleting a competition follows the existing app rules; deleting a Cloudflare database is a separate administrative action.
