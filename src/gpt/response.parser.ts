import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';
import { logger } from '../logger.service';

const responseSchema = z.array(z.string().nullable());

const nullArray = (length: number): null[] => new Array<null>(length).fill(null);

/**
 * Разобрать ответ агента в массив строк.
 *
 * Конвейер обработки:
 * 1. Удалить markdown code fences (агент может обернуть ответ в ```json...```)
 * 2. Извлечь фрагмент с JSON-массивом regex'ом
 * 3. jsonrepair — починить обрезанный/битый JSON
 * 4. JSON.parse → валидация схемы через zod
 * 5. Проверить длину == inputCount
 *
 * При любой ошибке возвращает массив null нужной длины.
 */
export const parseResponse = (rawText: string, inputCount: number): (string | null)[] => {
  const stripped = rawText
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  const jsonMatch = stripped.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    logger.warn('parseResponse: no JSON array found in GPT response');
    return nullArray(inputCount);
  }

  let parsed: unknown;
  try {
    const repaired = jsonrepair(jsonMatch[0]);
    parsed = JSON.parse(repaired);
  } catch (error) {
    logger.error('parseResponse: failed to repair/parse JSON', { error });
    return nullArray(inputCount);
  }

  const validation = responseSchema.safeParse(parsed);
  if (!validation.success) {
    logger.warn('parseResponse: schema validation failed', { issues: validation.error.issues });
    return nullArray(inputCount);
  }

  if (validation.data.length !== inputCount) {
    logger.warn(
      `parseResponse: length mismatch — expected ${inputCount}, got ${validation.data.length}`,
    );
    return nullArray(inputCount);
  }

  return validation.data;
};
