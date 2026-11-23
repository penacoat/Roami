# Antonia's tracker notes

Updated November 22. [Bug tracker](https://docs.google.com/document/d/16McBW2k3DkfOC59PnsJLZBW2y0-GAWinxa0rTkKbvcM/edit?tab=t.t1zcwq488lqn).

## done

- Explore map/drawer cleanup, city suggestions + current location, compact actions, place details and search fixes.
- shared headings/nav, navy login, loading ribbon + Profile sign out.
- pull-to-refresh, saved postcard grouping, individual bookmarks + recommendation sources carried into itineraries.
- connected the city picker, Explore + Postcards to Brooklyn's OSM city IDs; preserved the saved-note editor and import logic from main.
- phone check confirmed by Antonia. all 10 assigned tracker rows marked done; teammates' statuses kept.

## checks

Mobile: 45 suites / 390 tests passed, plus the final 4 affected suites / 50 tests. Lint, formatting, typecheck and backend build pass. Browser review confirms the beige Explore header is gone.

City autocomplete uses GeoNames. A confirmed selection resolves the OSM city boundary, and catalog/search/feed requests use that ID. First imports allow up to 450 seconds for the provider's bounded retries; normal reads and refreshes retain the 8-second timeout. Slow imports show a message without blocking map controls.

## integration notes

Hours, website, address, tickets and photos appear when supplied. OSM coverage varies; missing hours stay unknown. SAM, Chihuly + Jazz Alley have dated, linked website-hours examples in local data.

Profile setup/interests, Following/home, feed pagination and postcard clipping remain with their existing owners. Friends-first ordering depends on following data. Firestore rules still apply to OSM imports and recommendation sources. This merge does not deploy the app or rules.

## local testing

Use Node 24. Expo CLI is signed in as neeyuh. The current LAN URL is `exp://192.168.1.71:8089`; browser design review is `http://localhost:8090/design-review`. Addresses change with the network. Restart Metro after edits on this host.

Local Auth/Firestore use ports 9099/8080. The demo has 50 Seattle places, 75 postcards, three saves + one trip. `npm --prefix backend run seed:hours:local` restores the three sourced hours examples without changing users/saves/trips. Fixture/emulator records do not upload to production. Local environment files, emulator data + QR images stay out of git.
