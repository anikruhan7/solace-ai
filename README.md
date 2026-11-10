# Solace — "Sol's Garden"

An AI wellness companion. You care for yourself, Sol (a little seed spirit) grows your garden.

- `app/` — Expo (React Native, expo-router, TypeScript)
- `backend/` — Node.js + Express + SQLite (API-driven, JWT auth)

## What's inside
Splash → onboarding (name, goals, reminder choice) → sign up / sign in → Home, Talk, Calm, Garden, Me.
- **Inner weather** check-in (replaces a plain mood score) + **Inner compass** (4 dials point to the tool that helps most)
- **Talk with Sol**: AI chat. Conversations are saved; list, continue, start new, delete. Sol uses recent moods, the compass result and earlier chats as context. Self-harm language gets a fixed safety reply plus a help sheet.
- **Calm**: Breathe (box, 4-7-8, long exhale, with haptics), **Unload** (write a worry, it dissolves, nothing saved), **Ground** (5-4-3-2-1), **Gratitude jar**, **Wind-down**
- **Garden**: light from care grows the garden seed → sprout → bud → bloom → grove; streaks, weekly weather, keepsakes, **weekly letter from Sol**
- **Reminders**: check-in, affirmation, breathing, self-care, custom. Per-reminder time and days. Local scheduled notifications, so they fire with the app closed; tapping opens the matching screen. Preferences are stored on the server.

## Run locally
```bash
cd backend && npm install && cp .env.example .env   # add ANTHROPIC_API_KEY for real AI (optional)
npm start                                           # http://localhost:4000
npm test                                            # 12 API tests

cd ../app && npm install --legacy-peer-deps
EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:4000 npx expo start
```
Without `ANTHROPIC_API_KEY` Sol uses a small built-in fallback so the demo still works.

## Build the APK (needs your Expo account)
1. Deploy `backend/` to any Node host (Render, Railway, Fly). Set `JWT_SECRET`, optionally `ANTHROPIC_API_KEY`, and put `DB_PATH` on a persistent disk.
2. Put that URL in `app/eas.json` (`EXPO_PUBLIC_API_URL`, replacing `https://YOUR-BACKEND-URL`). Use https.
3. ```bash
   cd app && npx eas-cli@latest login
   npx eas-cli@latest build --platform android --profile preview   # gives a downloadable .apk
   ```
4. Notifications: the local reminders work in the APK. Expo Go on Android has limits, so test with the APK.
