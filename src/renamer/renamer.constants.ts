/** S01E05, s01e05 */
export const SE_PATTERN = /[Ss](\d{1,2})[Ee](\d{1,2})/;

/** 1x05 */
export const SXE_PATTERN = /(\d{1,2})[xX](\d{2})/;

/** .0105. — 4-цифровой SSEE между разделителями */
export const FOUR_DIGIT_PATTERN = /[._](\d{2})(\d{2})[._]/;

/** 01 - Title, 02. Title — ведущий номер эпизода в начале имени файла */
export const LEADING_NUMBER_PATTERN = /^(\d{2})\s*[-–.]\s*/;

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
