# Roami

Roami is an iOS app for social travel discovery and planning, aimed at university students exploring an unfamiliar city. Users can search for something specific, explore recommendations on a map, and save places. They can then turn those places into an itinerary. Recommendations show who suggested a place and what they liked about it, and that context stays attached as places move into a trip.

The MVP covers Pike Place Market and nearby downtown Seattle.

**Contents:** [Status](#status) · [Prerequisites](#prerequisites) · [Build](#build) · [Test](#test) · [Run](#run) · [Architecture](#architecture) · [Repository layout](#repository-layout) · [Bug tracking](#bug-tracking) · [Team workflow](#team-workflow)

## Status

_Explore branch update November 3, 2026; native map validation is pending._

| Use case | Status |
|---|---|
| Create an account, sign in, stay signed in, sign out | **Operational.** Signing up also creates the user's public profile in Firestore (`ensureProfile`, `getProfile`, `updateProfile`). |
| Discover places that match an interest (search, map) | Explore integrates the existing place and search services with pins, details, city/category/search filters, and a pull-up places panel. Component tests and local emulator integration pass; native map and panel gestures still require device validation. |
| Save a place for later | Explore saves places and recommendation sources through the existing services and shows them using the Saved filter. Emulator persistence and account isolation are verified. Unsave is available in place details; note editing is not exposed. Removing a save also removes its saved recommendation sources and note; saving again creates a new save. |
| Create an itinerary | The New trip tab connects the existing trip-creation screen to `createTrip`. Dates and daily hours are saved through the team service. Adding places, reopening trips, and building an itinerary still need user screens. |
| Adjust an existing itinerary | In progress. The data layer is live: moving and removing stops (`moveStop`, `removeStop`), with out-of-date edits refused. No trip screens yet. |
| Share a recommendation collection | Not started. |
| Rank and recommend a visited place | Not started. Writing recommendations needs new security rules first. |

**The operational use case touches every major component.** Signing up goes from the sign-up screen to Firebase Authentication, then through the API layer (`callApi('ensureProfile')`) to a service, a repository, and Cloud Firestore, where the security rules check the write.

**The developer backend check remains in `mobile/src/dev/PlacesCheck.tsx`,** but Explore replaces it as the signed-in screen. 19 of the 20 API calls have live handlers; `createRecommendation` still returns sample data and is not used by Explore.

## Prerequisites

| Tool | Needed for | Check |
|---|---|---|
| [Node.js](https://nodejs.org) 24.12 or newer within 24.x (recommended; tested with 24.22.2) | Build, test, and run; CI uses Node 24 | `node -v` |
| Git | Getting the code | `git --version` |
| Java 21 or newer | The Firebase emulators (running the app locally, rules tests) | `java -version` |
| A Mac with Xcode, **or** an iPhone with [Expo Go](https://apps.apple.com/app/expo-go/id982107779) (latest version) | Running the app | |

Expo and React Native accept Node 22.13+ within 22.x, 24.3+ within 24.x, or 26+. The locked Firebase packages additionally require Node 24.12+, and `backend/package.json` declares Node 24. Together these constraints require Node 24.x at 24.12 or newer for the full project. This branch does not include an `.nvmrc`.

The Firebase CLI doesn't need a global install: the commands below run it with `npx firebase-tools`. A Firebase account is not needed to build, test, or run the app locally.

Get the code:

```bash
git clone https://github.com/penacoat/Roami.git
cd Roami
```

## Build

Expo bundles the app when it runs, so there is no separate compile step for the app. These commands install the dependencies and check that everything compiles. Run them from the repository root:

```bash
npm --prefix mobile ci            # install the app's dependencies
npm --prefix mobile run typecheck # compile-check the app (TypeScript)
npm --prefix backend ci           # install the emulator tools, seed script, and rules tests
npm --prefix backend run build    # compile the seed script
```

## Test

**App tests** (no setup or Firebase account needed). These run the real services against an in-memory database that imitates the security rules:

```bash
npm --prefix mobile test
```

**Lint, formatting, and type checks:**

```bash
npm --prefix mobile run lint
npm --prefix mobile run format:check
npm --prefix mobile run typecheck
```

**Security rules tests** (65 tests, run against the Firestore emulator; needs Java 21). Stop any running emulators first, because these need port 8080:

```bash
npx firebase-tools emulators:exec --only firestore "npm --prefix backend run test:rules"
```

**Continuous integration.** GitHub Actions (`.github/workflows/mobile-ci.yml`) runs lint, the formatting check, the typecheck, and the app tests on every pull request to `main` and every push to `main`. The rules tests are run locally.

## Run

The app runs in Expo Go against the **Firebase emulators** on your computer. This needs no Firebase account or keys, and uses sample data that a seed script loads.

**1. Start the emulators.** After the [Build](#build) steps, in a terminal at the repository root (leave it running):

```bash
npx firebase-tools emulators:start
```

Wait for "All emulators ready." The Emulator UI is at http://127.0.0.1:4000. Warnings about apphosting, hosting, pubsub, and other emulators not running are expected.

**2. Load the sample data.** In a second terminal at the repository root (rerun after every emulator restart):

```bash
npm --prefix backend run seed
```

It prints `Seeded 2 users, 7 places, 8 recommendations.`

**3. Point the app at the emulators.** Create a file named `mobile/.env` with these four lines:

```
EXPO_PUBLIC_FIREBASE_API_KEY=demo-api-key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=roami-7c0bd
EXPO_PUBLIC_API_MODE=live
EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1
```

The API key can be any text, because the emulators don't check it. Keep the project ID as shown, because the emulators and seed data use it.

- **On the iOS Simulator** (Mac with Xcode), keep `127.0.0.1`.
- **On an iPhone,** replace `127.0.0.1` with your computer's address on the network, from `ipconfig getifaddr en0`. The phone and computer must be on the same Wi-Fi.

**4. Start the app.** In a third terminal:

```bash
cd mobile
npx expo start --clear
```

Press `i` to open the iOS Simulator, or scan the QR code with an iPhone's Camera app to open the app in Expo Go.

**5. Use it.** Tap **New to Roami? Create an account**, then sign up with any name, any email, and a password of 6 or more characters. The account is created in the Auth emulator, and appears in the Emulator UI under Authentication. After signing in, **Explore** opens:

- Pan or zoom the map, then tap a pin to see its place details and recommendations.
- Drag the places panel's handle up for the list, or down for more map space. Tapping the handle also expands or collapses it.
- Search place names, categories, and recommendation text/tags. Category chips come from the catalog. Change the city using the city button; cities without records show an empty result.
- Save a place or recommendation, close the details, then tap **Saved**. To remove it, open its details and tap **Saved ✓ · Unsave**; the count and filtered results update after success. The Save button lets you save it again. In live emulator mode, saves persist in Firestore for the signed-in account until the emulator data is cleared. Fixture-mode saves are temporary and are not account-isolated.

The bottom tabs connect **Explore** and **New trip** after sign-in. New trip supports city, dates, daily hours, and a saved confirmation; switch back to Explore without losing your search or form state. Sign out is available on either tab. Feed, profile, trip-list, and itinerary-editing screens are not available yet. Explore uses the existing `listPlaces`, `getPlace`, `searchRecommendations`, `savePlace`, `removeSavedPlace`, and `listSavedPlaces` contracts.

Trip creation and its calendar are adapted from Athena Bao’s `origin/setup-ci` implementation at `f83515c`, with its device-only storage replaced by the existing trip API. No login UI changes were imported. Expo Router supplies the two tabs and protects them when signed out.

The seeded catalog contains seven Seattle places and eight synthetic recommendations. Coordinates and details are sample values, not independently verified place information. Demo hours and recommendations are labeled; a source link appears only when supplied by a recommendation. The seed currently has no source links. Price, booking, friend, and personalized filters are not supported by this screen's data.

Before demonstrating or merging map changes, check on a real iPhone or simulator: map tiles, pinch/pan and zoom buttons, pin selection, dragging the panel, scrolling the list/details, keyboard search, category/city filters, Save/Unsave → Saved after signing out and back in, both tabs, and trip creation. Component tests mock the native map and cannot verify its gestures.

### Troubleshooting

| What you see | Fix |
|---|---|
| A spinner for about 8 seconds, then the sign-in screen, or "Network error" on sign-up | The app can't reach the emulators. Check that they're running and that `EXPO_PUBLIC_EMULATOR_HOST` matches `ipconfig getifaddr en0` (it changes when you switch Wi-Fi). Then restart with `npx expo start --clear` and fully close Expo Go. |
| "Demo data · temporary saves" in Explore | The app is using fixtures. For Firestore-backed saves, set `EXPO_PUBLIC_API_MODE=live` in `mobile/.env`, then restart with `npx expo start --clear`. |
| No places for Seattle | Check the search/category/Saved filters, then verify that the emulators have sample data. Rerun step 2 after an emulator restart. |
| "Port already in use" when starting the emulators | Another copy is still running. Stop it with Ctrl+C in its terminal. |
| The app doesn't load at all on an iPhone | Some networks block devices from reaching each other. Connect the computer to the phone's Personal Hotspot and use the new address from `ipconfig getifaddr en0`. |

### Team members: using the real Firebase project

To run against the team's Firebase project instead of the emulators, copy `mobile/.env.example` to `mobile/.env`, and fill in the Firebase values from the living document. Leave `EXPO_PUBLIC_EMULATOR_HOST` empty. Never commit `.env`. With `EXPO_PUBLIC_API_MODE` empty, every call returns sample data ("fixtures"), which is useful for building screens.

## Architecture

Roami's backend logic runs inside the app, and the app talks to Firebase Authentication and Cloud Firestore directly. There is no server and no Cloud Functions: the budget is $0, deploying Cloud Functions needs Firebase's paid Blaze plan, and Authentication and Firestore are free at our size (decided October 2026).

Every request follows the same path:

```
Screen → callApi('name', request) → service → repository → Firestore
```

- **Screens** call only `callApi`. They never import Firebase.
- **`callApi`** (`mobile/src/api/`) checks every call against the contract. In live mode it runs the real service; functions without one yet return sample data.
- **Services** (`mobile/src/services/`) check the request, call repositories and pure logic, and return the contract's response type. They throw `ApiError` with a code such as `invalid-argument`, `not-found`, or `aborted`.
- **Repositories** (`mobile/src/repositories/`) are the only code that reads or writes Firestore.
- **Pure logic** (`mobile/src/logic/`) holds search matching and trip validation. Plain data in, plain data out, no Firebase.
- **The contract** (`shared/src/`) defines every call's request and response, and every Firestore document, as TypeScript types.
- **`firestore.rules`** is the only server-side enforcement. It checks identity, ownership, document IDs, field shapes, and that each trip change raises the trip's `revision` by exactly one.

ESLint enforces these layers (see [docs/coding-guidelines.md](docs/coding-guidelines.md)).

**Trade-offs we accepted.**

- **Some checks live only in the app.** The rules can't count stops per day or run the itinerary planner, so a modified app could skip those checks.
- **Nothing in the app is secret.** Anything shipped in the app can be read, including the Firebase web configuration. Data is protected by the security rules.
- **Free-tier limits.** Search caches each city's data for 60 seconds to stay under the daily read quota.
- **Moderation is manual,** through an admin script.
- **Profiles are public.** Rules can't hide individual fields, so profile documents never hold private data such as email.

**Still open:** app distribution. Expo Go is free but needs a computer running `npx expo start`. A standalone app through TestFlight needs the paid Apple Developer Program.

## Repository layout

```
Roami/
├── mobile/                      # The iOS app (Expo + React Native + TypeScript)
│   ├── App.tsx                  # Entry point: sign-in, then the home screen
│   ├── src/
│   │   ├── api/                 # callApi, ApiError, sample data
│   │   ├── services/            # Logic for each component (profiles, places, search, saves, trips)
│   │   ├── repositories/        # Firestore reads and writes
│   │   ├── logic/               # Pure code with no Firebase (search matching, trip validation)
│   │   ├── auth/                # Sign-in: AuthService, AuthProvider, AuthScreens
│   │   └── dev/                 # Temporary developer screen (Load places, Run backend check)
│   ├── __tests__/               # Jest tests
│   ├── test-utils/              # In-memory Firestore for tests, following the security rules
│   └── .env.example             # Environment variables
├── shared/src/                  # The contract: api.ts, views.ts, models.ts (types only)
├── backend/                     # Not a server: rules tests and the seed script
│   ├── test/                    # Security rules tests
│   └── src/scripts/seed.ts      # Loads sample data into the emulator
├── docs/                        # Developer guides
├── firestore.rules              # Security rules
├── firestore.indexes.json       # Firestore indexes
├── firebase.json                # Firebase and emulator configuration
└── .github/workflows/           # CI
```

`backend/src/index.ts` holds an unused `healthCheck` placeholder from before the Cloud Functions decision. Don't add Cloud Functions to it.

## Bug tracking

Bugs are tracked in [GitHub Issues](https://github.com/penacoat/Roami/issues). Each bug report includes:

- **Steps to reproduce** the bug
- **Expected and actual behavior**
- **Labels** for severity (critical to minor) and area (frontend or backend)

The pull request that fixes a bug says which bug it fixes, for example `Fixes #12`, so the issue closes when the fix merges.

## Team workflow

- **Never commit to `main`.** Work on a branch, open a pull request, make sure CI passes, and get a review.
- **Branch names:** `<github-username>/<short-description>`, for example `bhelle/trips`.
- **Before opening a pull request,** run `npm run format` and `npm run lint` in `mobile/`.
- **Changes to `shared/`** get their own small pull request that the whole team reviews. Prefer adding fields to renaming or removing them.
- **Import shared types with `import type`.** A normal import from `@roami/shared` crashes the app. See [docs/shared-models.md](docs/shared-models.md).
- **`null` means unknown.** Never turn a missing walking time or opening hours into `0` or "closed."
- **Never commit** `.env`, service account keys, `node_modules/`, or debug logs. Don't run `npm audit fix --force`.

More guides: [where code goes](docs/where-code-goes.md) (adding a new service), [coding guidelines](docs/coding-guidelines.md), [shared models](docs/shared-models.md).

## Team

| Name | Role |
|---|---|
| Antonia Kwan | Project Manager, UI and frontend |
| Ameli Graff | UI and frontend |
| Athena Bao | UX research, frontend |
| Rui Chu | Scrum Master, backend |
| Penelope Coates | Backup Scrum Master, backend |
| Brooklyn Helle | Backend |

Living document (requirements, design, and process): https://docs.google.com/document/d/1Kz8SdI8w7-ivWgA3terH4hSaZwHyNAZs51WpcsMWDO0/edit?usp=sharing
