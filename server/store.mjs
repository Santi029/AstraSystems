import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { applyAction, createInitialState, DomainError, viewState } from './domain.mjs';

/** One-process evaluation store. Atomic replace precedes every success receipt. */
export class LocalStore {
  constructor(directory, initialState, options = {}) {
    this.directory = directory; this.file = path.join(directory, 'astra-state.json');
    this.state = initialState; this.queue = Promise.resolve(); this.failNextSave = false;
    this.persistHook = options.persistHook;
  }
  static async open(directory, options = {}) {
    await mkdir(directory, { recursive: true });
    let state; let isNew = false;
    try {
      state = JSON.parse(await readFile(path.join(directory, 'astra-state.json'), 'utf8'));
      if (state.schemaVersion !== 1 || !Array.isArray(state.projects) || !Array.isArray(state.actors) || !Array.isArray(state._providerReceipts)) throw new Error('Unsupported or damaged state schema.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Cannot load Astra state; existing data was not replaced: ${error.message}`);
      state = createInitialState(); isNew = true;
    }
    const store = new LocalStore(directory, state, options);
    if (isNew) await store.persist(state);
    return store;
  }
  view(actorId) { return { ...viewState(this.state, actorId), demoControls: { failNextSave: this.failNextSave } }; }
  async persist(state) {
    if (this.persistHook) await this.persistHook(state);
    const temporary = path.join(this.directory, `.astra-${randomUUID()}.tmp`);
    let handle;
    try {
      handle = await open(temporary, 'wx', 0o600);
      await handle.writeFile(JSON.stringify(state, null, 2), 'utf8'); await handle.sync(); await handle.close(); handle = null;
      await rename(temporary, this.file);
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      await unlink(temporary).catch(() => {}); throw error;
    }
  }
  dispatch(action) {
    const next = this.queue.then(async () => {
      const actorId = action?.actorId ?? 'admin';
      viewState(this.state, actorId); // Reject unknown personas even for demo controls.
      if (action?.type === 'injectFailure') {
        if (actorId !== 'admin') throw new DomainError('ADMIN_REQUIRED', 'Only the demo Admin can inject persistence failures.', 403);
        this.failNextSave = action.enabled !== false;
        return { ok: true, state: this.view(actorId), result: { message: this.failNextSave ? 'The next valid save will fail without changing state.' : 'Failure injection cleared.' } };
      }
      const transition = applyAction(this.state, action);
      if (this.failNextSave) {
        this.failNextSave = false;
        throw new DomainError('SAVE_FAILED', 'Simulated save failure. Previous state is intact; your entered text should remain available.', 503, { retryable: true });
      }
      try { await this.persist(transition.state); }
      catch { throw new DomainError('SAVE_FAILED', 'The state could not be saved. No success was recorded. Keep your input and retry.', 503, { retryable: true }); }
      this.state = transition.state;
      return { ok: true, state: this.view(actorId), result: transition.result };
    });
    this.queue = next.catch(() => {}); return next;
  }
}
