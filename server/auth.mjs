/**
 * Account boundary only. This module does not authenticate a user, exchange
 * credentials, connect to Supabase, or turn an email/cookie into a principal.
 */
export function resolveAuthMode(value = 'accounts') {
  if (!['accounts', 'demo'].includes(value)) throw new Error('ASTRA_AUTH_MODE must be accounts or demo. Refusing an implicit demo fallback.');
  return value;
}

export function authStatus(mode) {
  resolveAuthMode(mode);
  return {
    ok: true,
    mode,
    configured: mode === 'demo',
    authenticated: false,
    provider: mode === 'demo' ? 'simulation' : 'supabase',
    setupRequired: mode === 'accounts',
  };
}

export const AUTH_SETUP_MESSAGE = 'Account access is not configured. A dedicated Supabase project, verified identity, approved roles and trusted shared backend are required. No synthetic persona grants account access.';
