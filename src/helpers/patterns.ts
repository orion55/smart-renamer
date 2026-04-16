/**
 * EPISODE_MARKER — маркеры серии с сезоном: S01E05, s01e05, 1x05, .0105., _0105_
 * Источник: renameSerial.ps1, numberRange = "['s','S'](\d{2})['e','E'](\d{2})"
 */
export const EPISODE_MARKER = /[Ss]\d{1,2}[Ee]\d{1,2}|\d{1,2}[xX]\d{2}|[._]\d{2}\d{2}[._]/;

/**
 * SEASON_MARKER — маркеры сезона без номера эпизода.
 * Покрывает: S01, .S01., _S01_, (Season 1), (Сезон 1), _1 sezon, Сезон.1, (1-2.sezoni)
 */
export const SEASON_MARKER =
  /[._\s]?[Ss]eason\s*\d{1,2}|[._\s]?[Сс]езон\s*\d{1,2}|[._\s]?\d{1,2}\s*sezon\b|\(\d{1,2}-\d{1,2}\.sezoni?\)|[._\s]?[Ss]\d{1,2}(?![Ee]\d)/i;

/**
 * Глобальные версии маркеров для использования в String.replace() — ТОЛЬКО для replace().
 * Не использовать с .test()/.exec() — g-флаг изменяет lastIndex между вызовами.
 */
export const SEASON_MARKER_GI =
  /[._\s]?[Ss]eason\s*\d{1,2}|[._\s]?[Сс]езон\s*\d{1,2}|[._\s]?\d{1,2}\s*sezon\b|\(\d{1,2}-\d{1,2}\.sezoni?\)|[._\s]?[Ss]\d{1,2}(?![Ee]\d)/gi;
export const EPISODE_MARKER_G = /[Ss]\d{1,2}[Ee]\d{1,2}|\d{1,2}[xX]\d{2}|[._]\d{2}\d{2}[._]/g;

/**
 * YEAR — год в типичных форматах для медиафайлов: (2024), .2024., _2024, 2024-2025
 * Источник: renameSerial.ps1, year = "['.','_','(', ' ']\d{4}['.','_',')',' ']"
 */
export const YEAR = /[._( ]\d{4}[._) ]|\d{4}-\d{4}/;

/**
 * JUNK_TOKENS — технический мусор: разрешение, кодек, рипер, релиз-группы.
 * Используется для очистки имён перед отправкой в GPT и для определения сценария.
 */
export const JUNK_TOKENS =
  /\b(?:720p|1080p|2160p|4[Kk]|480p|360p|BDRip|BluRay|Blu-Ray|WEBRip|WEB-DL|HDRip|DVDRip|HDTV|x264|x265|H\.?264|H\.?265|AVC|HEVC|AAC|AC3|DTS|MP3|FLAC|HDR|SDR|10bit)\b|-[A-Z0-9]{2,10}$/i;

/**
 * CLEAN_CYRILLIC_FOLDER — папка уже обработана, если содержит только кириллицу,
 * цифры и пробелы (без латиницы и технических токенов).
 */
export const CLEAN_CYRILLIC_FOLDER = /^[\u0400-\u04FF0-9\s\-.,!?'"()]+$/;

/**
 * NUMERIC_FILENAME — файл уже переименован: 05.mkv, 0205.mkv (2 или 4 цифры).
 * Источник: логика PS1 — результат rename выглядит как "05" или "0205".
 */
export const NUMERIC_FILENAME = /^\d{2}(\d{2})?$/;

/**
 * COLLECTION — папка является коллекцией фильмов.
 */
export const COLLECTION = /\b(?:Collection|Коллекция)\b/i;

/**
 * JUNK_EXTENSIONS — расширения файлов, подлежащих удалению.
 * Источник: PS1 — удаляет .srt файлы; расширяем до полного списка мусора.
 */
export const JUNK_EXTENSIONS = new Set([
  '.srt',
  '.nfo',
  '.txt',
  '.jpg',
  '.jpeg',
  '.png',
  '.nzb',
  '.url',
  '.!qb',
  '.ac3',
]);

/**
 * VIDEO_EXTENSIONS — допустимые видеоформаты.
 * Источник: renameSerial.ps1, aviFormats = @("*.mkv","*.avi","*.mp4","*.ts")
 */
export const VIDEO_EXTENSIONS = new Set(['.mkv', '.avi', '.mp4', '.ts']);

/**
 * TRANSLIT_PATTERN — латинские символы, характерные для русской транслитерации.
 * Признаки: сочетания sh, ch, zh, ya, yu, yo, ts, «y» после согласных.
 */
export const TRANSLIT_PATTERN = /\b[a-z]*(?:sh|ch|zh|ya|yu|yo|ts|sch)[a-z]*\b/i;

/**
 * CYRILLIC — строка содержит хотя бы один кириллический символ.
 */
export const CYRILLIC = /[\u0400-\u04FF]/;

/**
 * LATIN — строка содержит хотя бы один латинский символ.
 */
export const LATIN = /[A-Za-z]/;
