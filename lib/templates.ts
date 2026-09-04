export interface SerializedSubtask {
  title: string;
  position: number;
}

/** Serializes a subtask pattern (title + order) for storage in templates.subtasks_json. */
export function serializeSubtasks(subtasks: { title: string }[]): string {
  return JSON.stringify(subtasks.map((s, index): SerializedSubtask => ({ title: s.title, position: index })));
}

export function deserializeSubtasks(json: string): SerializedSubtask[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter((item): item is SerializedSubtask => typeof item === 'object' && item !== null && typeof (item as SerializedSubtask).title === 'string')
    .map((item, index) => ({ title: item.title, position: typeof item.position === 'number' ? item.position : index }))
    .sort((a, b) => a.position - b.position);
}

/** Adds `offsetDays` whole days to `from` (defaults to now), returning an ISO string. */
export function computeDueDate(offsetDays: number, from: Date = new Date()): string {
  const result = new Date(from.getTime());
  result.setDate(result.getDate() + offsetDays);
  return result.toISOString();
}
