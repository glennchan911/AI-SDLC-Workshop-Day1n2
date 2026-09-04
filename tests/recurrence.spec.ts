import { test, expect } from '@playwright/test';
import { calculateNextDueDate } from '../lib/recurrence';

// Pure-logic unit tests for the recurrence date math. These don't need a
// browser page or the dev server; they run through the same Playwright test
// runner used for the rest of the suite.
test.describe('calculateNextDueDate', () => {
  test('daily adds one day and preserves time-of-day', () => {
    expect(calculateNextDueDate('2025-11-10T14:00:00+08:00', 'daily')).toBe(
      new Date('2025-11-11T14:00:00+08:00').toISOString()
    );
  });

  test('weekly adds seven days and preserves time-of-day', () => {
    expect(calculateNextDueDate('2025-11-10T14:00:00+08:00', 'weekly')).toBe(
      new Date('2025-11-17T14:00:00+08:00').toISOString()
    );
  });

  test('monthly with no overflow keeps the same day-of-month', () => {
    expect(calculateNextDueDate('2025-06-15T09:00:00+08:00', 'monthly')).toBe(
      new Date('2025-07-15T09:00:00+08:00').toISOString()
    );
  });

  test('monthly clamps Jan 31 to Feb 28 in a non-leap year', () => {
    expect(calculateNextDueDate('2025-01-31T09:00:00+08:00', 'monthly')).toBe(
      new Date('2025-02-28T09:00:00+08:00').toISOString()
    );
  });

  test('monthly clamps Jan 31 to Feb 29 in a leap year', () => {
    expect(calculateNextDueDate('2024-01-31T09:00:00+08:00', 'monthly')).toBe(
      new Date('2024-02-29T09:00:00+08:00').toISOString()
    );
  });

  test('monthly rolls December into January of the next year', () => {
    expect(calculateNextDueDate('2025-12-31T09:00:00+08:00', 'monthly')).toBe(
      new Date('2026-01-31T09:00:00+08:00').toISOString()
    );
  });

  test('yearly with no overflow keeps the same month/day', () => {
    expect(calculateNextDueDate('2025-06-15T09:00:00+08:00', 'yearly')).toBe(
      new Date('2026-06-15T09:00:00+08:00').toISOString()
    );
  });

  test('yearly clamps Feb 29 to Feb 28 when the next year is not a leap year', () => {
    expect(calculateNextDueDate('2024-02-29T09:00:00+08:00', 'yearly')).toBe(
      new Date('2025-02-28T09:00:00+08:00').toISOString()
    );
  });

  test('preserves time-of-day across all patterns', () => {
    for (const pattern of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
      const result = calculateNextDueDate('2025-05-05T23:45:00+08:00', pattern);
      expect(new Date(result).toISOString().includes('23:45')).toBe(false); // stored as UTC...
      // ...but the Singapore-local hour/minute must still read back as 23:45.
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Singapore',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(new Date(result));
      const hour = parts.find((p) => p.type === 'hour')?.value;
      const minute = parts.find((p) => p.type === 'minute')?.value;
      expect(`${hour}:${minute}`).toBe('23:45');
    }
  });
});
