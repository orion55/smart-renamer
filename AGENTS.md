# Repository Guidelines

## Project Structure & Module Organization
Core application code lives in `src/`. The CLI entry point is `src/index.ts`, with feature modules split by concern:
- `src/scanner/` for filesystem discovery and folder flattening
- `src/classifier/` for content classification and GPT queue building
- `src/gpt/` for prompt construction, API calls, and response parsing
- `src/helpers/` for shared utilities

Project notes and design drafts are in `docs/`. Build output goes to `dist/`. Local sample data lives in `data/`, `data01/`, and `data02/`. Runtime logs are written to `logs/`.

## Build, Test, and Development Commands
- `npm run dev` runs the CLI via `tsx src/index.ts`
- `npm run build` bundles the app into `dist/` with `ncc`
- `npm run lint` runs Biome lint checks on `src/`
- `npm run format` formats `src/` with Biome
- `npm run check` applies Biome’s combined check/fix pass
- `npm run reset-data` recreates `data/` from `data01/`

Use `.env` for local configuration. Keep `.env.example` in sync when adding new variables.

## Coding Style & Naming Conventions
Use TypeScript with 2-space indentation and keep files ASCII unless an existing file already uses Cyrillic text. Prefer small, single-purpose modules and named exports.

Naming follows existing patterns:
- services: `*.service.ts`
- type definitions: `*.types.ts`
- helpers/constants/errors: descriptive lowercase file groups such as `gpt.constants.ts`

Run `npm run format` before submitting changes.

## Testing Guidelines
There is no automated test suite yet. For now, validate changes by:
- running `npm run build`
- running `npm run dev` against sample folders in `data/`
- checking generated logs in `logs/`

When adding tests, place them next to the related module or under a future `tests/` directory, and keep names aligned with the source module.

## Commit & Pull Request Guidelines
Recent history uses short task-oriented subjects, for example `BugFix 20260413 #03` and focused Russian summaries. Keep commit messages brief, imperative, and scoped to one change.

Pull requests should include:
- a short summary of the behavior change
- any config or env updates
- manual verification steps run locally
- sample input/output notes when renaming or GPT behavior changes

## Security & Configuration Tips
Do not commit `.env`, API keys, or real user media paths. Review changes to `src/gpt/` carefully: prompt edits, retry rules, and batching can affect token usage and provider costs.
