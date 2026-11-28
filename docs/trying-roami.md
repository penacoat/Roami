# Trying Roami on an iPhone (for testers outside the team)

Roami runs in **Expo Go**, a free app from the App Store. There is nothing to build, no Apple developer account, and no cost. A teammate keeps the app running on their laptop, and you open it on your phone by scanning a QR code.

## If you are a tester

You need an iPhone and an internet connection. You do **not** need to be on the same Wi-Fi as the teammate, and you do not need to download any code.

1. Install **Expo Go** from the App Store (developer: 650 Industries, Inc.). Keep it up to date: it only opens projects built for its own SDK version, and Roami uses the latest one.
2. Ask the teammate for the Roami **QR code** (a screenshot is fine, or they can show it on their screen). The link behind it changes each time they restart the app, so always ask for a fresh one.
3. Open the iPhone **Camera** app, point it at the QR code, and tap the banner that appears. Roami opens inside Expo Go. The first load can take 20 to 30 seconds.
4. If Expo Go asks you to sign in to Expo, create a free account at [expo.dev](https://expo.dev) and sign in. This is separate from your Roami account.

### Signing in to Roami

The first screen is the Roami sign-in screen.

- **Create an account:** switch to sign up and enter a **name** (up to 60 characters), your **email**, and a **password** of at least 6 characters. You land on the Home screen right away. Tap **Show** next to the password to check what you typed.
- **Sign in later:** enter the same email and password. You stay signed in after you close the app, until you tap **Sign out** on the **Profile** tab.
- **Forgot your password:** tap the reset link on the sign-in screen and enter your email. A reset link is sent to that address. Check your spam folder if it does not arrive.
- **If something goes wrong:** the screen says what happened. "Incorrect email or password" means one of the two is wrong. "Cannot reach Roami" means your phone has no connection, and a **Try again** button appears.

### What to try

The tabs along the bottom are Home, Explore, Postcards, Itineraries, Saved and Profile.

1. **Explore:** search for a place, open its details, and save it.
2. **Saved:** open the place you saved and add a private note.
3. **Itineraries:** create a trip, then add the saved place to a day.
4. **Postcards:** browse recommendations, flip a card, and tap **See place**.

## If you are the teammate hosting the app

The app has to be running on your laptop while testers use it. Everything it stores (accounts, saves, trips, notes) goes to the team's real Firebase project, so it is the same data no matter whose laptop is hosting.

One-time setup: follow [Getting started](firebase-setup.md#getting-started-mac--iphone) to clone the repo, run `npm install` in `mobile/`, and create `mobile/.env` from the values in the team's living document. For testers, the `.env` file should contain:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=...        # from the living document
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_EMULATOR_HOST=              # empty = real Firebase
EXPO_PUBLIC_API_MODE=live
EXPO_PUBLIC_FRONTEND_PREVIEW=false
```

Each time you host a test session, from the `mobile/` folder:

```bash
npx expo start --tunnel --clear
```

- The first time, Expo asks to install a tunnel helper (`@expo/ngrok`). Answer **yes**.
- `--tunnel` is what lets a tester on a different network reach your laptop. A tester on the same Wi-Fi can also use it.
- A QR code appears in the terminal. Screenshot it and send it to the tester, or share your screen. It changes every time you restart.
- Keep the terminal open, your laptop awake and plugged in, and your internet connected for as long as testers are using the app. If you stop the server, the app stops loading for them.
- The app reads `.env` only when it starts. If you change it, restart with `--clear`.

Before inviting anyone, check the following yourself:

1. Open the app on your own phone through the tunnel and confirm **Explore** shows places. If it is empty, the real Firebase project has no catalog data yet.
2. Test with a phone that is **not** signed in to your Expo account, to be sure a stranger can open it.
3. Create a throwaway account and sign out and in again.

## Troubleshooting

| Symptom                                     | Fix                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Camera does not show a banner               | Open Expo Go and use its scan option, or try a larger, brighter QR code.                                                  |
| "Project is incompatible with this version" | Update Expo Go from the App Store.                                                                                        |
| Spins forever on first open                 | The tunnel can be slow. Wait up to a minute. If it still fails, ask the host to restart with `--tunnel --clear`.          |
| QR code worked yesterday, not today         | The link changes whenever the host restarts. Ask for a new QR code.                                                       |
| "Cannot reach Roami" after sign-in          | Your phone is offline or the connection dropped. Check your connection and tap **Try again**.                             |
| Explore is empty or shows sample data       | Host: check `.env` has `EXPO_PUBLIC_API_MODE=live` and `EXPO_PUBLIC_FRONTEND_PREVIEW=false`, then restart with `--clear`. |
