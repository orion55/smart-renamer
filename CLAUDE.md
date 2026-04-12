# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # run via tsx (no build step)
npm run build      # rimraf dist && ncc bundle → dist/index.js
npm run check      # biome lint + format (auto-fix)
npm run lint       # biome lint only
npm run format     # biome format --write
```

## Architecture

This is a Node.js/TypeScript CLI utility that rewrites the PowerShell script in `docs/renameSerial/renameSerial.ps1`. That PS1 file is the **source of truth for business logic** — refer to it when implementing or changing rename/translate behaviour.

### Key files

- `src/index.ts` — entry point: prints banner, starts logger, orchestrates everything
- `src/logger.service.ts` — winston logger with daily-rotate-file; reads `LOG_DIR` from `.env`
- `src/helpers/greeting.ts` — cfonts ASCII banner
- `appDir.ts` — exports `ROOT_DIR` (`__dirname` of project root); imported by logger

### Module system

`"type": "commonjs"` — required for `@vercel/ncc` compatibility. Do not switch to ESM.

Node built-in imports must use the `node:` protocol (enforced by Biome): `import path from 'node:path'`.

### Code style (Biome)

Single quotes, semicolons, 2-space indent, line width 100, trailing commas. Run `npm run check` before committing.

- **Arrow functions only** — use `const foo = () => {}` everywhere; `function` declarations are forbidden.
- **No single-letter variables** — all identifiers must be descriptive (e.g. `entry`, not `e`; `error`, not `err`).

### Environment

Copy `.env.example` to `.env`. Only `LOG_DIR` is currently used (defaults to `<root>/logs`).

### Build output

`ncc` bundles everything into a single `dist/index.js` with minification (`-m` flag). The `dist/` folder is wiped before each build via `rimraf`.

---

## MCP Servers

| Сервер | Префикс инструментов | Назначение |
|---|---|---|
| **context7** | `mcp__context7__*` | Актуальная документация библиотек — использовать перед работой с любым SDK/API |
| **filesystem** | `mcp__filesystem__*` | Расширенные файловые операции (дерево директорий, перемещение, размеры) |
| **ide** | `mcp__ide__*` | Интеграция с IDE: диагностика TypeScript/Biome ошибок |
| **memory** | `mcp__memory__*` | Граф знаний: сущности, связи, наблюдения между сессиями |
| **playwright** | `mcp__playwright__*` | Автоматизация браузера: навигация, скриншоты, клики, заполнение форм |
| **sequential-thinking** | `mcp__sequential-thinking__*` | Структурированное пошаговое мышление для сложных задач |
