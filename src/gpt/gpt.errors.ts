// Коды ошибок, при которых повтор запроса бессмысленен (конфигурационные)
export const NON_RETRYABLE_CODES = new Set(['model_call_error']);

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
