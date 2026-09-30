export const BASE = 'https://csebihpaychdkanjjsmz.supabase.co';
export const PUBLIC_KEY = 'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j';
export type Session = { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email?: string } };
export type Vault = { read(): Promise<string | null>; write(value: string): Promise<void>; clear(): Promise<void> };
export class ApiError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } }
export class SessionClient {
  session: Session | null = null;
  private refreshing: Promise<Session> | null = null;
  private generation = 0;
  private vault: Vault;
  private transport: typeof fetch;
  onChange: (session: Session | null) => void = () => {};
  constructor(vault: Vault, transport: typeof fetch = fetch) { this.vault = vault; this.transport = transport.bind(globalThis); }
  async request(path: string, body?: unknown, token?: string, method = 'POST') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await this.transport(BASE + path, { method, signal: controller.signal, headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const known = String(data?.message || data?.error_description || '');
        const operationsError = /slot_version_conflict/.test(known) ? 'This appointment time or price changed. Refresh availability and review it before booking.' : /invalid_sector/.test(known) ? 'Choose a business sector before saving.' : /slot_unavailable|booking_unavailable/.test(known) ? 'This booking time is no longer available. Refresh availability.' : /party_exceeds_capacity/.test(known) ? 'The party size exceeds this slot’s capacity.' : /booking_already_started|booking_status_final/.test(known) ? 'This booking can no longer be changed.' : /seat_inventory_not_enabled/.test(known) ? 'Named-seat booking is not enabled yet.' : /seats_unavailable/.test(known) ? 'Those seats are no longer available. Refresh and choose again.' : /hold_expired|hold_no_longer_active/.test(known) ? 'This seat hold is no longer active. Refresh your reservations.' : /release_existing_hold_first/.test(known) ? 'You already have a hold. Refresh reservations to restore it.' : /free_tier_required/.test(known) ? 'This booking flow supports free tickets only.' : /choose_seats_for_this_event/.test(known) ? 'Choose named seats for this event before reserving.' : /checked_in/.test(known) ? 'A checked-in reservation cannot be cancelled.' : /version_conflict/.test(known) ? 'This record changed elsewhere. Reload records and reopen it before saving.' : /cross_workspace_link/.test(known) ? 'Linked records must belong to this workspace.' : /insufficient_permission|not_authorized/.test(known) ? 'Your workspace role does not allow this action.' : /invalid_record/.test(known) ? 'Check the record fields and try again.' : '';
        if (operationsError) throw new ApiError(operationsError, response.status);
        throw new ApiError(response.status === 429 ? 'Too many attempts. Please wait before trying again.' : response.status === 400 || response.status === 401 || response.status === 403 ? 'Your sign-in details were not accepted. Please check them and try again.' : 'The service is unavailable. Please try again.', response.status);
      }
      if (data && typeof data === 'object' && (data.error || data.ok === false)) throw new ApiError('The request could not be completed. Please try again.', 400);
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Connection interrupted. Check your connection and try again.', 0);
    } finally { clearTimeout(timer); }
  }
  private async accept(data: any, generation: number) {
    if (!data?.access_token || !data?.refresh_token || !data?.user?.id) throw new ApiError('Sign-in did not return a valid session.', 401);
    if (generation !== this.generation) throw new ApiError('Sign-in was cancelled.', 401);
    const session: Session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600), user: { id: data.user.id, email: data.user.email } };
    // Store only the refresh credential. Access tokens remain in memory.
    await this.vault.write(JSON.stringify({ refresh_token: session.refresh_token }));
    if (generation !== this.generation) { await this.vault.clear(); throw new ApiError('Sign-in was cancelled.', 401); }
    this.session = session; this.onChange(session); return session;
  }
  async restore() {
    const stored = await this.vault.read();
    if (!stored) return null;
    let token: string;
    try { token = JSON.parse(stored).refresh_token; if (!token) throw new Error(); } catch { await this.vault.clear(); return null; }
    return this.refresh(token);
  }
  async refresh(token = this.session?.refresh_token) {
    if (this.refreshing) return this.refreshing;
    if (!token) throw new ApiError('Please sign in to continue.', 401);
    const generation = this.generation;
    this.refreshing = (async () => {
      try { return await this.accept(await this.request('/auth/v1/token?grant_type=refresh_token', { refresh_token: token }), generation); }
      catch (error) { if (generation === this.generation && error instanceof ApiError && (error.status === 400 || error.status === 401 || error.status === 403)) { this.session = null; await this.vault.clear(); this.onChange(null); } throw error; }
      finally { this.refreshing = null; }
    })();
    return this.refreshing;
  }
  async token() {
    if (!this.session) throw new ApiError('Please sign in to continue.', 401);
    if (this.session.expires_at * 1000 <= Date.now() + 60000) await this.refresh();
    return this.session!.access_token;
  }
  async sendCode(email: string) { return this.request('/auth/v1/otp', { email, create_user: true }); }
  async verifyCode(email: string, code: string) { const generation = this.generation; return this.accept(await this.request('/auth/v1/verify', { type: 'email', email, token: code }), generation); }
  async password(email: string, password: string) { const generation = this.generation; return this.accept(await this.request('/auth/v1/token?grant_type=password', { email, password }), generation); }
  async rpc(name: string, body: unknown) {
    const token = await this.token();
    try { return await this.request('/rest/v1/rpc/' + name, body, token); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401 && this.session?.access_token === token) {
        this.generation++; this.session = null; this.onChange(null); await this.vault.clear();
        throw new ApiError('Your session ended. Please sign in again.', 401);
      }
      throw error;
    }
  }
  async signOut() {
    const token = this.session?.access_token;
    this.generation++;
    this.session = null; this.onChange(null);
    await this.vault.clear();
    if (token) await this.request('/auth/v1/logout?scope=local', undefined, token);
  }
}
