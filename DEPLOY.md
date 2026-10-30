# Deploying Questly (single service)

One Render service hosts **both** the website and the API, plus a free MongoDB Atlas database. That's it: two accounts, one URL, installable on Android and iPhone.

```
Phone browser  -->  https://questly.onrender.com/QuestlyTaskApp/   (website + /api, one address)
                         |
                         +--> MongoDB Atlas (database)
```

## 1. Database: MongoDB Atlas (5 minutes)

1. Create a free **M0** cluster at <https://www.mongodb.com/atlas>.
2. **Database Access** > add a user (username + strong password).
3. **Network Access** > add `0.0.0.0/0` (Render's IPs change on the free plan).
4. **Connect > Drivers** > copy the connection string and put the database name in it:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/questly?retryWrites=true&w=majority`

## 2. Hosting: Render (10 minutes)

1. Push this repo to GitHub.
2. Render > **New > Blueprint** > pick the repo. It reads `render.yaml`.
3. When prompted, fill in:
   - `MONGODB_URI`: the Atlas string from step 1.
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`: from your Twilio console (see below).
   - `JWT_SECRET` is generated for you. Do not reuse any old secret.
4. Deploy. The first build takes a few minutes. When it finishes, open the URL Render gives you plus `/QuestlyTaskApp/` (for example `https://questly.onrender.com/QuestlyTaskApp/`). Check `/api/health` returns `{"status":"ok"}`.

That URL is your whole app. There is no second site to deploy and no CORS setting to touch.

### SMS (required: phone verification at sign-up)

The server **refuses to start in production** with the dev-only code printer, so Twilio (or MSG91) keys are needed.

- **Twilio:** set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. Trial accounts can only text numbers you've verified in the Twilio console. Test locally first: `cd backend && npm run sms:test -- +91XXXXXXXXXX`.
- **MSG91 (India):** set `SMS_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`. Indian SMS needs a DLT-registered sender ID and an approved OTP template.

The Twilio/MSG91 senders follow each provider's documented API but have **not been tested against a live account**. Send yourself a code before sharing the link.

### Aadhaar verification

It is a **demo**: `KYC_PROVIDER=sandbox` with `ALLOW_DEMO_KYC=true` simulates a successful check and verifies nothing. Other users see a "Demo ID check" badge, never "ID verified". A real provider plugs into `backend/src/utils/kyc.ts`.

## 3. Install on phones

Share the Render URL ending in `/QuestlyTaskApp/`. Each person installs it once:

- **Android (Chrome):** an "Install app" button appears in Settings (and a banner on Home). Or Chrome menu > **Install app**.
- **iPhone (Safari):** tap **Share** > **Add to Home Screen** > **Add**. Apple shows no install pop-up, so the steps are shown in Settings. It must be Safari.

It then opens full-screen from the home screen with its own icon. No app store, no Android Studio.

## Things to know

- **Free instances sleep after ~15 minutes idle.** The first request afterwards takes 30-60 seconds. The task-timer job also runs inside this service, so timers pause while it sleeps. For a real demo use the paid plan (about $7/month; check current pricing), or ping `/api/health` every few minutes from a free uptime monitor.
- **Build memory:** the free plan has 512 MB. If the build runs out of memory, set `NODE_OPTIONS=--max-old-space-size=460` in the service environment.
- **The database starts empty.** Production does not seed demo data. Register real accounts (each needs a real phone number for the SMS code).
- **Images are stored inside MongoDB** (Atlas free tier is 512 MB). Fine for a demo; move to Cloudinary or S3 before real traffic.
- **Notifications are in-app only** (the bell). Push notifications to a closed app are not built.
- **No real payments.** Escrow is only a status in the database. Do not present this as handling real money.
- **Add a privacy policy** before collecting real users' phone numbers.

## After a change

Push to GitHub and Render rebuilds automatically. Installed apps pick up the new version the next time they open with a connection.

## Optional: a real Android APK (not needed)

The `android/` folder (Capacitor) is still in the repo if you ever want a Play Store build. It needs Android Studio (several GB) and an API address baked in at build time: set `VITE_API_URL=https://<your-app>.onrender.com/api`, run `npm run android:sync`, then build in Android Studio. For almost every use, the installable web app above is enough.

## Quick reference

| Where | Variable | Value |
| --- | --- | --- |
| Render | `MONGODB_URI` | Atlas connection string |
| Render | `JWT_SECRET` | generated automatically |
| Render | `SMS_PROVIDER` | `twilio` (set in `render.yaml`) |
| Render | `TWILIO_*` | from your Twilio console |
| Render | `KYC_PROVIDER` / `ALLOW_DEMO_KYC` | `sandbox` / `true` (demo Aadhaar) |
| Build | `VITE_API_URL` | leave **unset** (the site uses `/api`) |
