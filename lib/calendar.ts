import { toSingaporeParts, toSingaporeDateOnly } from './timezone';
import type { Todo, Holiday } from './db';

export interface CalendarDay {
  date: string; // ISO 8601 YYYY-MM-DD
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  todos: Todo[];
  holiday: Holiday | null;
}

export interface CalendarWeek {
  days: CalendarDay[];
}

export interface CalendarMonth {
  year: number;
  month: number;
  weeks: CalendarWeek[];
}

/**
 * Builds a month grid (6 weeks x 7 days) for the given Singapore date.
 * Pads start/end with previous/next month days to fill the grid.
 * Assigns todos by due_date and looks up holiday info.
 */
export function buildMonthGrid(
  singaporeDateString: string,
  todos: Todo[],
  holidays: Holiday[]
): CalendarMonth {
  const { year, month } = toSingaporeParts(singaporeDateString);
  
  // Group todos by date for quick lookup
  const todosByDate = new Map<string, Todo[]>();
  for (const todo of todos) {
    if (todo.due_date) {
      const dateOnly = toSingaporeDateOnly(todo.due_date);
      if (!todosByDate.has(dateOnly)) {
        todosByDate.set(dateOnly, []);
      }
      todosByDate.get(dateOnly)!.push(todo);
    }
  }

  // Group holidays by date for quick lookup
  const holidaysByDate = new Map<string, Holiday>();
  for (const holiday of holidays) {
    holidaysByDate.set(holiday.date, holiday);
  }

  // Get today's date in Singapore
  const todayDate = toSingaporeDateOnly(new Date().toISOString());

  // Start on the first day of the month
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const firstDayOfWeek = firstDay.getUTCDay(); // 0=Sunday, 6=Saturday

  // Build week array starting from Sunday before month start
  const currentDate = new Date(Date.UTC(year, month - 1, 1));
  currentDate.setUTCDate(currentDate.getUTCDate() - firstDayOfWeek);

  const weeks_: CalendarWeek[] = [];
  for (let week = 0; week < 6; week++) {
    const days: CalendarDay[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const dayYear = currentDate.getUTCFullYear();
      const dayMonth = currentDate.getUTCMonth() + 1;
      const dayOfMonth = currentDate.getUTCDate();
      const dateString = `${dayYear}-${String(dayMonth).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
      
      const isCurrentMonth = dayMonth === month && dayYear === year;
      const isToday = dateString === todayDate;
      const dayTodos = todosByDate.get(dateString) || [];
      const holiday = holidaysByDate.get(dateString) || null;

      days.push({
        date: dateString,
        dayOfMonth,
        isCurrentMonth,
        isToday,
        todos: dayTodos,
        holiday,
      });

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    weeks_.push({ days });
  }

  return {
    year,
    month,
    weeks: weeks_,
  };
}

/**
 * Returns a human-readable month name.
 */
export function getMonthName(month: number): string {
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return names[month - 1] || '';
}

/**
 * Returns a human-readable day name.
 */
export function getDayName(dayOfWeek: number): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return names[dayOfWeek] || '';
}

/**
 * Adds or subtracts months from a Singapore date string.
 */
export function addMonths(singaporeDateString: string, monthsToAdd: number): string {
  const { year, month, day, hour, minute } = toSingaporeParts(singaporeDateString);
  const newMonth = month + monthsToAdd;
  const newYear = year + Math.floor((newMonth - 1) / 12);
  const newMonthWrapped = ((newMonth - 1) % 12) + 1;
  
  // Clamp day to valid range for target month
  const daysInTargetMonth = new Date(Date.UTC(newYear, newMonthWrapped, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);
  
  return `${newYear}-${String(newMonthWrapped).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
