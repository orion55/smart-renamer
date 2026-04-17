# Fallback Cleanup Design

**Date:** 2026-04-17  
**Status:** Approved

## Problem

When the AI model cannot translate a filename (returns `"-"`), `normalizeTranslation` in `gpt.service.ts` maps it to `null`, and the path is not added to the `translations` Map. In `renameAll`, the fallback is the raw `originalName`, which may contain years, codecs, resolution, release groups, and dot/underscore separators. The result is a dirty filename instead of a clean one.

## Goal

When GPT fails for an item, use a cleaned-up version of `originalName` as the fallback instead of the raw original — stripping technical junk while preserving the meaningful title fragments.

## Scope

Only items that were queued for GPT (in `allForGpt`) and received no translation are cleaned. Items never sent to GPT (already clean/processed) are unaffected in `renameAll` behaviour.

## Cleaning Algorithm

Applied in this order:

1. Strip release-group suffix: `-SiNNERS`, `-LOL`, `-NTb` (already in `JUNK_TOKENS` via `-[A-Z0-9]{2,10}$`)
2. Strip technical tokens: `1080p`, `BDRip`, `x264`, `HEVC`, `AAC`, etc. (`JUNK_TOKENS_G`)
3. Strip year patterns: `(2024)`, `.2024.`, `2021-2022` (`YEAR_G`)
4. Replace dot/underscore separators with spaces
5. Collapse multiple spaces + trim
6. Strip leading/trailing separators (`-`, `–`)

### Examples

| Input | Output |
|---|---|
| `Breaking.Bad.S01.1080p.BluRay.x264-SiNNERS` | `Breaking Bad S01` |
| `Слово пацана 1080p WEB-DL x265 Кровь на асфальте` | `Слово пацана Кровь на асфальте` |
| `Sherlock.2010.S01E01.720p.BluRay` | `Sherlock S01E01` |

## Changes

### 1. `src/helpers/patterns.ts`

Add global variants of existing patterns (used only with `.replace()`, never with `.test()`/`.exec()`):

```typescript
export const JUNK_TOKENS_G = /\b(?:720p|1080p|...)\b|-[A-Z0-9]{2,10}$/gi;
export const YEAR_G = /[._( ]\d{4}[._) ]|\d{4}-\d{4}/g;
```

### 2. `src/helpers/cleanup.ts` (new file)

Two exports:

- `cleanFallbackName(name: string): string` — pure function implementing the algorithm above
- `applyFallbackCleanup(entries: MediaGptEntry[], translations: TranslationMap): void` — iterates entries, adds cleaned name to map for any entry without a translation

### 3. `src/index.ts`

One additional single-line call after `applyTranslations`:

```typescript
applyFallbackCleanup(allForGpt, translations);
```

## Non-Changes

- `gpt.service.ts` — no changes
- `renamer.service.ts` — no changes
- `classifier.service.ts` — no changes

## Constraints

- `index.ts` rule: only single-line function calls and data-passing objects — the loop lives in `cleanup.ts`
- Module system: `"type": "commonjs"`, node imports use `node:` protocol
- Code style: arrow functions only, no single-letter variables, single quotes, semicolons
