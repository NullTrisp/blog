# Repository Guidelines

## Project Structure & Module Organization

Quartz is a TypeScript/Preact static-site generator. Core build code lives in `quartz/`; plugins are grouped under `quartz/plugins/`, UI components under `quartz/components/`, shared helpers under `quartz/util/`, and global styles under `quartz/styles/`. Site-specific extensions belong in `custom/`. Author Markdown in `content/` (this site currently separates `en/` and `es/` content), while project documentation lives in `docs/`. Root files `quartz.config.ts` and `quartz.layout.ts` control behavior and layout. Treat `public/`, `.quartz-cache/`, `node_modules/`, and `tsconfig.tsbuildinfo` as generated artifacts.

## Build, Test, and Development Commands

Use Node 22+ and npm 10.9.2+ (see `.node-version` and `package.json`).

- `npm ci`: install the exact dependencies recorded in `package-lock.json`.
- `npm run serve`: build `content/`, watch for changes, and serve a local preview.
- `npm run docs`: preview the `docs/` tree instead of site content.
- `npx quartz build`: produce the static site in `public/`.
- `npm test`: run all TypeScript tests through `tsx --test`.
- `npm run check`: run strict TypeScript checks and verify Prettier formatting.
- `npm run format`: apply Prettier to supported files.

## Coding Style & Naming Conventions

Follow `.prettierrc`: two-space indentation, 100-character lines, trailing commas, and no semicolons. TypeScript is strict; keep imports ESM-compatible and avoid unused variables or parameters. Use PascalCase for Preact components (`LanguageSwitcher.tsx`), camelCase for functions and utilities (`breadcrumbPaths.ts`), and lowercase Markdown filenames with hyphens where practical (`android-server.md`). Keep component SCSS in `quartz/components/styles/` and browser scripts in `quartz/components/scripts/`.

## Testing Guidelines

Place tests next to the implementation as `*.test.ts`; existing examples use `node:test` and `node:assert`. Add focused regression coverage for behavior changes, especially path handling, search, plugins, and build output. No coverage threshold is enforced. Before submitting, run `npm test`, `npm run check`, and `npx quartz build -d docs`.

## Commit & Pull Request Guidelines

Use Conventional Commit prefixes found in project history and the PR template, such as `feat:`, `fix:`, `docs:`, `test:`, or scoped forms like `fix(explorer): ...`. Automated content synchronizations use `Quartz sync: <date>`. Keep commits focused. PRs should explain the change and motivation, link relevant issues, report verification commands, and include before/after screenshots for visual changes. Review generated or AI-assisted changes before submission and do not commit build output.
