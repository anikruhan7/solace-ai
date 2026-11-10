# Solace AI — Mobile

Expo SDK 51, TypeScript, Expo Router, TanStack Query, Zustand, Reanimated, Expo Notifications.

## Run
1. Start the server first (see `../server/README.md`).
2. `npm install`
3. Point the app at the server. Either edit `app.json` → `expo.extra.apiUrl`, or run with an env var:
   - Real phone (Expo Go): `EXPO_PUBLIC_API_URL=http://<your-Mac-LAN-IP>:4000 npx expo start`
   - Android emulator: `http://10.0.2.2:4000` (the default)
4. Scan the QR code with Expo Go.

Find your Mac's LAN IP with `ipconfig getifaddr en0`.

## APK
```bash
npm i -g eas-cli && eas login
eas init                               # links the project and adds the projectId
# put your deployed https server URL in eas.json → build.preview.env.EXPO_PUBLIC_API_URL
eas build -p android --profile preview
```
Reminders are local scheduled notifications, so they fire with the app closed. Tapping one opens the matching screen. Test notifications in the APK; Expo Go on Android has limits.

## Screens
- Splash → Onboarding (4 steps) → Sign up / Sign in
- **Home**: greeting, mood check-in (mood, intensity, note) with a follow-up suggestion, Sol's AI suggestion for today, continue last chat, affirmation, quick calm, streak
- **Discover**: breathing, affirmations, reflection check, activities you can mark done
- **Sol**: chat list (delete), chat with starters, retry on failure, AI with mood + history context
- **Insights**: streak + milestones, this week, 30-day stats, mood distribution, reflection score
- **Profile**: edit name, 4 reminders with times, test reminder, AI privacy toggles, sign out, delete account
