import type {
  ApiErrorCode,
  ApiFunctionName,
  ApiRequest,
  ApiResponse,
} from '@roami/shared';

/** The one error type screens need to handle. `code` says what went wrong. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/** One function per name in the contract. Real services implement this. */
export type ApiHandlers = {
  [K in ApiFunctionName]: (request: ApiRequest<K>) => Promise<ApiResponse<K>>;
};
