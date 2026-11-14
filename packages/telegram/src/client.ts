/**
 * Minimal Bot API client over fetch. Server-side only: it needs the bot token.
 */

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly code: number,
    readonly description: string,
    readonly retryAfter: number | null,
  ) {
    super(`Telegram ${method} failed (${code}): ${description}`);
  }

  /** 429 (flood control) and 5xx are worth retrying; 400/403 are not. */
  get retryable(): boolean {
    return this.code === 429 || this.code >= 500;
  }
}

export interface TelegramClient {
  call<T>(method: string, params?: Record<string, unknown>): Promise<T>;
}

export function createTelegramClient(token: string, opts: { apiBase?: string; fetch?: typeof fetch } = {}): TelegramClient {
  const base = opts.apiBase ?? 'https://api.telegram.org';
  const doFetch = opts.fetch ?? fetch;
  return {
    async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
      let res: Response;
      try {
        res = await doFetch(`${base}/bot${token}/${method}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(params),
        });
      } catch (err) {
        throw new TelegramApiError(method, 599, err instanceof Error ? err.message : 'Network error', null);
      }
      const body = (await res.json().catch(() => null)) as
        | { ok: true; result: T }
        | { ok: false; error_code: number; description: string; parameters?: { retry_after?: number } }
        | null;
      if (!body) throw new TelegramApiError(method, res.status || 599, 'Invalid response from Telegram', null);
      if (!body.ok) throw new TelegramApiError(method, body.error_code, body.description, body.parameters?.retry_after ?? null);
      return body.result;
    },
  };
}
