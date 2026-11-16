/**
 * Runs once when the server starts. Starts the background worker (reminders,
 * Telegram polling) on the Node.js runtime only, and never during a build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;
  const { startBackground } = await import('./server/background');
  startBackground();
}
