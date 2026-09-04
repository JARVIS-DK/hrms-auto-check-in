# ShiftSync

Automated attendance system that performs check-in and check-out at random times within a user-configured window. Built with Next.js, MongoDB, and deployed on Vercel with an external cron service.

## Features

- Automated check-in/out at random times within configurable time windows
- Multi-user support with individual schedules
- Leave management: full-day, first-half, and second-half leave, with optional per-day times
- Admin-managed public holidays that skip attendance for everyone
- Weekend skip options (Saturday/Sunday configurable per user)
- Email notifications on failure, skip, or leave days
- Manual check-in/out from dashboard
- Activity logs with filtering and pagination
- Admin panel: users, logs, leaves, scheduled actions, holidays, invites
- Invite-only registration (single-use, email-bound links)
- AES-256-GCM encrypted HRMS password storage
- JWT-based authentication

## Architecture

```
Vercel (Next.js)                   External
+-----------------------+          +----------------+
| /dashboard     (UI)   |          | cron-job.org   |
| /api/settings  (CRUD) |  <----   | every 1 minute |
| /api/cron      (tick) |          +----------------+
| /api/checkin   (manual)|
| /api/leaves    (CRUD) |
| /api/logs      (read) |
+-----------+-----------+
            |
            v
+---------------------+         +-----------------+
| MongoDB Atlas       |         | HRMS (Frappe)   |
| - users             |         | sopl.vprocure   |
| - settings          |         +-----------------+
| - leaves            |
| - holidays          |
| - logs              |         +-----------------+
| - scheduled_actions |         | Gmail SMTP      |
| - password_resets   |         | (nodemailer)    |
| - invites           |         +-----------------+
| - global_settings   |
| - counters          |
+---------------------+
```

## How the Scheduling Works

1. An external cron service (cron-job.org) calls `GET /api/cron` every 1 minute
2. For each user with `automationEnabled: true`:
   - If current time is within the check-in window (e.g. 09:30-10:00):
     - First call of the day: generate a random target time and store it in MongoDB
     - Subsequent calls: check if current time has reached the target time
     - When target time is reached: perform check-in via HRMS API
   - Same logic applies for check-out window (e.g. 19:30-20:00)
3. The random time is persisted in MongoDB (`scheduled_actions` collection) so it survives across stateless function invocations
4. Each action is claimed with an atomic `findOneAndUpdate` before the HRMS call, so two overlapping ticks cannot check in twice

### Half-day leave

Marking a day as half-day shifts the window instead of skipping it:

Stored as `full`, `first_half`, `second_half`; shown to users as "Off all day",
"Morning off", and "Afternoon off".

| Leave type | Check-in | Check-out |
|------------|----------|-----------|
| Off all day (`full`) | skipped | skipped |
| Morning off (`first_half`) | half-day check-in window (default 14:00-14:30) | normal |
| Afternoon off (`second_half`) | normal | half-day check-out window (default 14:00-14:30) |

The Leaves page previews the resulting day live — which action moves, which
stays, and at what times — using the `effective` windows returned by
`GET /api/settings`, so the fallback chain is resolved server-side rather than
duplicated in the UI.

The shifted window resolves in order of specificity:

1. Times set on the leave itself, when adding it on the Leaves page
2. The user's own half-day windows in Settings
3. The org-wide half-day defaults set by an admin

### Public holidays

Admins add holidays under Admin -> Holidays, optionally as a date range for a
multi-day break. A holiday skips check-in and check-out for **every** user and
takes precedence over that user's own leave - the office being closed outranks
an individual's half day. Users see upcoming holidays read-only on their Leaves
page, and the scheduler emails each active user once on the day.

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes (serverless functions)
- **Database:** MongoDB (Atlas free tier)
- **Email:** Gmail SMTP via nodemailer
- **Auth:** JWT (7-day expiry, httpOnly cookie)
- **Encryption:** AES-256-GCM for HRMS passwords
- **Hosting:** Vercel (Hobby tier, free)
- **Cron:** cron-job.org (free, 1-minute intervals)

## Project Structure

```
src/
  app/
    api/
      auth/           # login, register, logout, me
      cron/           # external cron endpoint
      checkin/        # manual check-in/out
      leaves/         # CRUD leave dates
      logs/           # activity logs
      settings/       # user HRMS settings
    dashboard/        # authenticated UI pages
    login/            # login page
    register/         # registration page
  cron/
    attendance.ts     # one parameterized job for check-in and check-out
    index.ts          # exports
  lib/
    account.ts        # email normalization, password policy, user lookup
    auth.ts           # getAuthUser() for routes (re-exports jwt.ts)
    jwt.ts            # JWT sign/verify, cookie helpers (no next/headers)
    crypto.ts         # AES-256-GCM encrypt/decrypt
    db.ts             # MongoDB connection (promise-cached)
    schedule.ts       # resolveWindow() - shared by the cron job and /api/today
    utils.ts          # IST time helpers, validation, pagination clamps
    hrms/
      client.ts       # HRMS API client (login, get state, check-in)
    mail.ts           # nodemailer templates (HTML-escaped)
    middleware/
      adminAuth.ts    # requireAdmin() + shared AuthError handler
    models/
      counter.ts      # auto-increment ID generator
      global-settings.ts   # org-wide default windows
      holiday.ts      # org-wide non-working days
      index-specs.ts  # index definitions (import-free leaf)
      indexes.ts      # ensureIndexes(), called from the cron route
      invite.ts       # single-use, email-bound registration invites
      leave.ts        # leave model (full / first_half / second_half)
      log.ts          # activity log model
      password-reset.ts    # reset tokens
      scheduled-action.ts  # persisted cron state
      settings.ts     # user settings/config model
      user.ts         # user account model
  proxy.ts            # auth proxy, verifies the JWT (Next 16; was middleware.ts)
scripts/
  db-setup.mts        # index creation + email collision check
vercel.json           # Vercel function config
```

## MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts (email, hashed password, name) |
| `settings` | Per-user HRMS config (credentials, coordinates, schedule windows) |
| `leaves` | Leave dates per user (type, optional per-day window) |
| `holidays` | Org-wide non-working days |
| `logs` | Execution history (success/fail/skipped) |
| `scheduled_actions` | Persisted random target times and execution state |
| `password_resets` | Password reset tokens (TTL-expired) |
| `invites` | Single-use, email-bound registration invites |
| `global_settings` | Org-wide default schedule windows |
| `counters` | Auto-increment ID sequences |

Indexes are created by `ensureIndexes()` on each cron cold start, and can be
applied manually with `npm run db:setup`. Index creation never throws — a
missing index costs a guarantee, but a thrown error would take down every cron
tick, which is worse.

### Database maintenance

| Command | What it does |
|---------|--------------|
| `npm run db:setup` | Create every index. Reports failures and continues; exits non-zero if any failed. |
| `npm run db:check-emails` | Accounts whose emails collide case-insensitively (blocks `users.email_ci`). |
| `npm run db:check-dupes` | Duplicate `scheduled_actions` rows (blocks `user_date_action`). |
| `npm run db:fix-dupes` | Dry-run the dedupe. Add `-- --apply` to actually delete, then it creates the index. |

A unique index can only be created once the conflicting data is gone, so the
two `check-` commands exist to show exactly what is in the way.

**Deduplication rule.** When `scheduled_actions` has more than one row for the
same user/date/action — all of which predate the unique index — the survivor is
chosen so that no record of real work is lost:

1. A row whose `result` is `success`
2. Otherwise any row marked `executed`
3. Otherwise the oldest row (ObjectIds lead with a timestamp)

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Invite | Create account (requires a valid invite token) |
| GET | `/api/auth/invite?token=` | No | Resolve an invite to its bound email |
| POST | `/api/auth/login` | No | Login, set cookie |
| POST | `/api/auth/logout` | No | Clear cookie |
| GET | `/api/auth/me` | No | Get current user |
| GET | `/api/settings` | Yes | Get user settings |
| PUT | `/api/settings` | Yes | Update settings (validates HRMS creds) |
| POST | `/api/checkin` | Yes | Manual check-in/out (`{logType: "IN"\|"OUT"}`) |
| GET | `/api/leaves` | Yes | List leave dates |
| POST | `/api/leaves` | Yes | Add leave dates (`{dates: [...], type?, reason?}`) |
| DELETE | `/api/leaves?date=YYYY-MM-DD` | Yes | Remove leave date |
| GET | `/api/logs?page=&action=&status=&date=` | Yes | Activity logs |
| GET | `/api/today` | Yes | What the scheduler plans for the signed-in user today |
| GET | `/api/holidays` | Yes | Upcoming public holidays (read-only) |
| GET | `/api/global-defaults` | Yes | Read org-wide default windows |
| GET/PUT | `/api/admin/global-settings` | Admin | Manage default windows |
| GET | `/api/admin/users` | Admin | All users with settings and last activity |
| GET | `/api/admin/logs` | Admin | All activity logs |
| GET | `/api/admin/leaves` | Admin | All leave records |
| GET | `/api/admin/scheduled-actions` | Admin | All scheduled actions |
| GET/POST/DELETE | `/api/admin/holidays` | Admin | List, add, remove public holidays |
| GET/POST/DELETE | `/api/admin/invites` | Admin | List, create, revoke invites |
| GET | `/api/cron` | Token | Cron tick (Bearer token auth) |

---

## Setup & Deployment

### Prerequisites

- Node.js 20+
- MongoDB Atlas account (free tier)
- A Gmail account with an app password (for SMTP)
- Vercel account (free Hobby tier)
- cron-job.org account (free)

### 1. Clone and Install

```bash
git clone <repo-url>
cd hrms-auto-check-in
npm install
```

### 2. Environment Variables

Create a `.env` file:

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<dbname>
JWT_SECRET=<random-64-char-hex>
ENCRYPTION_KEY=<random-64-char-hex-for-aes256>
CRON_SECRET=<random-64-char-hex>
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=ShiftSync <your-gmail@gmail.com>
```

Generate secrets:

```bash
# JWT_SECRET
openssl rand -hex 32

# ENCRYPTION_KEY (must be exactly 32 bytes = 64 hex chars)
openssl rand -hex 32

# CRON_SECRET
openssl rand -hex 32
```

### 3. Local Development

```bash
npm run dev
```

Open http://localhost:3000

### 4. Deploy to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) -> "Add New Project"
3. Import your GitHub repository
4. Framework: Next.js (auto-detected)
5. Add all environment variables from `.env` (except `PORT` and `NODE_ENV`)
6. Click **Deploy**

**Change production branch** (if needed):
- Settings -> Git -> Production Branch -> set to your branch name

### 5. Set Up External Cron

1. Go to [cron-job.org](https://cron-job.org) and create a free account
2. Create a new cron job:
   - **URL:** `https://your-app.vercel.app/api/cron`
   - **Schedule:** Every 1 minute (`* * * * *`)
   - **Request method:** GET
   - **Headers:**
     - Key: `Authorization`
     - Value: `Bearer <your-CRON_SECRET-value>`
3. Save and enable

### 6. Configure Your Account

Registration is invite-only. The first admin account has to be created directly
in MongoDB (insert a `users` document with `role: "admin"`, or promote an
existing user), after which admins issue invites from Dashboard -> Admin ->
Invites.

1. Open your invite link and create your account
2. Go to Dashboard -> Settings
3. Enter your HRMS email and password (validated on save, stored encrypted)
4. Set your office coordinates (latitude/longitude)
5. Configure time windows:
   - Check-in window (default: 09:30 - 10:00)
   - Check-out window (default: 19:30 - 20:00)
   - Half-day check-in/check-out windows (default: 14:00 - 14:30)
6. Configure weekend skips
7. Enable automation

---

## User Settings Reference

| Field | Default | Description |
|-------|---------|-------------|
| `hrmsEmail` | - | Your HRMS login email |
| `hrmsPassword` | - | HRMS password (encrypted at rest) |
| `latitude` | - | Office latitude for geo check-in |
| `longitude` | - | Office longitude for geo check-in |
| `checkinStart` | 09:30 | Start of check-in window |
| `checkinEnd` | 10:00 | End of check-in window |
| `checkoutStart` | 19:30 | Start of check-out window |
| `checkoutEnd` | 20:00 | End of check-out window |
| `halfDayCheckinStart` | 14:00 | Arrival window start on first-half leave days |
| `halfDayCheckinEnd` | 14:30 | Arrival window end on first-half leave days |
| `halfDayCheckoutStart` | 14:00 | Departure window start on second-half leave days |
| `halfDayCheckoutEnd` | 14:30 | Departure window end on second-half leave days |

A half-day leave can also carry its own `windowStart`/`windowEnd`, which
override both of the above for that single date.
| `skipSaturday` | true | Skip automation on Saturdays |
| `skipSunday` | true | Skip automation on Sundays |
| `automationEnabled` | false | Master toggle |

## Email Notifications

- **Failure email:** Sent when check-in/out fails (bad credentials, HRMS down, etc.)
- **Skip email:** Sent when nothing needed doing - you already checked in manually, or there was no check-in to check out from. Informational, not a failure.
- **Leave notification:** Sent once per leave day, describing whether automation is paused (full day) or shifted (half day)
- **Holiday notification:** Sent once to each active user on a public holiday
- **Invite email:** Sent to an invitee when an admin creates their invite

## Troubleshooting

### Cron returns 401
- Verify `CRON_SECRET` env var is set in Vercel (Settings -> Environment Variables)
- Ensure the value matches exactly what's in the cron-job.org Authorization header
- Redeploy after adding/changing env vars

### Check-in fails
- Verify HRMS credentials by re-saving settings (it validates on save)
- Check that latitude/longitude are correct
- Review logs in Dashboard -> Logs

### Missed check-in window
- If the cron tick doesn't fire within the window, the action is marked as missed
- Ensure cron-job.org is running and not paused
- Use a wider time window for more reliability

### MongoDB connection issues
- Ensure your MongoDB Atlas cluster allows connections from `0.0.0.0/0` (Network Access)
- Verify the connection string includes the database name
