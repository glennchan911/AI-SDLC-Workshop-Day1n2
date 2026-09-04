import type { Priority, Todo } from '@/lib/db';

export type StatusFilter = 'all' | 'active' | 'completed';

export interface FilterState {
  query: string;
  priority: Priority | 'all';
  status: StatusFilter;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  query: '',
  priority: 'all',
  status: 'all',
};

export function matchesText(todo: Todo, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  return todo.title.toLowerCase().includes(trimmed);
}

export function matchesPriority(todo: Todo, priority: Priority | 'all'): boolean {
  if (priority === 'all') {
    return true;
  }
  return todo.priority === priority;
}

export function matchesStatus(todo: Todo, status: StatusFilter): boolean {
  if (status === 'all') {
    return true;
  }
  if (status === 'completed') {
    return Boolean(todo.completed);
  }
  return !todo.completed;
}

/** Pure, deterministic filter: preserves the input order of `todos`. */
export function applyFilters(todos: Todo[], filter: FilterState): Todo[] {
  return todos.filter(
    (todo) =>
      matchesText(todo, filter.query) &&
      matchesPriority(todo, filter.priority) &&
      matchesStatus(todo, filter.status)
  );
}

export function isFilterActive(filter: FilterState): boolean {
  return filter.query.trim() !== '' || filter.priority !== 'all' || filter.status !== 'all';
}
