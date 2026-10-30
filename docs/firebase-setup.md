## Getting started (Mac + iPhone)

### 1. Install the tools (one time)

1. **Node.js** (LTS version) from [nodejs.org](https://nodejs.org). This also installs npm.
2. **Git** from [git-scm.com](https://git-scm.com). Check with `git --version` in Terminal.
3. **VS Code** from [code.visualstudio.com](https://code.visualstudio.com).
4. **Expo Go** on your iPhone, from the App Store (developer: 650 Industries, Inc.). Keep it updated: it only opens projects that match its SDK version, and this project uses the latest SDK (currently 58).
5. A free **Expo account** at [expo.dev](https://expo.dev). In Expo Go, tap the avatar icon (top right) and sign in.
6. Accept the invites to the **Roami organization on Expo** and the **Firebase project** (check your email).

### 2. Get the code

```bash
git clone https://github.com/YOUR-USERNAME/roami.git
cd roami/mobile
npm install
```

If GitHub asks you to sign in, use [GitHub Desktop](https://desktop.github.com) or run `gh auth login`.

### 3. Create your `.env` file

Create a file named `mobile/.env` (next to `package.json`) with the following. THE REAL VALUES ARE IN THE LIVING DOC. **Never commit this file.** It is already in `.gitignore`.

You can also copy `mobile/.env.example` to `mobile/.env` as a starting point.
Fill in the actual values before launching the app. Missing configuration shows a
setup screen; an `auth/invalid-api-key` error means the configured API key needs
to be checked against the team's Firebase web app configuration. After changing
the file, stop Expo, run `npx expo start --clear` from `mobile/`, and reload the app.

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Rules: no quotation marks, no spaces around `=`, no commas. Use VS Code to create it, since Finder hides files that start with a dot.

### 4. Run the app

Run these one at a time, not pasted together:

```bash
npx expo login
npx expo start
```

Scan the QR code with your iPhone **Camera** app and tap the banner. The app opens in Expo Go. Leave the terminal open while you work, and press `Ctrl+C` to stop the server. After changing `.env`, restart with `npx expo start --clear`.

### Troubleshooting

- Your phone and computer must be on the **same Wi-Fi**.
- On your iPhone, turn on **Settings → Expo Go → Local Network**.
- Sign in to the **same Expo account** in the terminal and in Expo Go.
- "Project is incompatible with this version of Expo Go": run `git pull` and `npm install` in `mobile/`, and update Expo Go. Expo Go for iOS only supports the latest SDK.
- `npm install` fails with `EACCES`: run the `sudo chown` command shown in the error, then `npm install` again. Your Mac password is hidden as you type.
- Connection times out (common on school Wi-Fi): run `npx expo start --tunnel`.
- Don't run `npm audit fix
