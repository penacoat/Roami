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
