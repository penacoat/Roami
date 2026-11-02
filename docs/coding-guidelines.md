# Roami Coding Guidelines

Languages - Style Guidelines

- TypeScript - https://google.github.io/styleguide/tsguide.html
- React / JSX (React Native components) - https://github.com/airbnb/javascript/tree/master/react

We chose the TypeScript guideline because it is based on the internal Google TypeScript style guide with adjustments to remove Google specific sections that do not apply to all. It is widely used and was made specifically for TypeScript. It covers naming, typing, imports, error handling, and more.

We could not find an official React Native style guideline. Since React Native components are written in React and JSX, we will use Airbnb's React/JSX style guide, which based its content on the standards that are currently prevalent in JavaScript and applies those standards to React. There is a clear table of contents that covers naming, declaration, alignment, spacing, etc.

Before any work is pushed, team members are expected to make sure their code follows the guidelines of whatever language they are working on. We use ESLint and Prettier, configured in the repo so everyone uses the same rules. We will also run checks to make sure everyone is following the style guides every week during our group’s Tuesday meeting time.

## Lint and formatting

ESLint and Prettier are set up in `mobile/`. Run these from the `mobile/` folder before you push:

| Command | What it does |
|---|---|
| `npm run lint` | Checks for errors, layering violations, and formatting problems |
| `npm run lint:fix` | Fixes everything that can be fixed automatically |
| `npm run format` | Formats every file with Prettier |
| `npm run typecheck` | Runs the TypeScript compiler without building |

CI runs `lint`, `format:check`, `typecheck`, and the tests on every pull request to `main`, so a PR that fails any of them shows a red X.

**Editor setup (VS Code, recommended):** install the **ESLint** and **Prettier** extensions, then turn on **Format On Save** with Prettier as the default formatter. Problems then show up as you type.

**What's configured.** We start from Expo's ESLint config plus TypeScript's recommended rules, with Prettier for formatting (single quotes, trailing commas, 100-character lines; see `mobile/.prettierrc`). Airbnb's React rules need extra setup to work with TypeScript and the current version of ESLint, so we'll add them once this setup is stable.

**Layering rules.** `mobile/eslint.config.js` also enforces where code goes (see [where-code-goes.md](where-code-goes.md)). Lint fails if:

- anything outside `src/repositories/` imports `firebase/firestore`;
- anything outside `src/auth/` imports `firebase/auth` or `firebase/app`;
- a service imports Firebase instead of going through a repository;
- code in `src/logic/` imports Firebase, repositories, services, or `src/api`;
- a screen or component (`src/screens/`, `src/components/`, `src/app/`) imports Firebase, repositories, or services instead of using `callApi`;
- any file imports `@roami/shared` without `import type` (this crashes the app at runtime).

Tests in `mobile/__tests__/` may import and mock Firebase directly.

**Console output.** `console.log` is flagged as a warning so leftover debugging gets noticed. When output is intended, use `console.warn` or `console.error` with an `// eslint-disable-next-line no-console` comment.
