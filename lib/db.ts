import Database from 'better-sqlite3';
import path from 'node:path';

const db = new Database(path.join(process.cwd(), 'todos.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS authenticators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT UNIQUE NOT NULL,
    credential_public_key BLOB NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT,
    reminder_minutes INTEGER,
    last_notification_sent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
`);

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080;

export const REMINDER_LABELS: Record<ReminderMinutes, string> = {
  15: '15m',
  30: '30m',
  60: '1h',
  120: '2h',
  1440: '1d',
  2880: '2d',
  10080: '1w',
};

export const REMINDER_OPTIONS: ReminderMinutes[] = [15, 30, 60, 120, 1440, 2880, 10080];

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: Buffer;
  counter: number;
  created_at: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: number;
  due_date: string | null;
  priority: Priority;
  is_recurring: number;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
}

export const userDB = {
  findById(id: number) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },
  findByUsername(username: string) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  },
  create(username: string) {
    const result = db.prepare('INSERT INTO users (username) VALUES (?)').run(username.trim());
    return this.findById(Number(result.lastInsertRowid));
  },
  list() {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
  },
};

export const authenticatorDB = {
  listByUser(userId: number) {
    return db.prepare('SELECT * FROM authenticators WHERE user_id = ? ORDER BY created_at ASC').all(userId) as Authenticator[];
  },
  findByUser(userId: number) {
    return db.prepare('SELECT * FROM authenticators WHERE user_id = ? ORDER BY created_at ASC').all(userId) as Authenticator[];
  },
  findByCredentialId(credentialId: string) {
    return db.prepare('SELECT * FROM authenticators WHERE credential_id = ?').get(credentialId) as Authenticator | undefined;
  },
  create(userId: number, credentialId: string, credentialPublicKey: Buffer, counter: number) {
    const result = db.prepare('INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter) VALUES (?, ?, ?, ?)').run(userId, credentialId, credentialPublicKey, counter);
    return Number(result.lastInsertRowid);
  },
  updateCounter(userId: number, credentialId: string, counter: number) {
    db.prepare('UPDATE authenticators SET counter = ? WHERE user_id = ? AND credential_id = ?').run(counter, userId, credentialId);
  },
};

export const todoDB = {
  listByUser(userId: number) {
    return db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Todo[];
  },
  getTodosByUser(userId: number) {
    return this.listByUser(userId);
  },
  getById(userId: number, id: number) {
    return db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId) as Todo | undefined;
  },
  getTodoById(userId: number, id: number) {
    return this.getById(userId, id);
  },
  create(userId: number, todo: Partial<Todo>) {
    const result = db.prepare(
      `INSERT INTO todos (user_id, title, completed, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes, last_notification_sent, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      userId,
      todo.title ?? '',
      todo.completed ?? 0,
      todo.due_date ?? null,
      todo.priority ?? 'medium',
      todo.is_recurring ?? 0,
      todo.recurrence_pattern ?? null,
      todo.reminder_minutes ?? null,
      todo.last_notification_sent ?? null,
    );
    return this.getById(userId, Number(result.lastInsertRowid));
  },
  createTodo(userId: number, todo: Partial<Todo>) {
    return this.create(userId, todo);
  },
  update(userId: number, id: number, patch: Partial<Todo>) {
    const existing = this.getById(userId, id);
    if (!existing) {
      return undefined;
    }

    const fields: Array<keyof Todo> = [
      'title',
      'completed',
      'due_date',
      'priority',
      'is_recurring',
      'recurrence_pattern',
      'reminder_minutes',
      'last_notification_sent',
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        setClauses.push(`${field} = ?`);
        values.push(patch[field] ?? null);
      }
    }

    if (setClauses.length === 0) {
      return existing;
    }

    setClauses.push("updated_at = datetime('now')");
    values.push(id, userId);

    db.prepare(`UPDATE todos SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    return this.getById(userId, id);
  },
  updateTodo(userId: number, id: number, patch: Partial<Todo>) {
    return this.update(userId, id, patch);
  },
  delete(userId: number, id: number) {
    const result = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  },
  deleteTodo(userId: number, id: number) {
    return this.delete(userId, id);
  },
  // Todos whose reminder window has opened (due_date - reminder_minutes <= now)
  // and that haven't been notified yet. `now` must be an ISO 8601 UTC instant,
  // the same representation `due_date` is stored in, so the comparison is a
  // plain instant comparison regardless of timezone.
  getDueReminders(userId: number, now: string) {
    return db.prepare(`
      SELECT * FROM todos
      WHERE user_id = ?
        AND completed = 0
        AND due_date IS NOT NULL
        AND reminder_minutes IS NOT NULL
        AND last_notification_sent IS NULL
        AND datetime(due_date, '-' || reminder_minutes || ' minutes') <= datetime(?)
    `).all(userId, now) as Todo[];
  },
};

export function getDb() {
  return db;
}

export default db;
