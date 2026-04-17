# Fallback Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Когда GPT возвращает `"-"` и перевод недоступен, использовать очищенный вариант `originalName` (без кодеков, лет, разделителей) вместо сырого значения.

**Architecture:** После `applyTranslations` в `index.ts` вызывается `applyFallbackCleanup` из нового модуля `helpers/cleanup.ts`. Функция итерирует `allForGpt` и для элементов, отсутствующих в `translations`, добавляет в Map результат `cleanFallbackName(originalName)`. Сами сервисы (`gpt`, `renamer`, `classifier`) не затрагиваются.

**Tech Stack:** TypeScript, Node.js (CommonJS), Biome

---

## Файловая карта

| Действие | Путь | Ответственность |
|---|---|---|
| Modify | `src/helpers/patterns.ts` | Добавить `JUNK_TOKENS_G` и `YEAR_G` (глобальные варианты для replace) |
| Create | `src/helpers/cleanup.ts` | `cleanFallbackName` и `applyFallbackCleanup` |
| Modify | `src/gpt/gpt.service.ts:240` | Поменять возвращаемый тип `applyTranslations` на `Map<string, string>` |
| Modify | `src/gpt/gpt.types.ts:63-64` | Удалить неиспользуемый `TranslationMap` |
| Modify | `src/index.ts` | Добавить вызов `applyFallbackCleanup` |

---

## Task 1: Добавить глобальные паттерны JUNK_TOKENS_G и YEAR_G

**Files:**
- Modify: `src/helpers/patterns.ts`

Глобальные варианты нужны исключительно для `String.replace()` — никогда не использовать с `.test()` / `.exec()` (g-флаг меняет `lastIndex`).

- [ ] **Step 1: Добавить JUNK_TOKENS_G сразу после JUNK_TOKENS**

В `src/helpers/patterns.ts` после блока `JUNK_TOKENS` добавить:

```typescript
/**
 * JUNK_TOKENS_G — глобальная версия для String.replace().
 * Не использовать с .test()/.exec() — g-флаг изменяет lastIndex между вызовами.
 */
export const JUNK_TOKENS_G =
  /\b(?:720p|1080p|2160p|4[Kk]|480p|360p|BDRip|BluRay|Blu-Ray|WEBRip|WEB-DL|HDRip|DVDRip|HDTV|x264|x265|H\.?264|H\.?265|AVC|HEVC|AAC|AC3|DTS|MP3|FLAC|HDR|SDR|10bit)\b|-[A-Z0-9]{2,10}$/gi;
```

- [ ] **Step 2: Добавить YEAR_G сразу после YEAR**

```typescript
/**
 * YEAR_G — глобальная версия для String.replace().
 * Не использовать с .test()/.exec() — g-флаг изменяет lastIndex между вызовами.
 */
export const YEAR_G = /[._( ]\d{4}[._) ]|\d{4}-\d{4}/g;
```

- [ ] **Step 3: Проверить lint**

```bash
npm run check
```

Ожидаемый вывод: `Checked N file(s) in Xms — no errors`

- [ ] **Step 4: Commit**

```bash
git add src/helpers/patterns.ts
git commit -m "feat: добавить JUNK_TOKENS_G и YEAR_G для replace()"
```

---

## Task 2: Создать src/helpers/cleanup.ts

**Files:**
- Create: `src/helpers/cleanup.ts`

### Алгоритм cleanFallbackName (порядок важен)

1. `JUNK_TOKENS_G` → `' '` — убрать кодеки, разрешение, release-группу в конце
2. `YEAR_G` → `' '` — убрать годы, включая диапазоны
3. `/[._]+/g` → `' '` — заменить разделители-точки/подчёркивания на пробел
4. `/\s{2,}/g` → `' '` — схлопнуть множественные пробелы
5. `.trim()` — убрать граничные пробелы
6. `/^[-–\s]+/` → `''` — убрать ведущие дефисы
7. `/[-–\s]+$/` → `''` — убрать завершающие дефисы

### Трассировка примеров (ручная проверка)

| Вход | После JUNK_TOKENS_G | После YEAR_G | После [._] | Результат |
|---|---|---|---|---|
| `Breaking.Bad.S01.1080p.BluRay.x264-SiNNERS` | `Breaking.Bad.S01. . . ` | без изм. | `Breaking Bad S01` | `Breaking Bad S01` |
| `Слово пацана 1080p WEB-DL x265 Кровь на асфальте` | `Слово пацана    Кровь на асфальте` | без изм. | без изм. | `Слово пацана Кровь на асфальте` |
| `Sherlock.2010.S01E01.720p.BluRay` | `Sherlock.2010.S01E01. . ` | `Sherlock S01E01. . ` | `Sherlock S01E01` | `Sherlock S01E01` |
| `Naruto.2002-2007.HEVC` | `Naruto.2002-2007. ` | `Naruto.. ` | `Naruto` | `Naruto` |
| `Во все тяжкие` | без изм. | без изм. | без изм. | `Во все тяжкие` |

- [ ] **Step 1: Создать файл**

Создать `src/helpers/cleanup.ts`:

```typescript
import { JUNK_TOKENS_G, YEAR_G } from './patterns';

export const cleanFallbackName = (name: string): string =>
  name
    .replace(JUNK_TOKENS_G, ' ')
    .replace(YEAR_G, ' ')
    .replace(/[._]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[-–\s]+/, '')
    .replace(/[-–\s]+$/, '');

type FallbackEntry = { item: { originalName: string; path: string } };

export const applyFallbackCleanup = (
  entries: FallbackEntry[],
  translations: Map<string, string>,
): void => {
  for (const entry of entries) {
    if (!translations.has(entry.item.path)) {
      translations.set(entry.item.path, cleanFallbackName(entry.item.originalName));
    }
  }
};
```

- [ ] **Step 2: Проверить lint и типы**

```bash
npm run check && npx tsc --noEmit
```

Ожидаемый вывод: ошибок нет.

- [ ] **Step 3: Commit**

```bash
git add src/helpers/cleanup.ts
git commit -m "feat: cleanFallbackName и applyFallbackCleanup"
```

---

## Task 3: Обновить типы и подключить applyFallbackCleanup в index.ts

**Files:**
- Modify: `src/gpt/gpt.service.ts:240`
- Modify: `src/gpt/gpt.types.ts:63-64`
- Modify: `src/index.ts`

### Почему меняется тип applyTranslations

`applyTranslations` объявлена с return type `Promise<TranslationMap>`, где `TranslationMap = ReadonlyMap<string, string>`. `applyFallbackCleanup` принимает мутируемый `Map<string, string>`. Внутри `applyTranslations` уже создаётся `new Map<string, string>()` — нужно просто убрать сужение до ReadonlyMap.

- [ ] **Step 1: Изменить return type в gpt.service.ts**

В `src/gpt/gpt.service.ts` строка 23 — убрать `TranslationMap` из импорта:

```typescript
import type {
  AliceCreateParams,
  MediaGptEntry,
  TranslateEntry,
  YandexCreateParams,
  YandexCreateResult,
} from './gpt.types';
```

Строка 240 — изменить сигнатуру:

```typescript
export const applyTranslations = async (allEntries: MediaGptEntry[]): Promise<Map<string, string>> => {
```

- [ ] **Step 2: Удалить TranslationMap из gpt.types.ts**

В `src/gpt/gpt.types.ts` удалить последние две строки:

```typescript
/** Результат applyTranslations: path → переведённое название. */
export type TranslationMap = ReadonlyMap<string, string>;
```

- [ ] **Step 3: Добавить вызов applyFallbackCleanup в index.ts**

Добавить импорт в начало `src/index.ts` (вместе с остальными импортами):

```typescript
import { applyFallbackCleanup } from './helpers/cleanup';
```

Строку:

```typescript
const translations = yandexEnabled ? await applyTranslations(allForGpt) : new Map();
```

заменить на:

```typescript
const translations = yandexEnabled ? await applyTranslations(allForGpt) : new Map<string, string>();
applyFallbackCleanup(allForGpt, translations);
```

Итоговый блок GROUP 4 в index.ts:

```typescript
// ── GROUP 4: GPT translation ─────────────────────────────────────────────────

const yandexEnabled = isYandexEnabled();
if (!yandexEnabled) logger.info('Yandex AI disabled (YANDEX_AI_ENABLED=false) — skipping GPT');
const translations = yandexEnabled ? await applyTranslations(allForGpt) : new Map<string, string>();
applyFallbackCleanup(allForGpt, translations);
```

- [ ] **Step 4: Проверить lint и типы**

```bash
npm run check && npx tsc --noEmit
```

Ожидаемый вывод: ошибок нет.

- [ ] **Step 5: Проверить сборку**

```bash
npm run build
```

Ожидаемый вывод: `dist/index.js` создаётся без ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/gpt/gpt.service.ts src/gpt/gpt.types.ts src/index.ts
git commit -m "feat: подключить applyFallbackCleanup — очищать originalName при провале GPT"
```
