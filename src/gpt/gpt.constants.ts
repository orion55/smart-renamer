export const YANDEX_BASE_URL = 'https://ai.api.cloud.yandex.net/v1';
export const YANDEX_FOLDER_ID = 'b1ge1vr81g330igour00';
export const YANDEX_PROMPT_ID = 'fvt96p8c9pf0412en1is';

export const CONTEXT_LIMIT_MESSAGE = 'maximum text generation size';
export const INPUT_TOKENS_LIMIT_PATTERN = /number of input tokens must be no more than \d+, got \d+/i;

export const BATCH_SIZE = 50;
export const MAX_BATCH_CHARS = 30_000;
// Лимит генерации ответа: JSON-массив из 10 переводов обычно короткий, запас оставляем большим.
export const MAX_OUTPUT_TOKENS = 8_000;
export const MAX_RETRIES = 3;
export const CONCURRENCY = 3;
