export type QdipErrorCode =
  | 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_REQUEST' | 'RATE_LIMITED'
  | 'WORKER_UNAVAILABLE' | 'GATEWAY_TIMEOUT' | 'HTTP_ERROR'
  | 'TRANSPORT_ERROR' | 'ABORTED' | 'DEADLINE_EXCEEDED'
  | 'INVALID_RESPONSE' | 'INCOMPATIBLE_VERSION' | 'CONFIGURATION_ERROR';

export class QdipError extends Error {
  override name = 'QdipError';
  readonly code: QdipErrorCode;
  readonly httpStatus?: number;
  readonly retryAfter?: string;
  readonly diagnosticId?: string;
  constructor(code: QdipErrorCode, options: { httpStatus?: number; retryAfter?: string; diagnosticId?: string } = {}) {
    // Fixed safe messages: never include untrusted HTTP body, URL, token or input.
    super({
      UNAUTHORIZED: 'QDIP authentication failed', FORBIDDEN: 'QDIP authorization denied',
      INVALID_REQUEST: 'QDIP rejected the request', RATE_LIMITED: 'QDIP rate limit exceeded',
      WORKER_UNAVAILABLE: 'QDIP worker unavailable', GATEWAY_TIMEOUT: 'QDIP gateway timed out',
      HTTP_ERROR: 'QDIP HTTP request failed', TRANSPORT_ERROR: 'QDIP transport failed',
      ABORTED: 'QDIP request was aborted', DEADLINE_EXCEEDED: 'QDIP request deadline exceeded',
      INVALID_RESPONSE: 'QDIP returned an inconsistent or incomplete response',
      INCOMPATIBLE_VERSION: 'QDIP response uses an unsupported contract version',
      CONFIGURATION_ERROR: 'Invalid QDIP client configuration'
    }[code]);
    this.code = code;
    this.httpStatus = options.httpStatus;
    this.retryAfter = options.retryAfter;
    this.diagnosticId = options.diagnosticId;
  }
}
