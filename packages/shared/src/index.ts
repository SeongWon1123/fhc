/**
 * Domain vocabulary shared by the FitConnect clients.
 *
 * Scope is deliberately narrow. The two clients model *different things* that
 * happen to share names: `apps/mobile` carries the API entities (see
 * `apps/mobile/src/types/index.ts`), while `apps/web` carries flattened rows for
 * the operator tables (see `apps/web/src/data.ts`). Those shapes must not be
 * merged -- mobile's `Coach` nests `coach_details` and web's is a flat booking
 * summary. Only values that are identical in both places belong here.
 */

/** Lifecycle of a booking. Mirrored by the API's `BookingStatusUpdate` literal. */
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

/** How a session is delivered. Mirrored by the API's `SessionType` enum. */
export type SessionType = 'online' | 'offline';
