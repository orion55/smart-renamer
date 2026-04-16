// Коды ошибок, при которых повтор запроса бессмысленен (конфигурационные).
// context_limit_exceeded не ретраится callWithRetry, но обрабатывается сплитом в translateChunk.
export const NON_RETRYABLE_CODES = new Set([
  'model_call_error',
  'invalid_model_output',
  'context_limit_exceeded',
]);

// Исключение из правила «только arrow functions»: class необходим для корректного
// расширения Error (instanceof проверки). Factory-функция с дискриминантом потребовала бы
// замены всех instanceof GptSoftError и не даёт реальных преимуществ.
export class GptSoftError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'GptSoftError';
  }
}
