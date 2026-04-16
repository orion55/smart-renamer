/** S01E05, S01.E05, S01_E05, s01-e05 */
export const SE_PATTERN = /[Ss](\d{1,2})[\s._-]*[Ee](\d{1,2})/;

/** 1x05 */
export const SXE_PATTERN = /(\d{1,2})[xX](\d{2})/;

/** 6.01, 6_01, 6-01, including technical tails like 6.01.1001cinema */
export const DOT_SEASON_EPISODE_PATTERN = /(?:^|[^\d])(\d{1,2})[._-](\d{2})(?=$|[._-]|[^\d])/;

/** 0105, 0701, 1001 — 4-цифровой SSEE как отдельный числовой блок */
export const FOUR_DIGIT_PATTERN = /(?:^|[^\d])(\d{2})(\d{2})(?=$|[^\d])/;

/** 01 - Title, 02. Title — ведущий номер эпизода в начале имени файла */
export const LEADING_NUMBER_PATTERN = /^(\d{2})\s*[-–.]\s*/;

/** ep01, ep.01 */
export const EP_PATTERN = /\bep[._\s-]?(\d{1,2})\b/i;

/** s.1_ep.01, s1ep01 */
export const SEASON_EPISODE_PATTERN = /[Ss][._\s-]?(\d{1,2})[._\s-]*(?:ep|[Ee])[._\s-]?(\d{1,2})/;

/** (1.sezon.01.seriya.iz.11) — транслитерация с указанием сезона и серии */
export const SEZON_SERIYA_PATTERN = /(\d{1,2})\.sezon\.(\d{1,2})\.seriy/i;

/** Title-2 (01 сер.) */
export const SUFFIX_SEASON_RUS_EPISODE_PATTERN =
  /-(\d{1,2})\s*\(\s*(\d{1,2})\s*сер(?:ия)?\.?\s*\)/i;

/** (01 ser.), 01 ser., 01 серия */
export const RUS_EPISODE_PATTERN = /(?:^|[\s([._-])(\d{1,2})\s*(?:сер(?:ия)?\.?)(?:$|[\s)._\]-])/i;

/** Title 1.WEB-DLRip, Title 7 */
export const TRAILING_NUMBER_PATTERN = /(?:^|[^\d])(\d{1,2})(?=[^\d]*$)/;

/** Joseph.Balsamo.S1 */
export const TRAILING_S_NUMBER_PATTERN = /(?:^|[._\s-])[Ss](\d{1,2})(?:$|[._\s-])/;

export const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

export const WINDOWS_INVALID_FILE_CHARS_PATTERN = /[<>:"/\\|?*]/g;
export const WINDOWS_TRAILING_DOTS_AND_SPACES_PATTERN = /[. ]+$/g;
export const WINDOWS_MAX_CONTROL_CHAR_CODE = 31;
