import { create } from 'zustand';
import { parseBookingEvent, type BookingUpdateEvent } from './bookingManagement';

type Connection = 'connecting' | 'connected' | 'disconnected' | 'disabled';
type BookingRealtimeState = {
  readonly ownerId: string | null;
  readonly connection: Connection;
  readonly revision: number;
  readonly latest: BookingUpdateEvent | null;
  readonly reset: (ownerId: string | null, connection: Connection) => void;
  readonly setConnection: (ownerId: string, connection: Connection) => void;
  readonly receive: (ownerId: string, event: unknown) => void;
  readonly refresh: (ownerId: string) => void;
  readonly dismiss: () => void;
};

export const useBookingRealtime = create<BookingRealtimeState>((set) => ({
  ownerId: null, connection: 'disabled', revision: 0, latest: null,
  reset: (ownerId, connection) => set((state) => ({
    ownerId, connection, latest: null, revision: state.revision + 1,
  })),
  setConnection: (ownerId, connection) => set((state) =>
    state.ownerId === ownerId ? {
      connection,
      revision: state.revision + (connection === 'connected' ? 1 : 0),
    } : state),
  receive: (ownerId, event) => {
    const update = parseBookingEvent(event);
    if (!update) return;
    set((state) => state.ownerId === ownerId
      ? { latest: update, revision: state.revision + 1 } : state);
  },
  refresh: (ownerId) => set((state) => state.ownerId === ownerId
    ? { revision: state.revision + 1 } : state),
  dismiss: () => set({ latest: null }),
}));
