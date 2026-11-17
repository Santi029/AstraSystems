// Hosted mode is explicit. Forwarded headers never select authority or cookie security.
export function hostingConfig({ publicOrigin = '', production, authMode }) {
  if (!publicOrigin) return { hosted: false, bind: '127.0.0.1' };
  let parsed;
  try { parsed = new URL(publicOrigin); } catch { throw new Error('ASTRA_PUBLIC_ORIGIN must be a canonical HTTPS origin.'); }
  if (parsed.protocol !== 'https:' || parsed.origin !== publicOrigin || parsed.username || parsed.password || !parsed.hostname.includes('.') || parsed.hostname === '127.0.0.1') {
    throw new Error('ASTRA_PUBLIC_ORIGIN must be a canonical HTTPS origin without path, credentials or trailing slash.');
  }
  if (!production || authMode !== 'accounts') throw new Error('Hosted mode requires production and accounts authentication.');
  return { hosted: true, bind: '0.0.0.0', origin: parsed.origin, host: parsed.host, activationUrl: `${parsed.origin}/auth/confirm` };
}
