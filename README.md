# Roami
Roami is an iOS mobile social travel discovery and planning app designed to feel like a knowledgeable local who understands your interests. Users can search for something specific, explore recommendations on a map, or find inspiration in a feed of friends' trips and linked social posts. Recommendations show who suggested a place and what they liked about it. Roami connects finding somewhere worth going with figuring out how to go.

## Repository Layout
```
roami/
├── mobile/                          # Expo + React Native + TS
│   └── src/
│       ├── auth/                    # AuthService.ts, AuthProvider.tsx, AuthScreens.tsx
│       ├── screens/                 # ProfileScreen, DiscoveryScreen, SavedPlacesScreen,
│       │                            # ItineraryScreen, VisitRankingScreen
│       ├── components/              # RecommendationCard, RecommendationEditor,
│       │                            # PlaceMap, TripOverview
│       └── api/ApiClient.ts         # the only way screens reach the backend
├── backend/                         # Cloud Functions (functions source dir)
│   └── src/
│       ├── handlers/                # validate input (zod) + call Authorization
│       ├── authorization.ts
│       ├── services/                # search/ (SearchMatcher, DiscoveryService), social/,
│       │                            # saves/, trips/, revision/, preparation/,
│       │                            # visits/, safety/ (BlockService, ModerationService)
│       ├── planner/                 # ItineraryPlanner.ts, ScheduleValidator.ts (pure)
│       ├── repositories/            # User, Content, Travel, Moderation
│       ├── adapters/                # PlaceDataAdapter.ts, RoutingAdapter.ts
│       └── scripts/                 # admin moderation script, pilot place import
├── shared/
│   └── src/models.ts                # types for every Firestore collection + zod schemas
├── tests/                           # rules tests, planner fixtures, end-to-end
├── docs/                            # architecture, spike-places-routing.md
├── .github/workflows/ci.yml
├── firestore.rules
├── firestore.indexes.json
├── firebase.json                    # "functions": { "source": "backend" }
├── eslint.config.js (or .eslintrc.cjs)
├── .prettierrc
├── tsconfig.base.json
└── package.json                     # "workspaces": ["mobile", "backend", "shared"]

mobile/ --> the React Native iOS app, contains everything users see and interact with 
backend/ --> the server that stores data and handles search, recommendations, trips, and social features
docs/ --> project documentation, such as specs, architecture notes, API references, etc
scripts/ --> Helper scripts for setup and running the project locally 
.github/ --> GitHub automation, templates, like for pull requests
README.md --> What Roami is, why it's useful, and how to get started using or working on it depending who you are
CONTRIBUTING.md --> Instructions for setup, branching, and how to submit changes
LICENSE --> legal terms under which the code can be used
.env.example --> environment variables the project needs
```
## Architecture decision: no Cloud Functions (October 2026)

**Decision.** Roami's backend logic runs inside the app, and the app talks to Firebase
Authentication and Cloud Firestore directly. We do not use Cloud Functions.

**Why.** Our budget is $0, and the project has to keep working after the demo without
anyone's laptop running a backend. Deploying Cloud Functions requires Firebase's paid
Blaze plan (a billing account with a payment method). Firebase Authentication and
Cloud Firestore both have no-cost quotas on the free Spark plan that are well above what
we need (about 50,000 Firestore reads and 20,000 writes per day, 1 GiB of storage, and
50,000 monthly active users). Running the backend in the Firebase emulators would only
work while a laptop is running them.

**What this supersedes.** The original design describes request handlers and services
running on a server. That description no longer applies. The layering is kept, but all of
it now runs in `mobile/`.

### What stays the same

- Screens never access Firestore directly. They call `ApiClient`, which calls services,
  which call repositories. Repositories are the only code that reads or writes Firestore.
- The API contract and view types in `shared/` (`api.ts`, `views.ts`, `models.ts`).
  `ApiClient` keeps the same function names and request/response types, but calls local
  code instead of the network.
- Authentication (`AuthService`, `AuthProvider`, `AuthScreens`).
- The pure logic: `SearchMatcher`, `ItineraryPlanner`, `ScheduleValidator`, and
  `RecommendationValidator` take plain data in and return plain data out, with no Firebase
  imports.
- The trip `revision` number, with changes saved in a single Firestore transaction so a
  failed revision leaves the saved plan unchanged.

### What changes

| Before | Now |
|---|---|
| Handlers, services, and repositories run in Cloud Functions | They run inside the app (`mobile/`) |
| Repositories use the Admin SDK | Repositories use the client SDK |
| Handlers check identity, ownership, and input | Firestore security rules do these checks |
| Rules allow reads only; all writes go through the backend | Rules allow validated writes from the app |
| Moderation and place imports are backend scripts | Admin scripts run from a developer's laptop with the Admin SDK |

### Trade-offs the team has accepted

- **Weaker server-side enforcement.** Security rules can check ownership, document IDs,
  and revision numbers, but they cannot run the itinerary planner. A modified app could
  skip the planner's checks, so the planner is enforced by the app, not the server.
- **No secrets in the app.** Anything shipped in the app can be read, so API keys for
  external services (for example routing) must be ones we are comfortable exposing, or
  the data must be fetched ahead of time by an import script.
- **Free-tier ceilings.** Search should cache results so we stay under the daily Firestore
  read quota.
- **Moderation is manual.** Reviewing reports and removing content happens through an
  admin script run by a team member.

### Still open

- **App distribution.** Expo Go is free but needs a running dev server (`npx expo start`)
  on someone's laptop. A standalone iOS app through TestFlight or the App Store requires
  the paid Apple Developer Program (about $99 per year). Options we have not decided:
  keep demoing through Expo Go, find someone to cover the membership, or test whether a
  web version hosted on Firebase Hosting works for the map and trips.
- **Privacy of `users` documents.** Rules cannot hide individual fields, so profile
  documents must not contain private data such as email addresses.

### Local development

We still use the Firebase emulators for Authentication and Firestore, so we can develop,
seed data, and run the security rules tests without touching the real project. See
`docs/setup.md`.


## Living Document 
https://docs.google.com/document/d/1Kz8SdI8w7-ivWgA3terH4hSaZwHyNAZs51WpcsMWDO0/edit?usp=sharing
* must be signed into a UW email to access

## Branch naming

Format: `<github-username>/<short-description>`

Examples:
- `penacoat/auth`
- `penacoat/shared-models`
- `jsmith/fix-search-typo`


## Documentation

- [Setup instructions](docs/setup.md)
- [Team workflow](docs/team-workflow.md)

## Architecture decision: no Cloud Functions (October 2026)

**Decision.** Roami's backend logic runs inside the app, and the app talks to Firebase
Authentication and Cloud Firestore directly. We do not use Cloud Functions.

**Why.** Our budget is $0, and the project has to keep working after the demo without
anyone's laptop running a backend. Deploying Cloud Functions requires Firebase's paid
Blaze plan (a billing account with a payment method). Firebase Authentication and
Cloud Firestore both have no-cost quotas on the free Spark plan that are well above what
we need (about 50,000 Firestore reads and 20,000 writes per day, 1 GiB of storage, and
50,000 monthly active users). Running the backend in the Firebase emulators would only
work while a laptop is running them.

**What this supersedes.** The original design describes request handlers and services
running on a server. That description no longer applies. The layering is kept, but all of
it now runs in `mobile/`.

### What stays the same

- Screens never access Firestore directly. They call `ApiClient`, which calls services,
  which call repositories. Repositories are the only code that reads or writes Firestore.
- The API contract and view types in `shared/` (`api.ts`, `views.ts`, `models.ts`).
  `ApiClient` keeps the same function names and request/response types, but calls local
  code instead of the network.
- Authentication (`AuthService`, `AuthProvider`, `AuthScreens`).
- The pure logic: `SearchMatcher`, `ItineraryPlanner`, `ScheduleValidator`, and
  `RecommendationValidator` take plain data in and return plain data out, with no Firebase
  imports.
- The trip `revision` number, with changes saved in a single Firestore transaction so a
  failed revision leaves the saved plan unchanged.

### What changes

| Before | Now |
|---|---|
| Handlers, services, and repositories run in Cloud Functions | They run inside the app (`mobile/`) |
| Repositories use the Admin SDK | Repositories use the client SDK |
| Handlers check identity, ownership, and input | Firestore security rules do these checks |
| Rules allow reads only; all writes go through the backend | Rules allow validated writes from the app |
| Moderation and place imports are backend scripts | Admin scripts run from a developer's laptop with the Admin SDK |

### Trade-offs the team has accepted

- **Weaker server-side enforcement.** Security rules can check ownership, document IDs,
  and revision numbers, but they cannot run the itinerary planner. A modified app could
  skip the planner's checks, so the planner is enforced by the app, not the server.
- **No secrets in the app.** Anything shipped in the app can be read, so API keys for
  external services (for example routing) must be ones we are comfortable exposing, or
  the data must be fetched ahead of time by an import script.
- **Free-tier ceilings.** Search should cache results so we stay under the daily Firestore
  read quota.
- **Moderation is manual.** Reviewing reports and removing content happens through an
  admin script run by a team member.

### Still open

- **App distribution.** Expo Go is free but needs a running dev server (`npx expo start`)
  on someone's laptop. A standalone iOS app through TestFlight or the App Store requires
  the paid Apple Developer Program (about $99 per year). Options we have not decided:
  keep demoing through Expo Go, find someone to cover the membership, or test whether a
  web version hosted on Firebase Hosting works for the map and trips.
- **Privacy of `users` documents.** Rules cannot hide individual fields, so profile
  documents must not contain private data such as email addresses. The rules reject an
  `email` field.

### Local development

We still use the Firebase emulators for Authentication and Firestore, so we can develop,
seed data, and run the security rules tests without touching the real project. See
`docs/setup.md`.
