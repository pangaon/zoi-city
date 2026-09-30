export type DraftStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
export class DraftStore {
  private pending = new Map<string, Promise<void>>();
  private storage: DraftStorage;
  private currentUser: () => string | undefined;
  constructor(storage: DraftStorage, currentUser: () => string | undefined) { this.storage = storage; this.currentUser = currentUser; }
  async load(userId: string) { await this.pending.get(userId)?.catch(() => {}); return this.storage.getItem('zoi.draft.' + userId); }
  private queue(userId: string, operation: () => Promise<void>) {
    const next = (this.pending.get(userId) || Promise.resolve()).catch(() => {}).then(operation);
    this.pending.set(userId, next);
    return next;
  }
  save(userId: string, body: string) { return this.queue(userId, async () => { if (this.currentUser() === userId) await this.storage.setItem('zoi.draft.' + userId, body); }); }
  clear(userId: string) { return this.queue(userId, () => this.storage.removeItem('zoi.draft.' + userId)); }
}
export function validPostReceipt(value: unknown): value is { ok: true; id: string } {
  return !!value && typeof value === 'object' && (value as any).ok === true && typeof (value as any).id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((value as any).id);
}
