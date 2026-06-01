# HRMS Auto Check-in & Check-out

Automated HRMS attendance system that performs check-in and check-out at random times within a user-configured window. Built with Next.js, MongoDB, and deployed on Vercel with an external cron service.

## Features

- Automated check-in/out at random times within configurable time windows
- Multi-user support with individual schedules
- Leave management (skip automation on leave days)
- Weekend skip options (Saturday/Sunday configurable per user)
- Email notifications on failure or leave days
- Manual check-in/out from dashboard
- Activity logs with filtering and pagination
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
| - logs              |         +-----------------+
| - scheduled_actions |         | Resend (email)  |
| - counters          |         +-----------------+
+---------------------+
```

## How the Scheduling Works

1. An external cron service (cron-job.org) calls `GET /api/cron` every 1 minute
2. For each user with `automationEnabled: true`:
   - If current time is within the check-in window (e.g. 09:30-10:00):
     - First call of the day: generate a random target time and store it in MongoDB
     - Subsequent calls: check if current time has reached the target time
     - When target time is reached: perform check-in via HRMS API
   - Same logic applies for check-out window (e.g. 18:00-18:45)
3. The random time is persisted in MongoDB (`scheduled_actions` collection) so it survives across stateless function invocations

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes (serverless functions)
- **Database:** MongoDB (Atlas free tier)
- **Email:** Resend
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
    checkin.ts        # automated check-in logic
    checkout.ts       # automated check-out logic
    leave-notify.ts   # leave day email notification
    index.ts          # exports
  lib/
    auth.ts           # JWT sign/verify, cookie helpers
    crypto.ts         # AES-256-GCM encrypt/decrypt
    db.ts             # MongoDB connection (cached)
    utils.ts          # IST time helpers
    hrms/
      client.ts       # HRMS API client (login, get state, check-in)
    mail.ts           # Resend email templates
    models/
      counter.ts      # auto-increment ID generator
      leave.ts        # leave model
      log.ts          # activity log model
      scheduled-action.ts  # persisted cron state
      settings.ts     # user settings/config model
      user.ts         # user account model
middleware.ts         # auth middleware (protects routes)
vercel.json           # Vercel function config
```

## MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts (email, hashed password, name) |
| `settings` | Per-user HRMS config (credentials, coordinates, schedule windows) |
| `leaves` | Leave dates per user |
| `logs` | Execution history (success/fail/skipped) |
| `scheduled_actions` | Persisted random target times and execution state |
| `counters` | Auto-increment ID sequences |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login, set cookie |
| POST | `/api/auth/logout` | No | Clear cookie |
| GET | `/api/auth/me` | No | Get current user |
| GET | `/api/settings` | Yes | Get user settings |
| PUT | `/api/settings` | Yes | Update settings (validates HRMS creds) |
| POST | `/api/checkin` | Yes | Manual check-in/out (`{logType: "IN"\|"OUT"}`) |
| GET | `/api/leaves` | Yes | List leave dates |
| POST | `/api/leaves` | Yes | Add leave dates (`{dates: [...], reason?}`) |
| DELETE | `/api/leaves?date=YYYY-MM-DD` | Yes | Remove leave date |
| GET | `/api/logs?page=&action=&status=&date=` | Yes | Activity logs |
| GET | `/api/cron` | Token | Cron tick (Bearer token auth) |

---

## Setup & Deployment

### Prerequisites

- Node.js 20+
- MongoDB Atlas account (free tier)
- Resend account (free tier, 100 emails/day)
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
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=HRMS Auto <noreply@yourdomain.com>
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

1. Visit your deployed app and register an account
2. Go to Dashboard -> Settings
3. Enter your HRMS email and password (validated on save, stored encrypted)
4. Set your office coordinates (latitude/longitude)
5. Configure time windows:
   - Check-in window (default: 09:30 - 10:00)
   - Check-out window (default: 18:00 - 18:45)
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
| `checkoutStart` | 18:00 | Start of check-out window |
| `checkoutEnd` | 18:45 | End of check-out window |
| `skipSaturday` | true | Skip automation on Saturdays |
| `skipSunday` | true | Skip automation on Sundays |
| `automationEnabled` | false | Master toggle |

## Email Notifications

- **Failure email:** Sent when check-in/out fails (bad credentials, HRMS down, etc.)
- **Skip email:** Sent when check-in is skipped because you already checked in manually
- **Leave notification:** Sent at 9:00 AM on leave days confirming automation is paused

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
