type DatedBooking = { scheduled_at?: string | null; status?: string | null };
type DatedLog = { created_at?: string | null };

const EXCLUDED_BOOKING_STATUSES = ['cancelled', 'no_show'];
// Korea has no daylight saving time, so a fixed +09:00 shift gives the Korean calendar day
// regardless of the device time zone.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const kstDayKey = (date: Date): string => new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);

const isSameKoreanDay = (value: string | null | undefined, now: Date): boolean => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return kstDayKey(date) === kstDayKey(now);
};

export const countTodayBookings = (bookings: DatedBooking[], now: Date): number =>
  bookings.filter(
    (booking) =>
      !EXCLUDED_BOOKING_STATUSES.includes(booking.status ?? '') && isSameKoreanDay(booking.scheduled_at, now)
  ).length;

export const countTodayMeals = (logs: DatedLog[], now: Date): number =>
  logs.filter((log) => isSameKoreanDay(log.created_at, now)).length;
