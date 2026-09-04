// A JS `Date` is just an absolute instant (epoch milliseconds) with no
// inherent timezone, so "now in Singapore" and "now" are the same instant --
// only *formatting*/wall-clock extraction is timezone-sensitive (handled by
// `toSingaporeParts`/`formatSingaporeDate` below). Returning the real instant
// here (rather than re-labeling the Singapore wall-clock digits as if they
// were UTC) keeps this value directly comparable to other genuine UTC
// instants stored in the app, such as `due_date` and `last_notification_sent`.
export function getSingaporeNow(date: Date = new Date()): Date {
  return date;
}

export interface SingaporeDateParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

export function toSingaporeParts(value: string): SingaporeDateParts {
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

// Builds an ISO (UTC) string for a wall-clock date/time expressed in Singapore
// local time (UTC+8, no DST), the inverse of `toSingaporeParts`.
export function fromSingaporeParts(
  date: { year: number; month: number; day: number },
  hour: number,
  minute: number
): string {
  const utcMillis = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0) - 8 * 60 * 60 * 1000;
  return new Date(utcMillis).toISOString();
}

export function formatSingaporeDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatSingaporeDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}
