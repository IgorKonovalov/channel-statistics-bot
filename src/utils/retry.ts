import { logger } from '../logger';

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Network errors
  if ('code' in error) {
    const code = (error as { code: string }).code;
    if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH'].includes(code)) return true;
  }

  // Telegram 429 rate limit
  if ('response' in error) {
    const status = (error as { response: { status?: number } }).response?.status;
    if (status === 429) return true;
  }

  return false;
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (
    error instanceof Error &&
    'response' in error &&
    typeof (error as Record<string, unknown>).response === 'object'
  ) {
    const params = (error as { parameters?: { retry_after?: number } }).parameters;
    if (params?.retry_after) return params.retry_after * 1000;
  }
  return undefined;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000 } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !isTransient(error)) {
        throw error;
      }

      const retryAfter = getRetryAfterMs(error);
      const delay = retryAfter ?? baseDelayMs * 2 ** attempt;
      logger.warn({ attempt: attempt + 1, maxRetries, delay, label }, 'Retrying after error');
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // unreachable, but satisfies TypeScript
  throw new Error('Retry exhausted');
}
