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
  getById(userId: number, id: number) {
    return db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId) as Todo | undefined;
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
};

export function getDb() {
  return db;
}

export default db;
