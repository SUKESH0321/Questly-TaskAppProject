# Questly

A hyperlocal task marketplace: customers post tasks, taskers apply, the customer picks one, pays into escrow, and releases payment when the work is done. Web app (React + Vite) with an Express + MongoDB API, packaged for Android with Capacitor.

## How it works

1. A **customer** posts a task (details, photo, location, budget, time).
2. **Taskers** browse and apply, optionally with a message. Applying does not lock the task.
3. The customer reviews applicants (profile, rating, message), chats with them, and **accepts one**. The task becomes *in progress*; other applicants are told it was filled.
4. The customer **pays into escrow**. The tasker is notified and starts work.
5. The tasker marks the work **done**. The customer **releases the payment**, which completes the task.

> Escrow is a status flag in the database. There is **no real payment gateway** yet, so no money moves. See *Known limitations*.

## Features

- JWT auth (bcrypt), role selection (customer / tasker / both), changeable any time in **Settings**
- Task posting wizard, browse with server-side search / category / budget / sort, pagination
- Application flow: apply, applicants list, accept, mark done, release payment, delete open task
- Chat between connected users (polling every few seconds while the app is visible)
- In-app notifications for applications, selection, escrow, completion, payments and messages, with deep links
- Tasker profile (about, skills, availability, portfolio) shown on public profiles
- **Task search timer:** posters pick a search window (15 min to 24 h). A live countdown runs; if nobody applies in time the task expires, the poster is notified, and they can repost
- **Verification:** mobile number confirmed by SMS code at sign-up (gates posting, applying, messaging and paying). Tasker identity (Aadhaar) verification through a pluggable provider; the full Aadhaar number is never handled or stored
- Settings: account, role, tasker profile, verification, change password
- Light/dark theme, responsive layout, mobile bottom navigation, safe-area aware
- Installable web app for Android and iPhone (PWA), plus an optional Capacitor Android project

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS 3, Zustand, React Router 7, React Hook Form + Zod, Radix UI, Axios, Capacitor 8 · Express 4, Mongoose 9, JWT, helmet, express-rate-limit

## Setup

Prerequisites: Node 18+, MongoDB running on `localhost:27017`.

```bash
# frontend
npm install
cp .env.example .env        # sets VITE_API_URL

# backend
cd backend
npm install
cp .env.example .env        # then set JWT_SECRET (see the file for a one-liner)
```

Run both:

```bash
cd backend && npm run dev   # API on http://localhost:3001
npm run dev                 # web on http://localhost:5173
```

Demo data is seeded automatically outside production. Accounts (password `password123`): `sukesh@example.com` (customer), `sarah@example.com` and `michael@example.com` (taskers).

### Backend environment (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Mongo connection string |
| `JWT_SECRET` | Required (16+ chars) in production; the server refuses to start without it |
| `PORT` | API port (default 3001) |
| `CORS_ORIGIN` | Comma-separated allowed origins. Defaults already allow `localhost:5173` and the Capacitor Android origins |
| `SEED_DEMO_DATA` | `true` / `false` to override the default (seed outside production only) |
| `NODE_ENV` | Set `production` when deployed |

Never commit `backend/.env`. If a secret was ever committed, rotate it.

## Phones: Android and iPhone

Questly is an installable web app (PWA), so it works on both with no app store and no Android Studio.

- **Android (Chrome):** use the "Install app" button in Settings (or Chrome menu > Install app).
- **iPhone (Safari):** Share > Add to Home Screen > Add. Apple shows no install pop-up; the steps are in Settings.

## Hosting

One service does everything: the Express server also serves the built website, so you deploy once on Render plus a free MongoDB Atlas database. Step by step in [DEPLOY.md](DEPLOY.md).

## Optional native Android app

The `android/` folder wraps the built web app with Capacitor. It is optional and needs Android Studio.

Prerequisites: Android Studio (includes the SDK) and JDK 17+.

```bash
# point the app at your API (see .env.example), then:
npm run android:sync     # builds the web app and copies it into android/
npm run android:open     # opens Android Studio; press Run
```

API URL per target (`VITE_API_URL`, set before building):

| Target | URL |
| --- | --- |
| Android emulator | `http://10.0.2.2:3001/api` |
| Real phone on the same Wi-Fi | `http://<your-pc-lan-ip>:3001/api` |
| Production | `https://your-api.example.com/api` (release builds should use HTTPS) |

Notes: `allowMixedContent` in `capacitor.config.ts` exists for local http testing only. Push notifications and a signed release build are not set up yet.

## API

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | No | Create account / sign in (rate limited) |
| GET, PATCH | `/api/auth/me` | Yes | Current user / update profile and role |
| PATCH | `/api/auth/password` | Yes | Change password |
| GET | `/api/users/:id` | Yes | Public profile (no email or phone) |
| GET | `/api/tasks` | No | List open/in-progress tasks (`search`, `category`, `minBudget`, `maxBudget`, `sortBy`, `page`, `limit`) |
| GET | `/api/tasks/posted`, `/api/tasks/worked` | Yes | My posted / assigned tasks |
| GET | `/api/tasks/poster/:posterId` | Yes | A user's public tasks |
| GET | `/api/tasks/:id` | No | Task details |
| POST, PATCH, DELETE | `/api/tasks`, `/api/tasks/:id` | Yes | Create / edit (open only) / delete (open, unpaid) |
| POST | `/api/tasks/:id/apply` | Yes | Apply as a tasker |
| GET | `/api/tasks/:id/applications` | Yes | Poster: all applicants. Others: own application |
| POST | `/api/tasks/:id/applications/:appId/accept` | Yes | Poster accepts an applicant |
| POST | `/api/tasks/:id/done` | Yes | Assigned tasker marks work done |
| POST | `/api/payments/initiate` | Yes | Poster holds payment in escrow |
| POST | `/api/payments/release/:taskId` | Yes | Poster releases payment, completing the task |
| GET | `/api/payments/mine`, `/api/payments/:taskId` | Yes | My payments / a payment I am party to |
| GET, POST | `/api/conversations` | Yes | List / open a chat with a connected user |
| GET | `/api/conversations/:id` | Yes | A conversation I am in |
| GET, POST | `/api/conversations/:id/messages` | Yes | Read / send messages |
| GET | `/api/notifications`, `/api/notifications/unread-count` | Yes | Notifications / unread count |
| PATCH | `/api/notifications/:id/read`, `/api/notifications/read-all` | Yes | Mark read |
| GET | `/api/health` | No | Health check |

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run android:sync` · `npm run android:open` · `npm run android:run`

Backend: `npm run dev` · `npm run build` · `npm start`

## Known limitations

- **No real payments.** Needs a gateway (for example Razorpay or Stripe), payouts, refunds and disputes.
- **No maps or distance.** Locations are free text; "Open in Maps" links out. Distance filtering needs coordinates and geo queries.
- **No ratings or reviews yet.** Ratings shown are the default 5.0 until a review system exists.
- **Phone OTP needs an SMS provider.** Dev mode prints codes in the server log; production requires Twilio or MSG91 credentials (untested against live accounts).
- **Aadhaar verification has no real provider connected.** The flow, consent, status, badges and gating are built, but verification stays "not available" until a licensed provider (Digio, Signzy, Setu, IDfy, Surepass, DigiLocker) is integrated in `backend/src/utils/kyc.ts`. The dev-only `sandbox` mode simulates success and is blocked in production.
- **No password reset or email verification** (needs an email service).
- **No push notifications.** In-app only; chat uses polling instead of websockets.
- Images are stored as base64 inside MongoDB. Move to object storage (S3, Cloudinary) before real traffic.
- No automated tests or CI yet.

## License

MIT, see [LICENSE](LICENSE).
