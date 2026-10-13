export class DomainError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;
  constructor(code: string, status = 409, details: Record<string, unknown> = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function require(condition: unknown, code = 'INVALID_STATE_TRANSITION', status = 409, details?: Record<string, unknown>): asserts condition {
  if (!condition) throw new DomainError(code, status, details);
}
