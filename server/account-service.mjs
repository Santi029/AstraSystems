import { randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { DomainError } from './domain.mjs';
import { ACCOUNT_PROJECT } from './account-config.mjs';

const IDLE_MS = 30 * 60 * 1000, MAX_MS = 12 * 60 * 60 * 1000, PREAUTH_MS = 10 * 60 * 1000;
const random = () => randomBytes(32).toString('base64url');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const deny = (code, message, status = 401, details) => { throw new DomainError(code, message, status, details); };
const normalizedEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const objectBody = body => { if (!body || typeof body !== 'object' || Array.isArray(body)) deny('INVALID_INPUT', 'Provide a JSON object.', 400); };

export class AccountService {
  constructor(options = {}) {
    this.config = options.config ?? ACCOUNT_PROJECT;
    this.secureCookies = options.secureCookies === true;
    this.publicHosting = options.publicHosting === true;
    this.rateKey = randomBytes(32);
    this.sessions = new Map(); this.rate = new Map();
    this.clock = options.clock ?? Date.now; this.fetch = options.fetch ?? fetch;
    this.maxSessions = options.maxSessions ?? 1000; this.maxRateEntries = options.maxRateEntries ?? 1000;
    this.maxPreauth = options.maxPreauth ?? Math.max(1, Math.floor(this.maxSessions / 5));
    if (this.publicHosting && (this.maxSessions < 2 || this.maxPreauth < 1 || this.maxPreauth >= this.maxSessions)) throw new Error('Hosted session capacities must reserve active and preauth slots.');
    this.timeoutMs = options.timeoutMs ?? 12000; this.remoteTimeoutMs = options.remoteTimeoutMs ?? 15000;
    this.clientFactory = options.clientFactory ?? (() => createClient(this.config.url, this.config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (url, init) => this.fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs) }) },
    }));
  }
  get enabled() { return this.config.enabled === true; }
  cookieName(request) { return 'astra_session_' + String(request.socket.localPort || 'local'); }
  cookie(request) {
    const name = this.cookieName(request);
    const matches = String(request.headers.cookie || '').split(';').map(part => part.trim().split('=')).filter(([key]) => key === name);
    return matches.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(matches[0][1] || '') ? matches[0][1] : '';
  }
  setCookie(request, response, id, maxAge = 43200) {
    response.setHeader('Set-Cookie', this.cookieName(request) + '=' + id + '; HttpOnly; SameSite=Strict; Path=/api; Max-Age=' + maxAge + (this.secureCookies || request.socket.encrypted ? '; Secure' : ''));
  }
  expired(s) { const now = this.clock(); return now - s.created >= (s.kind === 'preauth' ? PREAUTH_MS : MAX_MS) || now - s.used >= IDLE_MS; }
  prune() {
    for (const [id, s] of this.sessions) if (this.expired(s)) this.sessions.delete(id);
    const now = this.clock();
    for (const [key, times] of this.rate) if (times.every(t => now - t >= 60000)) this.rate.delete(key);
  }
  session(request, touch = true) { this.prune(); const s = this.sessions.get(this.cookie(request)); if (s && touch) s.used = this.clock(); return s || null; }
  assertCurrent(s) {
    if (!s || this.sessions.get(s.id) !== s || this.expired(s)) {
      if (s && this.sessions.get(s.id) === s) this.sessions.delete(s.id);
      deny('SIGN_IN_REQUIRED', 'Your session ended. Sign in again.');
    }
    return s;
  }
  newSession(request, response, values = {}) {
    this.prune(); const existing = this.cookie(request);
    if (this.publicHosting) {
      const kind = values.kind || 'preauth';
      const peers = [...this.sessions.values()].filter(s => s.id !== existing && s.kind === kind);
      if (kind === 'active' && peers.length >= this.maxSessions - this.maxPreauth) deny('SESSION_CAPACITY', 'Sign-in capacity is temporarily full. Try again later.', 503);
      if (kind === 'preauth' && peers.length >= this.maxPreauth) {
        // Anonymous churn may replace only idle preauth, never active or in-flight authority.
        const oldest = peers.filter(s => !s.authInFlight).sort((a, b) => a.used - b.used)[0];
        if (!oldest) deny('SESSION_CAPACITY', 'Sign-in requests are busy. Try again shortly.', 503);
        this.sessions.delete(oldest.id);
      }
    }
    if (existing) this.sessions.delete(existing);
    if (this.sessions.size >= this.maxSessions) deny('SESSION_CAPACITY', 'Too many local sign-in sessions. Wait and try again.', 503);
    const now = this.clock(), id = random();
    const s = { ...values, id, created: now, used: now, csrf: random(), kind: values.kind || 'preauth' };
    this.sessions.set(id, s); this.setCookie(request, response, id); return s;
  }
  publicUser(user) { return user ? { id: user.id, email: user.email } : null; }
  publicStatus(s) { return { ok: true, mode: 'accounts', provider: 'supabase', configured: true, recoveryEnabled: this.config.recoveryEnabled === true, authenticated: s.kind === 'active', setupRequired: false, csrfToken: s.csrf, user: s.kind === 'active' ? this.publicUser(s.user) : null }; }
  assertEnabled() { if (!this.enabled) deny('AUTH_SETUP_REQUIRED', 'Secure account access is not configured.', 503); }
  requireCsrf(request) {
    const s = this.session(request, false);
    if (!s || !equal(request.headers['x-astra-csrf'], s.csrf)) deny('CSRF_REJECTED', 'Refresh the sign-in page and try again.', 403);
    s.used = this.clock(); return s;
  }
  limit(key) {
    // Hosted entrypoints apply scoped limits atomically before reaching this legacy limiter.
    if (this.publicHosting && ['signin', 'signup', 'activate', 'recover'].includes(key)) return;
    this.prune(); const now = this.clock(), items = (this.rate.get(key) || []).filter(t => now - t < 60000);
    if (items.length >= 8 || (!this.rate.has(key) && this.rate.size >= this.maxRateEntries)) deny('TOO_MANY_ATTEMPTS', 'Too many attempts. Wait one minute before trying again.', 429);
    this.rate.set(key, [...items, now]);
  }

  async hostedAttempt(request, body, operation) {
    if (!this.publicHosting) return operation();
    this.assertEnabled(); objectBody(body);
    const prior = this.requireCsrf(request);
    if (prior.authInFlight) deny('AUTH_IN_PROGRESS', 'A sign-in request is already in progress.', 409);
    const digest = createHmac('sha256', this.rateKey).update(normalizedEmail(body.email) || '<invalid>').digest('hex');
    const now = this.clock();
    const buckets = [['auth:all', 128], [`auth:session:${prior.id}`, 8], [`auth:account:${digest}`, 8]].map(([key, max]) => ({ key, max, times: (this.rate.get(key) || []).filter(t => now - t < 60000) }));
    // No failing account/session can spend the shared budget or allocate unlimited buckets.
    if (buckets.some(b => b.times.length >= b.max) || this.rate.size + buckets.filter(b => !this.rate.has(b.key)).length > this.maxRateEntries) deny('TOO_MANY_ATTEMPTS', 'Too many attempts. Wait one minute before trying again.', 429);
    for (const b of buckets) this.rate.set(b.key, [...b.times, now]);
    prior.authInFlight = true;
    try { return await operation(); } finally { delete prior.authInFlight; }
  }

  // Deadlines also bound injected SDKs. A lost write response is not proof of rollback.
  async bounded(operation, { mutation = false, timeoutMs = this.timeoutMs, code } = {}) {
    const controller = new AbortController();
    const failure = () => new DomainError(code || (mutation ? 'ACTION_OUTCOME_UNKNOWN' : 'BACKEND_UNAVAILABLE'), mutation ? 'The remote result could not be confirmed. Do not repeat the change automatically.' : 'The account service could not be reached. Try again later.', 503, mutation ? { uncertain: true, retryable: false } : {});
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => operation(controller.signal)),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(failure()); }, timeoutMs); }),
      ]);
    } catch (error) { if (error instanceof DomainError) throw error; throw failure(); }
    finally { clearTimeout(timer); }
  }
  async remote(token, route, body, beforeRequest = () => {}) {
    const mutation = route === 'action';
    return this.bounded(async signal => {
      beforeRequest();
      const response = await this.fetch(this.config.url + '/functions/v1/' + this.config.functionName + '/' + route, {
        method: mutation ? 'POST' : 'GET',
        headers: { apikey: this.config.publishableKey, Authorization: 'Bearer ' + token, ...(mutation ? { 'Content-Type': 'application/json' } : {}) },
        ...(mutation ? { body: JSON.stringify(body) } : {}), signal, redirect: 'error',
      });
      if (mutation && response.status >= 500) deny('ACTION_OUTCOME_UNKNOWN', 'The remote result could not be confirmed. Refresh before deciding whether to retry.', 503, { uncertain: true, retryable: false });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const code = typeof data?.error?.code === 'string' && /^[A-Z_]{1,64}$/.test(data.error.code) ? data.error.code : 'ACCOUNT_ACCESS_DENIED';
        throw new DomainError(code, 'The shared workspace rejected this request. Check your access and refresh before trying again.', response.status >= 400 && response.status <= 599 ? response.status : 403);
      }
      return data;
    }, { mutation, timeoutMs: this.remoteTimeoutMs });
  }
  async verifySession(providerSession) {
    if (typeof providerSession?.access_token !== 'string' || !providerSession.access_token || typeof providerSession.refresh_token !== 'string' || !providerSession.refresh_token) deny('SIGN_IN_FAILED', 'Unable to verify this account. Try signing in again.');
    const { data, error } = await this.bounded(() => this.clientFactory().auth.getUser(providerSession.access_token));
    if (error || !data?.user?.id || !data.user.email_confirmed_at) deny('SIGN_IN_FAILED', 'Sign-in requires a verified email account.');
    if (providerSession.user?.id && providerSession.user.id !== data.user.id) deny('SESSION_MISMATCH', 'Your session could not be verified.');
    await this.remote(providerSession.access_token, 'state');
    return { user: data.user, accessToken: providerSession.access_token, refreshToken: providerSession.refresh_token, expiresAt: Number.isFinite(providerSession.expires_at) ? providerSession.expires_at * 1000 : this.clock() + 300000, kind: 'active' };
  }
  async refresh(s) {
    try {
      const { data, error } = await this.bounded(() => this.clientFactory().auth.refreshSession({ refresh_token: s.refreshToken }));
      this.assertCurrent(s);
      if (error || !data?.session) deny('SIGN_IN_REQUIRED', 'Your session expired. Sign in again.');
      const verified = await this.verifySession(data.session); this.assertCurrent(s);
      if (verified.user.id !== s.user.id) deny('SESSION_MISMATCH', 'Your session could not be verified.');
      Object.assign(s, verified); return s;
    } catch (error) { if (this.sessions.get(s.id) === s) this.sessions.delete(s.id); throw error; }
  }
  async active(request) {
    this.assertEnabled(); const s = this.session(request);
    if (!s || s.kind !== 'active') deny('SIGN_IN_REQUIRED', 'Sign in to open your workspace.');
    if (s.expiresAt - this.clock() < 60000) {
      const pending = s.refreshPromise || (s.refreshPromise = this.refresh(s));
      try { await pending; } finally { if (s.refreshPromise === pending) delete s.refreshPromise; }
    }
    return this.assertCurrent(s);
  }
  async status(request, response) {
    this.assertEnabled(); let s = this.session(request);
    if (s?.kind === 'active') {
      try {
        s = await this.active(request);
        const { data, error } = await this.bounded(() => this.clientFactory().auth.getUser(s.accessToken));
        if (error || data?.user?.id !== s.user.id || !data.user.email_confirmed_at) deny('SIGN_IN_REQUIRED', 'Your session could not be verified.');
        await this.remote(s.accessToken, 'state'); this.assertCurrent(s);
      } catch (error) {
        if (!(error instanceof DomainError) || ![401, 403].includes(error.status)) throw error;
        // A stale response must not overwrite a later login/logout cookie.
        if (this.sessions.get(s.id) !== s) throw error;
        this.sessions.delete(s.id);
        s = null;
      }
    }
    if (!s) s = this.newSession(request, response);
    return this.publicStatus(s);
  }
  async signUp(request, response, body) { return this.hostedAttempt(request, body, () => this.signUpInternal(request, response, body)); }
  async signUpInternal(request, _response, body) {
    this.assertEnabled(); objectBody(body);
    const prior = this.requireCsrf(request);
    if (prior.kind === 'active') deny('SIGN_OUT_REQUIRED', 'Sign out before registering another account.', 409);
    if (prior.signupInFlight) deny('SIGN_UP_IN_PROGRESS', 'A registration request is already in progress. Wait for its result.', 409);
    this.limit('signup');
    const email = normalizedEmail(body.email);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) deny('INVALID_EMAIL', 'Enter a valid email address.', 400);
    if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 1024) deny('PASSWORD_REQUIREMENTS', 'Use a password of at least 12 characters.', 400);
    const accepted = () => ({
      ok: true, authenticated: false, verificationRequired: true,
      message: 'If registration is available for this address, check your inbox and spam folder for a verification email. Verify your email, then return to Astra and sign in. If you already verified this address, sign in instead.',
    });
    const uncertain = () => deny('SIGN_UP_OUTCOME_UNKNOWN', 'Registration could not be confirmed. Check your inbox and try signing in before submitting another registration.', 503, { uncertain: true, retryable: false });
    const client = this.clientFactory();
    prior.signupInFlight = true;
    try {
      // Send only user-entered credentials. No roles, metadata, redirect or app session.
      const { data, error } = await this.bounded(() => {
        this.assertCurrent(prior);
        return client.auth.signUp({ email, password: body.password });
      }, { mutation: true, code: 'SIGN_UP_OUTCOME_UNKNOWN' });
      this.assertCurrent(prior);
      if (error) {
        const code = error.code;
        // Existing-account responses must be indistinguishable from accepted registration.
        if (['user_already_exists', 'email_exists', 'identity_already_exists'].includes(code)) return accepted();
        if (error.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code)) deny('SIGN_UP_RATE_LIMITED', 'The account provider is limiting registration or verification emails. Wait before trying again; check for an email already sent.', 429, { retryable: false });
        if (['signup_disabled', 'email_provider_disabled'].includes(code)) deny('SIGN_UP_UNAVAILABLE', 'New account registration is unavailable. Sign in if you already have an account.', 503);
        if (code === 'weak_password') deny('PASSWORD_REQUIREMENTS', 'The account provider did not accept this password. Choose a stronger password of at least 12 characters.', 400);
        if (code === 'email_address_invalid' || code === 'email_address_not_valid') deny('INVALID_EMAIL', 'The account provider did not accept this email address.', 400);
        // Do not expose SMTP credentials, recipient restrictions, URLs or raw provider errors.
        if (code === 'email_address_not_authorized' || /smtp|sending (?:confirmation |verification )?email|email delivery/i.test(String(error.message || ''))) deny('SIGN_UP_EMAIL_UNAVAILABLE', 'The account provider could not deliver the verification email. Registration may be pending; contact the project administrator before trying again.', 503, { uncertain: true, retryable: false });
        if (!error.status || error.status >= 500 || error.status === 408 || error.name === 'AuthRetryableFetchError') uncertain();
        deny('SIGN_UP_REJECTED', 'The account provider could not accept this registration. Check the entered details or sign in if you already have an account.', 400);
      }
      if (data?.session) {
        // A changed provider setting must never silently turn registration into login.
        try { await this.bounded(() => client.auth.signOut({ scope: 'local' })); } catch { /* No application session or credentials are retained. */ }
        deny('SIGN_UP_CONFIRMATION_REQUIRED', 'The provider returned a sign-in session instead of requiring email verification. No Astra sign-in was created; the project administrator must check the verification settings.', 503);
      }
      if (!data?.user?.id) uncertain();
      return accepted();
    } finally { delete prior.signupInFlight; }
  }
  async signIn(request, response, body) { return this.hostedAttempt(request, body, () => this.signInInternal(request, response, body)); }
  async signInInternal(request, response, body) {
    this.assertEnabled(); objectBody(body); const prior = this.requireCsrf(request);
    if (prior.kind === 'active') deny('SIGN_OUT_REQUIRED', 'Sign out before signing into another account.', 409);
    this.limit('signin'); const email = normalizedEmail(body.email);
    if (!email || email.length > 254 || typeof body.password !== 'string' || !body.password || body.password.length > 1024) deny('SIGN_IN_FAILED', 'Check your email and password.');
    const { data, error } = await this.bounded(() => this.clientFactory().auth.signInWithPassword({ email, password: body.password }));
    this.assertCurrent(prior);
    if (error || !data?.session) deny('SIGN_IN_FAILED', 'Check your email and password, or use your invitation to set a password.');
    const verified = await this.verifySession(data.session); this.assertCurrent(prior);
    // The incoming request still has the OLD cookie. Do not call status(request) here.
    return this.publicStatus(this.newSession(request, response, verified));
  }
  async activate(request, response, body) { return this.hostedAttempt(request, body, () => this.activateInternal(request, response, body)); }
  async activateInternal(request, response, body) {
    this.assertEnabled(); objectBody(body); const prior = this.requireCsrf(request); this.limit('activate');
    if (prior.kind === 'active') deny('SIGN_OUT_REQUIRED', 'Sign out before accepting an invitation or resetting a password.', 409);
    if (!['invite', 'recovery'].includes(body.type) || typeof body.tokenHash !== 'string' || body.tokenHash.length < 16 || body.tokenHash.length > 1024) deny('INVALID_INVITATION', 'Use a fresh invitation or recovery link.');
    const email = normalizedEmail(body.email);
    if (!email || email.length > 254) deny('INVALID_EMAIL', 'Enter the email address that received this invitation.', 400);
    if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 1024) deny('PASSWORD_REQUIREMENTS', 'Use a password of at least 12 characters.', 400);
    const client = this.clientFactory();
    const { data, error } = await this.bounded(() => client.auth.verifyOtp({ token_hash: body.tokenHash, type: body.type }));
    this.assertCurrent(prior);
    if (error || !data?.session) deny('INVALID_INVITATION', 'This link could not be verified. It may have expired or already been used.');
    const verified = await this.verifySession(data.session); this.assertCurrent(prior);
    if (normalizedEmail(verified.user.email) !== email) deny('ACCOUNT_MISMATCH', 'The email does not match the verified invitation. Request a fresh link.');
    const result = await this.bounded(() => { this.assertCurrent(prior); return client.auth.updateUser({ password: body.password }); }, { mutation: true, code: 'PASSWORD_OUTCOME_UNKNOWN' });
    this.assertCurrent(prior);
    if (result.error) {
      if (!result.error.status || result.error.status >= 500) deny('PASSWORD_OUTCOME_UNKNOWN', 'The password change could not be confirmed. Try signing in before requesting another recovery link.', 503, { uncertain: true, retryable: false });
      deny('PASSWORD_UPDATE_FAILED', 'The password was not accepted. Request a new recovery link and try again.', 400);
    }
    if (result.data?.user?.id && result.data.user.id !== verified.user.id) deny('SESSION_MISMATCH', 'Your session could not be verified.');
    // Recheck membership after the password write. Never issue an app session beforehand.
    const confirmed = await this.verifySession(data.session); this.assertCurrent(prior);
    return this.publicStatus(this.newSession(request, response, confirmed));
  }
  async recover(request, response, body) { return this.hostedAttempt(request, body, () => this.recoverInternal(request, response, body)); }
  async recoverInternal(request, _response, body) {
    this.assertEnabled(); objectBody(body); const prior = this.requireCsrf(request);
    if (this.config.recoveryEnabled !== true) deny('RECOVERY_SETUP_REQUIRED', 'Password recovery is disabled until email delivery and the secure return link are verified.', 503);
    if (prior.recoveryInFlight) deny('RECOVERY_IN_PROGRESS', 'A recovery request is already in progress. Check your inbox before requesting another.', 409);
    this.limit('recover');
    const email = normalizedEmail(body.email);
    if (!email || email.length > 254) deny('INVALID_EMAIL', 'Enter your email address.', 400);
    const uncertain = () => deny('RECOVERY_OUTCOME_UNKNOWN', 'The recovery email request could not be confirmed. Check your inbox and spam folder before requesting another link.', 503, { uncertain: true, retryable: false });
    prior.recoveryInFlight = true;
    try {
      let result;
      try {
        result = await this.bounded(() => { this.assertCurrent(prior); return this.clientFactory().auth.resetPasswordForEmail(email, { redirectTo: this.config.activationUrl }); }, { mutation: true, code: 'RECOVERY_OUTCOME_UNKNOWN' });
      } catch (error) {
        if (error.code === 'RECOVERY_OUTCOME_UNKNOWN') uncertain();
        throw error;
      }
      if (!result || result.error && (!result.error.status || result.error.status >= 500 || result.error.status === 408)) uncertain();
      if (result.error?.status === 429) deny('RECOVERY_UNAVAILABLE', 'Recovery is temporarily rate limited. Wait before trying again; check for an email already sent.', 429);
      // Keep account-existence responses indistinguishable; never disclose raw provider errors.
      return { ok: true, message: 'If this address can sign in, a password reset email has been requested. Check your inbox.' };
    } finally { delete prior.recoveryInFlight; }
  }
  async signOut(request, response) {
    this.assertEnabled(); const s = this.requireCsrf(request);
    // Revoke before awaiting the provider so a late refresh cannot resurrect the session.
    this.sessions.delete(s.id);
    let next;
    try { next = this.newSession(request, response); }
    catch (error) {
      if (!this.publicHosting || error.code !== 'SESSION_CAPACITY') throw error;
      // Capacity must not prevent logout or skip provider token revocation.
      this.setCookie(request, response, '', 0);
      next = { kind: 'preauth', csrf: null };
    }
    let remoteSignedOut = false;
    if (s.kind === 'active') {
      try {
        // Avoid setSession, which can refresh while another refresh is already in flight.
        const result = await this.bounded(signal => this.fetch(this.config.url + '/auth/v1/logout?scope=local', {
          method: 'POST', headers: { apikey: this.config.publishableKey, Authorization: 'Bearer ' + s.accessToken }, signal, redirect: 'error',
        }));
        remoteSignedOut = result.ok === true;
      } catch { /* Local logout remains effective when the provider is unavailable. */ }
    }
    return { ...this.publicStatus(next), remoteSignedOut };
  }
  async state(request, url) {
    this.assertEnabled();
    if (url.searchParams.has('actorId')) deny('CLIENT_IDENTITY_REJECTED', 'Identity is determined by your verified session.', 403);
    const s = await this.active(request); const result = await this.remote(s.accessToken, 'state', undefined, () => this.assertCurrent(s)); this.assertCurrent(s); return result;
  }
  async receipt(request, requestId) {
    this.assertEnabled();
    if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) deny('INVALID_REQUEST_ID', 'Provide a valid request identifier.', 400);
    const s = await this.active(request);
    const result = await this.remote(s.accessToken, 'receipts/' + requestId, undefined, () => this.assertCurrent(s));
    this.assertCurrent(s);
    // A null receipt is not proof of absence while the original request is still running.
    return result;
  }
  async action(request, body) {
    this.assertEnabled(); objectBody(body); this.requireCsrf(request);
    if (['actorId', 'roles', 'capabilities', 'isAdmin'].some(key => key in body)) deny('CLIENT_IDENTITY_REJECTED', 'Permissions are determined by the server.', 403);
    const s = await this.active(request);
    // Edge rechecks current roles and owns mutation idempotency. Never retry here.
    const result = await this.remote(s.accessToken, 'action', body, () => this.assertCurrent(s));
    this.assertCurrent(s); // A logout/expiry during upstream work cannot report success to the ended session.
    return result;
  }
}
