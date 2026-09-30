import { validateLayout } from '../../assets/tickets/venue-model.mjs';
export type Seat = { id: string; label: string; accessible: boolean; state: 'available' | 'held' | 'reserved' };
export type Hold = { hold_id: string; seat_ids: string[]; expires_at: string };
export type Receipt = { ok: true; code: string; qty: number; amount_cents: 0; currency: string; paid: false; seat_ids?: string[]; hold_id?: string; cancelled?: boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validEventId(id: string) { return uuid.test(id); }
export function seatMap(value: any) {
  if (value?.available === false) return null;
  if (value?.available !== true || !uuid.test(value.session_id || '') || !Array.isArray(value.seats)) throw new Error('Seat availability could not be verified.');
  const layout = validateLayout(value.layout), ids = new Set<string>();
  const seats: Seat[] = value.seats.map((seat: any) => {
    if (!seat || typeof seat.id !== 'string' || ids.has(seat.id) || !['available','held','reserved'].includes(seat.state) || typeof seat.label !== 'string' || !layout.objects.some((o: any) => o.id === seat.id && o.kind === 'seat' && !o.excluded)) throw new Error('The server returned an invalid seat map.');
    ids.add(seat.id); return { id: seat.id, label: seat.label, state: seat.state, accessible: seat.accessible === true };
  });
  const ticketType = value.ticket_type_id;
  if ((typeof ticketType === 'number' && !Number.isSafeInteger(ticketType)) || !/^\d+$/.test(String(ticketType))) throw new Error('Ticket type could not be verified.');
  return { layout, seats, ticket_type_id: String(ticketType), session_id: value.session_id as string };
}
export function validHold(value: any): value is Hold { return !!value && uuid.test(value.hold_id || '') && Array.isArray(value.seat_ids) && value.seat_ids.length >= 1 && value.seat_ids.length <= 10 && value.seat_ids.every((id: unknown) => typeof id === 'string') && new Set(value.seat_ids).size === value.seat_ids.length && Number.isFinite(Date.parse(value.expires_at)); }
export function holdReceipt(value: any, selected: string[]) {
  if (value?.ok !== true || !validHold(value) || value.seat_ids.length !== selected.length || !selected.every(id => value.seat_ids.includes(id))) throw new Error('The seat hold was not confirmed. Refresh your reservations before retrying.');
  return value as Hold;
}
export function freeReceipt(value: any, quantity: number, hold?: Hold): Receipt {
  if (!value || value.ok !== true || typeof value.code !== 'string' || !value.code.trim() || value.qty !== quantity || value.amount_cents !== 0 || value.paid !== false || typeof value.currency !== 'string') throw new Error('Reservation was not confirmed. Refresh your reservations before trying again.');
  if (hold && (value.hold_id !== hold.hold_id || !Array.isArray(value.seat_ids) || value.seat_ids.length !== hold.seat_ids.length || !hold.seat_ids.every(id => value.seat_ids.includes(id)))) throw new Error('The reservation seats did not match your hold.');
  return value;
}
export function statusResponse(value: any) {
  if (!value || !Number.isFinite(Date.parse(value.server_time)) || !Array.isArray(value.reservations) || (value.active_hold !== null && !validHold(value.active_hold))) throw new Error('Your seat reservations could not be verified.');
  const reservations = value.reservations.map((row: any) => { if (!uuid.test(row.hold_id || '') || !Array.isArray(row.seat_ids) || !['reserved','cancelled'].includes(row.status)) throw new Error('Invalid reservation status.'); const receipt = freeReceipt(row.receipt, row.seat_ids.length, { hold_id: row.hold_id, seat_ids: row.seat_ids, expires_at: value.server_time }); if (row.status === 'cancelled' && receipt.cancelled !== true) throw new Error('Cancellation was not verified.'); return { status: row.status as string, receipt }; });
  return { active_hold: value.active_hold as Hold | null, reservations, server_time: value.server_time as string };
}
export function remainingSeconds(hold: Hold | null, now: number, offset = 0) { return hold ? Math.max(0, Math.ceil((Date.parse(hold.expires_at) - now - offset) / 1000)) : 0; }
