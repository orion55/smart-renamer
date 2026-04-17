# Fallback Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Когда GPT возвращает `"-"` и перевод недоступен, использовать очищенный вариант `originalName` (без кодеков, лет, разделителей) вместо сырого значения.

**Architecture:** После `applyTranslations` в `index.ts` вызывается `applyFallbackCleanup` из нового модуля `helpers/cleanup.ts`. Функция итерирует `allForGpt` и для элементов, отсутствующих в `translations`, добавляет в Map результат `cleanFallbackName(originalName)`. Сами сервисы (`gpt`, `renamer`, `classifier`) не затрагиваются.

**Tech Stack:** TypeScript, Node.js (CommonJS), Biome, Vitest

---

## Файловая карта

| Действие | Путь | Ответственность |
|---|---|---|
| Modify | `src/helpers/patterns.ts` | Добавить `JUNK_TOKENS_G` и `YEAR_G` (глобальные варианты для replace) |
| Create | `src/helpers/cleanup.ts` | `cleanFallbackName` и `applyFallbackCleanup` |
| Create | `src/helpers/cleanup.test.ts` | Unit-тесты для `cleanFallbackName` и `applyFallbackCleanup` |
| Modify | `src/gpt/gpt.service.ts` | Поменять возвращаемый тип `applyTranslations` на `Map<string, string>` |
| Modify | `src/gpt/gpt.types.ts` | Удалить неиспользуемый `TranslationMap` |
| Modify | `src/index.ts` | Добавить вызов `applyFallbackCleanup` |
| Modify | `package.json` | Добавить `vitest` и скрипт `test` |

---

## Task 1: Установить vitest и добавить скрипт `test`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Установить vitest как dev-зависимость**

```bash
cd D:/Project/smart-renamer && npm install -D vitest
```

Ожидаемый вывод: `added 1 package` (или несколько транзитивных зависимостей).

- [ ] **Step 2: Добавить скрипт `test` в package.json**

В `package.json` в секцию `"scripts"` добавить строку:

```json
"test": "vitest run"
```

Итоговая секция `scripts` должна выглядеть так:

```json
"scripts": {
  "dev": "tsx src/index.ts",
  "build": "rimraf dist && ncc build src/index.ts -o dist -m",
  "lint": "biome lint ./src",
  "format": "biome format --write ./src",
  "check": "biome check --write ./src",
  "reset-data": "rimraf data && copyfiles -u 1 \"data02/**/*\" data",
  "test": "vitest run"
},
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: добавить vitest"
```

---

## Task 2: Добавить глобальные паттерны JUNK_TOKENS_G и YEAR_G

**Files:**
- Modify: `src/helpers/patterns.ts`

Глобальные варианты нужны исключительно для `String.replace()` — никогда не использовать с `.test()` / `.exec()` (g-флаг меняет `lastIndex`).

- [ ] **Step 1: Добавить экспорты после существующих `JUNK_TOKENS` и `YEAR`**

В `src/helpers/patterns.ts` сразу после строки с `JUNK_TOKENS` добавить:

```typescript
/**
 * JUNK_TOKENS_G — глобальная версия для String.replace().
 * Не использовать с .test()/.exec() — g-флаг изменяет lastIndex между вызовами.
 */
export const JUNK_TOKENS_G =
  /\b(?:720p|1080p|2160p|4[Kk]|480p|360p|BDRip|BluRay|Blu-Ray|WEBRip|WEB-DL|HDRip|DVDRip|HDTV|x264|x265|H\.?264|H\.?265|AVC|HEVC|AAC|AC3|DTS|MP3|FLAC|HDR|SDR|10bit)\b|-[A-Z0-9]{2,10}$/gi;
```

Сразу после строки с `YEAR` добавить:

```typescript
/**
 * YEAR_G — глобальная версия для String.replace().
 * Не использовать с .test()/.exec() — g-флаг изменяет lastIndex между вызовами.
 */
export const YEAR_G = /[._( ]\d{4}[._) ]|\d{4}-\d{4}/g;
```

- [ ] **Step 2: Проверить lint**

```bash
npm run check
```

Ожидаемый вывод: `Checked N file(s) in Xms — no errors`

- [ ] **Step 3: Commit**

```bash
git add src/helpers/patterns.ts
git commit -m "feat: добавить JUNK_TOKENS_G и YEAR_G для replace()"
```

---

## Task 3: Реализовать cleanFallbackName (TDD)

**Files:**
- Create: `src/helpers/cleanup.test.ts`
- Create: `src/helpers/cleanup.ts`

### Алгоритм cleanFallbackName (порядок важен)

1. `JUNK_TOKENS_G` → `' '` — убрать кодеки, разрешение, release-группу в конце
2. `YEAR_G` → `' '` — убрать годы, включая диапазоны
3. `/[._]+/g` → `' '` — заменить разделители на пробел
4. `/\s{2,}/g` → `' '` — схлопнуть пробелы
5. `.trim()` — убрать граничные пробелы
6. `/^[-–\s]+/` → `''` — убрать ведущие дефисы
7. `/[-–\s]+$/` → `''` — убрать завершающие дефисы

### Трассировка примеров

| Вход | После JUNK | После YEAR | После [._] | Результат |
|---|---|---|---|---|
| `Breaking.Bad.S01.1080p.BluRay.x264-SiNNERS` | `Breaking.Bad.S01. . . ` | без изменений | `Breaking Bad S01` | `Breaking Bad S01` |
| `Слово пацана 1080p WEB-DL x265 Кровь на асфальте` | `Слово пацана    Кровь на асфальте` | без изменений | без изменений | `Слово пацана Кровь на асфальте` |
| `Sherlock.2010.S01E01.720p.BluRay` | `Sherlock.2010.S01E01. . ` | `Sherlock S01E01. . ` | `Sherlock S01E01` | `Sherlock S01E01` |
| `Naruto.2002-2007.HEVC` | `Naruto.2002-2007. ` | `Naruto.. ` | `Naruto` | `Naruto` |
| `Во все тяжкие` | без изменений | без изменений | без изменений | `Во все тяжкие` |

- [ ] **Step 1: Написать провальный тест**

Создать `src/helpers/cleanup.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { applyFallbackCleanup, cleanFallbackName } from './cleanup';

describe('cleanFallbackName', () => {
  it('strips codecs, resolution and release group from foreign title', () => {
    expect(cleanFallbackName('Breaking.Bad.S01.1080p.BluRay.x264-SiNNERS')).toBe(
      'Breaking Bad S01',
    );
  });

  it('strips junk tokens from Cyrillic name with spaces', () => {
    expect(
      cleanFallbackName('Слово пацана 1080p WEB-DL x265 Кровь на асфальте'),
    ).toBe('Слово пацана Кровь на асфальте');
  });

  it('strips year from dotted name', () => {
    expect(cleanFallbackName('Sherlock.2010.S01E01.720p.BluRay')).toBe('Sherlock S01E01');
  });

  it('strips year range', () => {
    expect(cleanFallbackName('Naruto.2002-2007.HEVC')).toBe('Naruto');
  });

  it('leaves already clean Cyrillic name unchanged', () => {
    expect(cleanFallbackName('Во все тяжкие')).toBe('Во все тяжкие');
  });
});

describe('applyFallbackCleanup', () => {
  it('adds cleaned fallback for entries without translation', () => {
    const entries = [
      { item: { path: '/a', originalName: 'Movie.1080p.BluRay' }, scenario: 'foreign' as const },
    ];
    const translations = new Map<string, string>();

    applyFallbackCleanup(entries, translations);

    expect(translations.get('/a')).toBe('Movie');
  });

  it('does not overwrite existing translation', () => {
    const entries = [
      { item: { path: '/b', originalName: 'Movie.1080p' }, scenario: 'foreign' as const },
    ];
    const translations = new Map<string, string>([['/b', 'Translated Title']]);

    applyFallbackCleanup(entries, translations);

    expect(translations.get('/b')).toBe('Translated Title');
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает с "Cannot find module"**

```bash
npm test
```

Ожидаемый вывод: `Error: Cannot find module './cleanup'` (или аналог).

- [ ] **Step 3: Создать src/helpers/cleanup.ts с реализацией**

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

- [ ] **Step 4: Запустить тест — убедиться, что все проходят**

```bash
npm test
```

Ожидаемый вывод:
```
✓ src/helpers/cleanup.test.ts (7)
  ✓ cleanFallbackName (5)
  ✓ applyFallbackCleanup (2)

Test Files  1 passed (1)
Tests       7 passed (7)
```

- [ ] **Step 5: Проверить lint**

```bash
npm run check
```

Ожидаемый вывод: `Checked N file(s) in Xms — no errors`

- [ ] **Step 6: Commit**

```bash
git add src/helpers/cleanup.ts src/helpers/cleanup.test.ts
git commit -m "feat: cleanFallbackName и applyFallbackCleanup"
```

---

## Task 4: Обновить типы, подключить applyFallbackCleanup в index.ts

**Files:**
- Modify: `src/gpt/gpt.service.ts:240`
- Modify: `src/gpt/gpt.types.ts:63-64`
- Modify: `src/index.ts`

### Проблема типов

`applyTranslations` сейчас возвращает `Promise<TranslationMap>`, где `TranslationMap = ReadonlyMap<string, string>`. `applyFallbackCleanup` принимает мутируемый `Map<string, string>`. Нужно сменить тип возврата — внутри `applyTranslations` уже создаётся мутируемый `Map`, просто возвращается как `ReadonlyMap`.

- [ ] **Step 1: Изменить return type applyTranslations в gpt.service.ts**

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

В `src/index.ts` добавить импорт:

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

- [ ] **Step 4: Проверить TypeScript-диагностику через IDE-инструмент или tsc**

```bash
npx tsc --noEmit
```

Ожидаемый вывод: нет ошибок.

- [ ] **Step 5: Проверить lint и тесты**

```bash
npm run check && npm test
```

Ожидаемый вывод:
- biome: `Checked N file(s) — no errors`
- vitest: `Tests 7 passed (7)`

- [ ] **Step 6: Commit**

```bash
git add src/gpt/gpt.service.ts src/gpt/gpt.types.ts src/index.ts
git commit -m "feat: подключить applyFallbackCleanup — очищать originalName при провале GPT"
```

---

## Итоговая проверка

После Task 4 убедиться:

1. `npm run build` завершается успешно — `dist/index.js` создаётся без ошибок
2. В логах при отключённом GPT (`YANDEX_AI_ENABLED=false`) не появляются имена с кодеками/годами в выводе переименований
