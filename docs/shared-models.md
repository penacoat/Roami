## Importing shared types in `mobile/`

Always use `import type`, with the word `type`:

    import type { Trip, TripStop } from '@roami/shared';   // correct
    import { Trip } from '@roami/shared';                   // wrong: crashes the app

The `@roami/shared` alias only exists for TypeScript. The bundler that builds the app
doesn't know about it, so a regular import fails with "Unable to resolve module".
`import type` is removed before bundling, so it's safe.

Shared types only, for now: runtime values from the shared folder (such as the
`COLLECTIONS` constant) can't be imported in `mobile/` yet. Screens shouldn't need
them, because they never touch Firestore directly.