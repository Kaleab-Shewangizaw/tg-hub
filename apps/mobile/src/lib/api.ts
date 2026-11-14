import type { DashboardResponse, SettingsInput } from '@emberly/core';

/**
 * The mobile app talks to the web app's API. On a physical device,
 * "localhost" is the phone itself, so set EXPO_PUBLIC_API_URL to your
 * computer's LAN address (e.g. http://192.168.1.20:3000).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    throw new ApiError(`Can’t reach Emberly at ${API_URL}. Check your connection.`, 0);
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export type AuthResponse = { ok: true; token: string; user: { name: string; email: string } };

export const api = {
  signIn: (email: string, password: string) => request<AuthResponse>('/api/auth/sign-in', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signUp: (name: string, email: string, password: string, timeZone: string) =>
    request<AuthResponse>('/api/auth/sign-up', { method: 'POST', body: JSON.stringify({ name, email, password, timeZone }) }),
  signOut: (token: string) => request<{ ok: true }>('/api/auth/sign-out', { method: 'POST', token }),
  dashboard: (token: string) => request<DashboardResponse>('/api/me/dashboard', { token }),
  saveSettings: (token: string, settings: SettingsInput) => request<SettingsInput>('/api/me/settings', { method: 'PUT', token, body: JSON.stringify(settings) }),
};
