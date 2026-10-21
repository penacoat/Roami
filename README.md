# Roami
Roami is an iOS mobile social travel discovery and planning app designed to feel like a knowledgeable local who understands your interests. Users can search for something specific, explore recommendations on a map, or find inspiration in a feed of friends' trips and linked social posts. Recommendations show who suggested a place and what they liked about it. Roami connects finding somewhere worth going with figuring out how to go.

# Repository Layout
```
roami/
├── apps/
│   └── mobile/                 # Expo + React Native + TS
│       └── src/
│           ├── screens/        # Feed, Search, Map, Trip, Profile
│           ├── components/
│           ├── features/       # accounts, discovery, social, saved, itinerary, visits, safety
│           ├── lib/firebase.ts
│           └── api/            # typed wrappers around callable functions
├── functions/                  # Firebase Cloud Functions (backend)
│   └── src/
│       ├── handlers/           # request handlers: auth check, validate input, call service
│       ├── services/           # search, recommendations, planner, moderation
│       ├── planner/
│       │   ├── generator.ts    # bounded heuristic, max 2 alternatives
│       │   └── validator.ts    # separate: time windows, hours, walking limits, durations
│       ├── repositories/       # all Firestore reads/writes live here
│       └── adapters/           # place data (OSM) + routing, behind interfaces
├── packages/
│   └── shared/                 # TS models, enums, zod schemas, constants
├── scripts/
│   └── import-places/          # Overpass -> Places import for pilot city
├── docs/                       # architecture, spike findings
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
└── package.json                # npm workspaces

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

# Living Document 
https://docs.google.com/document/d/1Kz8SdI8w7-ivWgA3terH4hSaZwHyNAZs51WpcsMWDO0/edit?usp=sharing
* must be signed into a UW email to access
