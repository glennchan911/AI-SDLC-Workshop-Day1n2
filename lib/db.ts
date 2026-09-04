import Database from 'better-sqlite3';
import path from 'node:path';

const db = new Database(path.join(process.cwd(), 'todos.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6b7280',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
  );

  CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

  CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (todo_id, tag_id)
  );

  CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    offset_days INTEGER NOT NULL DEFAULT 0,
    subtasks_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
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

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: number;
  position: number;
  created_at: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Template {
  id: number;
  user_id: number;
  title: string;
  priority: Priority;
  offset_days: number;
  subtasks_json: string;
  created_at: string;
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
};

export const subtaskDB = {
  listByTodo(todoId: number) {
    return db.prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC, id ASC').all(todoId) as Subtask[];
  },
  getById(id: number) {
    return db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as Subtask | undefined;
  },
  create(todoId: number, title: string) {
    const row = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition FROM subtasks WHERE todo_id = ?').get(todoId) as { nextPosition: number };
    const result = db.prepare('INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)').run(todoId, title, row.nextPosition);
    return this.getById(Number(result.lastInsertRowid));
  },
  update(id: number, patch: Partial<Subtask>) {
    const existing = this.getById(id);
    if (!existing) {
      return undefined;
    }

    const fields: Array<keyof Subtask> = ['title', 'completed', 'position'];
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        setClauses.push(`${field} = ?`);
        values.push(patch[field]);
      }
    }

    if (setClauses.length === 0) {
      return existing;
    }

    values.push(id);
    db.prepare(`UPDATE subtasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },
  delete(id: number) {
    const result = db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

export const tagDB = {
  list(userId: number) {
    return db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC').all(userId) as Tag[];
  },
  getById(id: number) {
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag | undefined;
  },
  findByUserAndId(userId: number, id: number) {
    return db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, userId) as Tag | undefined;
  },
  create(userId: number, name: string, color: string) {
    const result = db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)').run(userId, name, color);
    return this.getById(Number(result.lastInsertRowid));
  },
  update(id: number, patch: Partial<Tag>) {
    const existing = this.getById(id);
    if (!existing) {
      return undefined;
    }

    const fields: Array<keyof Tag> = ['name', 'color'];
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        setClauses.push(`${field} = ?`);
        values.push(patch[field]);
      }
    }

    if (setClauses.length === 0) {
      return existing;
    }

    values.push(id);
    db.prepare(`UPDATE tags SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  },
  delete(id: number) {
    const result = db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    return result.changes > 0;
  },
  listForTodo(todoId: number) {
    return db
      .prepare('SELECT tags.* FROM tags INNER JOIN todo_tags ON todo_tags.tag_id = tags.id WHERE todo_tags.todo_id = ? ORDER BY tags.name ASC')
      .all(todoId) as Tag[];
  },
  assignToTodo(todoId: number, tagId: number) {
    db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
  },
  removeFromTodo(todoId: number, tagId: number) {
    const result = db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId);
    return result.changes > 0;
  },
};

export const templateDB = {
  list(userId: number) {
    return db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Template[];
  },
  getById(userId: number, id: number) {
    return db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(id, userId) as Template | undefined;
  },
  create(userId: number, payload: { title: string; priority: Priority; offset_days: number; subtasks_json: string }) {
    const result = db
      .prepare('INSERT INTO templates (user_id, title, priority, offset_days, subtasks_json) VALUES (?, ?, ?, ?, ?)')
      .run(userId, payload.title, payload.priority, payload.offset_days, payload.subtasks_json);
    return this.getById(userId, Number(result.lastInsertRowid));
  },
  update(userId: number, id: number, patch: Partial<Template>) {
    const existing = this.getById(userId, id);
    if (!existing) {
      return undefined;
    }

    const fields: Array<keyof Template> = ['title', 'priority', 'offset_days', 'subtasks_json'];
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        setClauses.push(`${field} = ?`);
        values.push(patch[field]);
      }
    }

    if (setClauses.length === 0) {
      return existing;
    }

    values.push(id, userId);
    db.prepare(`UPDATE templates SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
    return this.getById(userId, id);
  },
  delete(userId: number, id: number) {
    const result = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  },
};

export function getDb() {
  return db;
}

export default db;
