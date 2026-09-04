import { fromSingaporeParts, toSingaporeParts } from './timezone';
import type { RecurrencePattern } from './db';

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function addDays(date: { year: number; month: number; day: number }, days: number): { year: number; month: number; day: number } {
  const utcMillis = Date.UTC(date.year, date.month - 1, date.day) + days * 24 * 60 * 60 * 1000;
  const next = new Date(utcMillis);
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

/**
 * Computes the next occurrence's due date for a recurring todo, operating on
 * the Singapore-local representation of `currentDueDate` and preserving
 * time-of-day. Month/year-end overflow is clamped to the last valid day of
 * the target month (e.g. Jan 31 -> Feb 28/29, Feb 29 -> Feb 28).
 */
export function calculateNextDueDate(currentDueDate: string, pattern: RecurrencePattern): string {
  const { year, month, day, hour, minute } = toSingaporeParts(currentDueDate);

  switch (pattern) {
    case 'daily':
      return fromSingaporeParts(addDays({ year, month, day }, 1), hour, minute);
    case 'weekly':
      return fromSingaporeParts(addDays({ year, month, day }, 7), hour, minute);
    case 'monthly': {
      const targetMonth = month === 12 ? 1 : month + 1;
      const targetYear = month === 12 ? year + 1 : year;
      const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
      return fromSingaporeParts({ year: targetYear, month: targetMonth, day: clampedDay }, hour, minute);
    }
    case 'yearly': {
      const targetYear = year + 1;
      // Feb 29 -> Feb 28 when the target year is not a leap year.
      const clampedDay = Math.min(day, daysInMonth(targetYear, month));
      return fromSingaporeParts({ year: targetYear, month, day: clampedDay }, hour, minute);
    }
    default:
      throw new Error(`Unsupported recurrence pattern: ${pattern}`);
  }
}
