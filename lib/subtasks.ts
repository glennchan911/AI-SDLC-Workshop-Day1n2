import type { Subtask } from '@/lib/db';

export interface ProgressStats {
  completed: number;
  total: number;
  percent: number;
}

/** Pure progress calculator: 0 total yields 0% rather than NaN. */
export function calculateProgress(subtasks: Pick<Subtask, 'completed'>[]): ProgressStats {
  const total = subtasks.length;
  const completed = subtasks.filter((s) => Boolean(s.completed)).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

export function formatProgressLabel(stats: ProgressStats): string {
  return `${stats.completed} / ${stats.total} completed (${stats.percent}%)`;
}
