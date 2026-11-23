# Antonia's tracker notes

Updated November 22. Branch: `antoniakwan/assigned-tracker-fixes`.

[Shared bug tracker](https://docs.google.com/document/d/16McBW2k3DkfOC59PnsJLZBW2y0-GAWinxa0rTkKbvcM/edit?tab=t.t1zcwq488lqn)

## changed on my branch

- cleaned up Explore's map + drawer. removed the blank strip above the map; controls stay below the status area. the map stays mounted while the drawer moves.
- fixed sunglasses returning the matcha store. shopping/vintage alone no longer counts as eyewear; actual eyewear recommendations still match.
- moved the shared city picker into the drawer. autocomplete, invalid-search feedback, map centering + current location are in. Explore/Postcards share a browsing city; trip creation keeps its own destination.
- made place actions one row: bookmark, itinerary plus, visited check. one directions link, optional website/tickets, hours + swipeable photos when the data includes them.
- grouped saved postcards under their place. removing one keeps the place, other postcards + private note. the original recommendation stays attached when opening a place or adding it to a trip.
- added pull-to-refresh to Explore results/details, Postcards, Saved + Itineraries. failed reads keep existing content; reads stop waiting after eight seconds. writes do not use this timeout.
- made titles static with an underline; kept the ribbon for loading. navy login retains sign in, account creation, recovery + password visibility. sign out is in Profile.
- kept teammates' Postcards/Itinerary content layouts. shared headings/nav + the requested compact Saved actions are updated.
- added dated website-hours examples for SAM, Chihuly + Jazz Alley, with source links. these are local snapshots, not a live business-details service. missing hours stay unknown.

## still need to

- [ ] test map gestures, drawer scrolling, refresh + loading smoothness on my phone, including slow/offline requests.
- [ ] test city suggestions, invalid searches, current-location permissions/timeouts + switching cities.
- [ ] connect this Explore branch to Brooklyn's OpenStreetMap city import, now on main in PRs #72/#73. pass the provider's city ID through the picker, map + feed. this branch still uses the older name-based catalog calls.
- [ ] check which hours, address, website + photo fields the provider supplies and map them into details. don't promise complete details for every place.
- [ ] test save several postcards → remove one → add to itinerary → reopen the original recommendation, including a failed write.
- [ ] check login / create account / recovery, smaller screens, large text, keyboard overlap + VoiceOver.
- [ ] decide friends-first vs all postcards once following data is ready.
- [ ] review + merge after Expo checks and city API hookup. branch push is separate from app deployment.

The eight original assigned rows stay in progress until these checks are done. The two unassigned Explore scrolling/cleanup rows now sit with my work too. Other owners/statuses were kept.

## team dependencies

Brooklyn's city API task is closed and the code is on main; my remaining task is connecting this branch to it. Feed pagination is still Brooklyn's. Profile/settings/interests, recommendation composition + postcard clipping are Ameli's. Following/current-trip home are Rui's. Profile currently only has sign out. Explore remains first until the team agrees otherwise.

The new import still stores places in Firestore, so rules still matter. Recommendation-source fields also need the matching rules at release. No deployment is included in this push.

## checks

40 mobile suites / 323 tests pass, including the matcha-search regression. Mobile lint, formatting, typecheck, backend TypeScript build and git diff checks pass. The earlier backend emulator run passed 6 suites / 128 tests. Native map performance, GPS and VoiceOver still need phone testing.

## local test setup

Use Node 24 in mobile. The ignored local environment selects the Auth/Firestore emulators; design review uses fixtures. Local records do not upload when changing API configuration. The demo has 50 Seattle places, 75 postcards, three saves + one trip. After reseeding, run `npm --prefix backend run seed:hours:local` for the three sourced hours examples. That script only patches loopback port 8080 and leaves users/saves/trips alone.

Expo CLI is signed in as neeyuh. Use the same account in Expo Go. LAN address: `exp://192.168.1.71:8089` (changes with networks). Auth is on 9099; Firestore on 8080. Metro uses CI=1 because file watching exceeds this host's limit; restart after source edits. Keep local environment files, emulator data + temporary QR images out of git. Local auth starts with a fresh sign-in after a full reload; production sessions retain normal persistence.

## push scope

Pushed the feature branch on November 22 after the map/search fixes and checks. Code commit: 6994698. No merge or deployment is requested. The branch is based on the team's a93a067 snapshot; the newer city import still needs integration before merge.
