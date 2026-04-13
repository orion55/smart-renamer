# Implementation Roadmap: smart-renamer

## Что уже готово (DONE)

> Последнее обновление: 2026-04-13 (GROUP 3 ✅)

| Файл | Статус | Примечания |
|---|---|---|
| `src/index.ts` | 🔶 PARTIAL | Баннер + сканер подключён; GROUP 4–7 — TODO-заглушки |
| `src/logger.service.ts` | ✅ DONE | Winston + DailyRotateFile, полностью работает |
| `src/helpers/greeting.ts` | ✅ DONE | cfonts баннер |
| `src/helpers/env.ts` | ✅ DONE | `resolveInDir()` — валидация `IN_DIR` из `.env` |
| `appDir.ts` | ✅ DONE | Экспорт `ROOT_DIR` |
| `tsconfig.json` | ✅ DONE | Strict CommonJS, ES2020 |
| `package.json` | ❓ | Наличие `openai` и `p-limit@^4` не проверено |
| `src/types.ts` | ✅ DONE | Все 4 интерфейса + вспомогательные типы (T1) |
| `src/helpers/patterns.ts` | ✅ DONE | Все 8 паттернов + VIDEO_EXTENSIONS, TRANSLIT_PATTERN, CYRILLIC, LATIN (T2) |
| `src/scanner/scanner.service.ts` | ✅ DONE | scanDirectory, scanFiles, getVideoFiles, deleteJunkFiles, flattenSubfolders, processFolders (T3) |

---

## Файлы, которые нельзя изменять

- `appDir.ts` — критичен для ncc-бандлинга
- `docs/renameSerial/renameSerial.ps1` — эталон бизнес-логики, только для чтения
- `tsconfig.json` — модульная система заблокирована на `commonjs` для ncc
- `.env` — конфиг среды выполнения, не исходный код

---

## Граф зависимостей

```
T0 (deps + .env)
  └─> T1 (types)
        └─> T2 (patterns)
              └─> T3 (scanner)
                    └─> T4 (classifier)
                          └─> T5 (gpt.service + prompt.builder + response.parser)
                                └─> T6 (renamer.service + conflict.resolver)
                                      └─> T7 (orchestrator в index.ts)
                                            └─> T8 (статистика + баннер)
                                                  └─> T9 (прогресс-бар) [P2]
```

---

## GROUP 0 — Инфраструктура

### T0-A: Установить npm зависимости
**Приоритет**: P0 | **Сложность**: Small

Добавить в `dependencies`:
- `openai` — OpenAI SDK как клиент Yandex Cloud (`baseURL` override)
- `p-limit@^4` — контроль конкурентности (⚠️ v5+ ESM-only, несовместим с `commonjs`)

```bash
npm install openai p-limit@^4
```

**Зависит от**: ничего

---

### T0-B: Дополнить .env.example
**Приоритет**: P0 | **Сложность**: Small

Добавить:
```env
YANDEX_API_KEY=        # API-ключ Yandex Cloud
IN_DIR=                # Входная директория (например f:\Сериалы)
```

`YANDEX_PROJECT_ID` и `YANDEX_PROMPT_ID` — **не нужны**: folder ID и prompt ID захардкожены в `gpt.service.ts`.

**Зависит от**: ничего

---

## GROUP 1 — Общие типы и паттерны

### T1: Типы данных
**Приоритет**: P0 | **Сложность**: Small
**Файл**: `src/types.ts` (новый)

```typescript
interface MediaFile {
  path: string;
  originalName: string;
  extension: string;
  type: 'series' | 'movie' | 'unknown';
  metadata?: { title?: string; season?: number; episode?: number; year?: number };
  newName?: string;
  status: 'pending' | 'processed' | 'skipped' | 'error';
}

interface MediaFolder {
  path: string;
  originalName: string;
  contentType: 'series' | 'movie' | 'unknown';
  files: MediaFile[];
  newName?: string;
}

interface GPTBatch {
  files: MediaFile[];
  prompt: string;
  response?: string;
}

interface ProcessingResult {
  total: number;
  renamed: number;
  skipped: number;
  errors: number;
  duration: number;
}
```

**Зависит от**: T0-A

---

### T2: Библиотека regex-паттернов
**Приоритет**: P0 | **Сложность**: Medium
**Файл**: `src/helpers/patterns.ts` (новый)

Категории паттернов:

| Константа | Описание | Пример |
|---|---|---|
| `EPISODE_MARKER` | S01E05, 1x05, .0105. | `S01E05`, `s01e05`, `1x05` |
| `SEASON_MARKER` | Маркеры сезона без эпизода | `S01`, `(Season 1)`, `(Сезон 1)`, `_1 sezon` |
| `YEAR` | Год в разных форматах | `(2024)`, `.2024.`, `_YYYY`, `YYYY-YYYY` |
| `JUNK_TOKENS` | Качество, кодеки, группы | `720p`, `x264`, `BDRip`, `-LOL` |
| `CLEAN_CYRILLIC_FOLDER` | Папка уже обработана | Только кириллица + пробелы |
| `NUMERIC_FILENAME` | Файл уже обработан | `05.mkv`, `0205.mkv` |
| `COLLECTION` | Коллекция фильмов | `Collection` в имени |
| `JUNK_EXTENSIONS` | Файлы для удаления | `.srt`, `.nfo`, `.txt`, `.jpg` |

**Зависит от**: T1

---

## GROUP 2 — Сканер

### T3: Scanner service
**Приоритет**: P0 | **Сложность**: Medium
**Файл**: `src/scanner/scanner.service.ts` (новый)

Методы:
- `scanDirectory(inDir)` — перечислить папки первого уровня в `IN_DIR`
- `scanFiles(inDir)` — перечислить loose видеофайлы прямо в `IN_DIR` (это фильмы)
- `getVideoFiles(folderPath)` — рекурсивно собрать все видеофайлы в папке (`.mkv`, `.avi`, `.mp4`, `.ts`)
- `deleteJunkFiles(folderPath)` — удалить `.srt`, `.nfo`, `.txt` и т.п., логировать каждое удаление
- `flattenSubfolders(folder)` — поднять все вложенные видеофайлы в корень папки, удалить пустые подпапки (R6)

**Зависит от**: T1, T2

---

## GROUP 3 — Классификатор

### T4: Classifier service
**Приоритет**: P0 | **Сложность**: Large
**Файл**: `src/classifier/classifier.service.ts` (новый)

**Основная функция**: `classify(name, videoFileCount): ContentType`

Дерево решений (R2 + решения #4, #8):
1. Есть `EPISODE_MARKER` → `'series'`
2. Есть `SEASON_MARKER` → `'series'`
3. Содержит `'Collection'` → `'movie'`
4. Есть `YEAR` (без season/episode маркера) → `'movie'`
5. Нет маркеров → по количеству видеофайлов:
   - `=== 1` → `'movie'` (поднять в IN_DIR, удалить папку)
   - `>= 2` → `'series'`
6. Иначе → `'unknown'` (залогировать)

**Вспомогательные функции**:
- `isAlreadyProcessed(name, isFolder)` — папка: strip season-маркеры → только кириллица → `true`; файл: `NUMERIC_FILENAME` → `true`
- `needsGPT(name)` — возвращает сценарий: `'foreign'` | `'translit'` | `'cleanRussian'` | `null`

**Зависит от**: T1, T2

---

## GROUP 4 — GPT интеграция

> **Статус инфраструктуры**: AI-агент полностью настроен на стороне Яндекс Облака.
> Системный промпт, правила и примеры уже зашиты в сохранённый промпт с ID `fvt96p8c9pf0412en1is`.
> Наша задача — только сформировать входные данные и разобрать ответ.

### T5-A: Prompt builder
**Приоритет**: P0 | **Сложность**: Small  *(упрощено: системный промпт уже на стороне агента)*
**Файл**: `src/gpt/prompt.builder.ts` (новый)

Агент ожидает в поле `input` JSON-строку — массив объектов с полями `type` и `name`.
Системный промпт на сервере уже содержит инструкции для каждого типа:
- `foreign` — перевести на официальное русское название (Кинопоиск), удалить мусор
- `translit` — восстановить кириллицу из транслитерации, удалить мусор
- `cleanRussian` — только удалить технический мусор из уже русского названия

`buildBatchInput(entries: Array<{ type: GPTScenario, name: string }>): string`
- Сериализует массив в `JSON.stringify` — это и есть `input` для `client.responses.create`
- Батч до 50 записей (решение #2)

Пример результата функции (это строка, которая идёт в `input`):
```json
[
  { "type": "foreign",      "name": "Breaking.Bad.S01E01.720p.BluRay.x264-SiNNERS" },
  { "type": "translit",     "name": "Brigada.S01.DVDRip" },
  { "type": "cleanRussian", "name": "Слово пацана 1080p WEB-DL x265 Кровь на асфальте" }
]
```

Агент вернёт `response.output_text` — JSON-массив строк, по одной на каждый вход:
```json
["Во все тяжкие", "Бригада", "Слово пацана. Кровь на асфальте"]
```

**Зависит от**: T1

---

### T5-B: Response parser
**Приоритет**: P0 | **Сложность**: Small
**Файл**: `src/gpt/response.parser.ts` (новый)

`parseResponse(rawText: string, inputCount: number): string[]`
- Входные данные — `response.output_text` из ответа агента
- Удалить markdown code fences (агент может обернуть ответ в ```json ... ```)
- Извлечь JSON-массив regex'ом, затем `JSON.parse`
- Проверить длину == `inputCount`
- При ошибке парсинга или несовпадении длины — вернуть массив `null` нужной длины

**Зависит от**: T1

---

### T5-C: GPT service
**Приоритет**: P0 | **Сложность**: Medium
**Файл**: `src/gpt/gpt.service.ts` (новый)

Интеграция с Yandex Cloud AI через OpenAI-совместимый SDK.
Агент и промпт уже настроены на стороне Яндекса — передаём только данные.

**Константы (hardcoded)**:
- `YANDEX_BASE_URL = 'https://ai.api.cloud.yandex.net/v1'`
- `YANDEX_FOLDER_ID = 'b1ge1vr81g330igour00'`  → заголовок `OpenAI-Project`
- `YANDEX_PROMPT_ID = 'fvt96p8c9pf0412en1is'`  → ID сохранённого промпта агента

**Пример вызова API**:
```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.YANDEX_API_KEY,
  baseURL: 'https://ai.api.cloud.yandex.net/v1',
  defaultHeaders: {
    'OpenAI-Project': 'b1ge1vr81g330igour00',
  },
});

const response = await client.responses.create({
  prompt: { id: 'fvt96p8c9pf0412en1is' },
  input: buildBatchInput(entries),   // JSON-строка от T5-A
});

const rawText = response.output_text; // строка → парсим через T5-B
```

**Структура сервиса**:
```typescript
const translateBatch = (entries: GptEntry[]): Promise<string[]>
const callWithRetry = (input: string, attempt: number): Promise<string>
```

- Конкурентность: `p-limit(3)` — максимум 3 параллельных запроса
- Retry: exponential backoff 1 с / 2 с / 4 с, максимум 3 попытки
- После исчерпания попыток: логировать ошибку, вернуть массив `null` нужной длины, продолжить

**Зависит от**: T0-A, T5-A, T5-B

---

## GROUP 5 — Переименователь

### T6-A: Conflict resolver
**Приоритет**: P0 | **Сложность**: Small
**Файл**: `src/renamer/conflict.resolver.ts` (новый)

`resolveConflict(targetPath, sourcePath): void`
- Если `targetPath` уже существует: удалить `sourcePath` (входящий дубликат), залогировать предупреждение (R7)
- Побеждает существующий файл

**Зависит от**: T1

---

### T6-B: Renamer service
**Приоритет**: P0 | **Сложность**: Large
**Файл**: `src/renamer/renamer.service.ts` (новый)

Методы:

**`renameEpisodeFiles(folder, translatedTitle)`** (R4):
- Сканировать все файлы → определить наличие нескольких сезонов
  - Один сезон → 2-цифровой формат (`05`)
  - Несколько сезонов (`S01` и `S02`) → 4-цифровой формат (`0205`)
- Обеспечить единообразие: все файлы в одном формате, смешение недопустимо
- Применить `conflict.resolver` при конфликтах

**`renameFolder(folder, translatedTitle)`** (R5):
- Переименовать папку в переведённое название

**`liftSingleMovie(folder, translatedTitle)`** (R6):
- 1 видеофайл → переместить в `IN_DIR` с именем `translatedTitle + extension`
- Удалить исходную папку

**`renameMovieFile(file, translatedTitle)`** (R4):
- Loose файл в корне `IN_DIR` → переименовать в `translatedTitle + extension`

**`renameMultipartFolder(folder, translatedTitle)`** (R6):
- 2+ файла без маркеров эпизодов → переименовать файлы в `01`, `02`, `03`... (сортировка по исходному имени)
- Переименовать папку в переведённое название

**`handleOrphanSeasonFolder(subfolder, parentFolder)`** (решение #6):
- `Сезон 2` / `Season 2` без родительского контекста → поднять содержимое в родительскую папку, удалить orphan

**Зависит от**: T1, T2, T6-A

---

## GROUP 6 — Оркестратор

### T7: Оркестрация в index.ts
**Приоритет**: P0 | **Сложность**: Large
**Файл**: `src/index.ts` (изменить существующий)

Порядок операций (решение #9: сначала R6, потом R5):

```
1. Загрузить и валидировать .env (IN_DIR, YANDEX_*)
2. Вывести баннер (уже сделано)
3. Залогировать старт + timestamp
4. scanner.scanDirectory(IN_DIR) → folders[]
5. Для каждой папки:
   a. scanner.deleteJunkFiles(folder)
   b. scanner.flattenSubfolders(folder)     ← сначала разворачиваем вложенность
   c. Обработать orphan season-подпапки
   d. Пересчитать видеофайлы → re-classify
6. scanner.scanFiles(IN_DIR) → looseFiles[]
7. classifier.classify() для каждой папки и loose файла
8. Разделить: нужен GPT vs уже обработано
9. Для требующих GPT:
   - Определить сценарий (foreign / translit / cleanRussian)
   - Сгруппировать в батчи по 50 по сценарию
   - gptService.translateBatch() с p-limit(3)
10. Применить переименования:
    a. liftSingleMovie или renameMultipartFolder (фильмы по содержимому)
    b. renameEpisodeFiles (серии)
    c. renameFolder (все папки)
    d. renameMovieFile (loose файлы)
11. statsTracker.printSummary()
12. Залогировать завершение
```

**Зависит от**: T3, T4, T5-C, T6-B, T8

---

## GROUP 7 — UX / Статистика

### T8: Статистика и итоговый вывод
**Приоритет**: P1 | **Сложность**: Small
**Файл**: `src/stats.ts` (новый)

```typescript
class StatsTracker {
  trackRenamed(): void
  trackSkipped(): void
  trackError(): void
  trackTotal(): void
  getSummary(startTime: Date): ProcessingResult
  printSummary(result: ProcessingResult): void
}
```

Также: обновить `src/helpers/greeting.ts` — добавить версию из `package.json` и дату запуска под cfonts-баннером (R12).

**Зависит от**: T1

---

### T9: Прогресс-бар
**Приоритет**: P2 | **Сложность**: Small
**Файл**: `src/helpers/progress.ts` (новый)

Зависимость: `cli-progress` (совместим с CommonJS).

Обернуть обработку GPT-батчей и цикл переименования прогресс-баром с текущим именем файла и процентом (R14).

**Зависит от**: T7

---

## Сводная таблица задач

| Задача | Файл | Приоритет | Сложность | Статус |
|---|---|---|---|---|
| T0-A | `package.json` | P0 | Small | ❓ не проверено |
| T0-B | `.env.example` | P0 | Small | ❓ не проверено |
| T1 | `src/types.ts` | P0 | Small | ✅ DONE |
| T2 | `src/helpers/patterns.ts` | P0 | Medium | ✅ DONE |
| T3 | `src/scanner/scanner.service.ts` | P0 | Medium | ✅ DONE |
| T4 | `src/classifier/classifier.service.ts` | P0 | Large | ✅ DONE |
| T5-A | `src/gpt/prompt.builder.ts` | P0 | Medium | ❌ TODO |
| T5-B | `src/gpt/response.parser.ts` | P0 | Small | ❌ TODO |
| T5-C | `src/gpt/gpt.service.ts` | P0 | Medium | ❌ TODO |
| T6-A | `src/renamer/conflict.resolver.ts` | P0 | Small | ❌ TODO |
| T6-B | `src/renamer/renamer.service.ts` | P0 | Large | ❌ TODO |
| T7 | `src/index.ts` | P0 | Large | 🔶 PARTIAL |
| T8 | `src/stats.ts` | P1 | Small | ❌ TODO |
| T9 | `src/helpers/progress.ts` | P2 | Small | ❌ TODO |

---

## Риски

| # | Риск | Серьёзность |
|---|---|---|
| R1 | `p-limit` v5+ ESM-only — нужен `p-limit@^4` | Высокая |
| R2 | `openai` SDK: проверить поддержку `responses.create` vs `chat.completions.create` | Средняя |
| R3 | Windows-пути с кириллицей (`f:\Сериалы`) — использовать `node:path` | Средняя |
| R4 | Переименование папки пока её содержимое обрабатывается — папка переименовывается последней | Средняя |
| R5 | Конфликт при подъёме фильма: файл с таким именем уже есть в `IN_DIR` | Средняя |
| R6 | Единообразие 2/4 цифр: формат определять до начала переименования, не в процессе | Средняя |
| R7 | GPT недетерминирован: парсер должен быть устойчив к markdown-обёрткам вокруг JSON | Низкая |
| R8 | `YANDEX_PROMPT_ID` захардкожен (`fvt96p8c9pf0412en1is`); fallback не нужен — агент настроен на стороне Яндекса | Снят |
