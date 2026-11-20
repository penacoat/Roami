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




## Running the backend locally (Firebase emulators)

The app talks to Firebase Authentication and Firestore directly; we do not use Cloud
Functions. `backend/` holds the seed script and the Firestore rules tests. We develop against
the **Firebase emulators**, which run Authentication and Firestore on your own computer.
They never touch the real Firebase project's data, and they need no paid plan.

### One-time setup

1. **Java 21 or newer.** The Firestore emulator runs on Java.
   - Check: `java -version`
   - If it's missing or older, install it with `brew install --cask temurin`, or download
     a JDK from [adoptium.net](https://adoptium.net). Open a new terminal tab afterward.
2. **Node 20 or newer.** Check with `node -v`.
3. **Firebase CLI.**
   - Check: `firebase --version`
   - If it's missing: `npm install -g firebase-tools`
   - If that fails with an `EACCES` permissions error, skip the global install and put
     `npx firebase-tools` in front of every `firebase` command below.
4. **Access to the Firebase project.** Ask the team lead to add your Google account under
   Firebase console → Project settings → Users and permissions. Then run `firebase login`
   and sign in with that account. Check with `firebase projects:list`; you should see
   `roami-7c0bd`.
5. **Install the backend's libraries** (used by the seed script and the rules tests):

   ```bash
   npm --prefix backend install
   ```

**Do not run `firebase init` again.** It's already done, and rerunning it can overwrite
`firebase.json` and the rules file.

### Every time you work with the emulators

Run these from the repo root.

1. Start only the emulators the app uses:

   ```bash
   firebase emulators:start --only auth,firestore
   ```

2. Load the demo data (after every emulator restart):

   ```bash
   npm --prefix backend run seed
   ```

3. Check that it works. The terminal prints a table, and the **Emulator UI** is at
   http://127.0.0.1:4000.

4. Stop the emulators with `Ctrl+C`.

To run the Firestore rules tests against the emulator:

```bash
firebase emulators:exec --only firestore "npm --prefix backend run test:rules"
```

### Ports

| Service        | Port |
|----------------|------|
| Authentication | 9099 |
| Firestore      | 8080 |
| Emulator UI    | 4000 |

### Troubleshooting

- **Build errors from `tsc`** when seeding or testing: fix them first. Common ones are
  unused imports and type errors.
- **A Java error or "Java not found":** install Java 21 (step 1 above), then open a new
  terminal tab.
- **"Port already in use":** another emulator is still running. Press `Ctrl+C` in its
  terminal, or find the process with `lsof -i :8080` (use the port from the error).
- **`EACCES` when installing the CLI:** use `npx firebase-tools` instead (step 3).
- **Warnings about apphosting, hosting, pubsub, and similar emulators not running:** safe
  to ignore. We don't use those services.
- **npm vulnerability and `install-scripts` notices:** safe to ignore. Don't run
  `npm audit fix --force`.
- **Emulator data resets** every time you stop the emulators. That's expected.

### Where code goes

There is no server. Services and repositories run inside the app (`mobile/src/`), and
Firestore security rules (`firestore.rules`) enforce access on the server side. See
`docs/where-code-goes.md`. `backend/` only holds the seed script and tests.

### Don't commit

`.env` files, service account keys, `backend/lib/`, `node_modules/`, or any `*-debug.log`
files. They're already in `.gitignore`; check `git status` before every commit.




## Deploying

We don't use Cloud Functions, so there is nothing to deploy except the Firestore rules and indexes (`firebase deploy --only firestore`). Decide as a team who deploys and when, and don't deploy rule changes that haven't passed the rules tests.
