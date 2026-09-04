import { test, expect, registerUser, createTodo } from './helpers';

test.describe('Export and Import', () => {
  test.beforeEach(async ({ page }) => {
    const username = `export-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await registerUser(page, username);
    await createTodo(page, { title: 'Exportable task', priority: 'high' });
  });

  test('export returns todos scoped to the current user', async ({ page }) => {
    const payload = await page.evaluate(() => fetch('/api/todos/export').then((r) => r.json()));
    expect(payload.version).toBe(1);
    expect(Array.isArray(payload.todos)).toBe(true);
    expect(payload.todos.length).toBeGreaterThan(0);
    expect(payload.todos.some((t: { title: string }) => t.title === 'Exportable task')).toBe(true);
  });

  test('exported JSON imports cleanly and creates new ids', async ({ page }) => {
    const exported = await page.evaluate(() => fetch('/api/todos/export').then((r) => r.json()));
    const beforeIds = exported.todos.map((t: { id: number }) => t.id);

    const importResult = await page.evaluate(
      async (payload) => {
        const res = await fetch('/api/todos/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return { status: res.status, body: await res.json() };
      },
      exported
    );

    expect(importResult.status).toBe(201);
    expect(importResult.body.imported).toBe(exported.todos.length);

    const afterExport = await page.evaluate(() => fetch('/api/todos/export').then((r) => r.json()));
    expect(afterExport.todos.length).toBe(exported.todos.length * 2);

    const afterIds = afterExport.todos.map((t: { id: number }) => t.id);
    const newIds = afterIds.filter((id: number) => !beforeIds.includes(id));
    expect(newIds.length).toBe(exported.todos.length);
  });

  test('rejects import with missing todos array', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notTodos: [] }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toBeTruthy();
  });

  test('rejects import with malformed todo entries', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todos: [{ title: '' }] }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('title');
  });

  test('rejects import with invalid priority', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todos: [{ title: 'Bad priority', priority: 'urgent' }] }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toContain('priority');
  });

  test('forces imported todos onto the current session user, ignoring incoming user_id', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todos: [{ title: 'Forged user', user_id: 99999 }] }),
      });
      return { status: res.status };
    });
    expect(result.status).toBe(201);

    const exported = await page.evaluate(() => fetch('/api/todos/export').then((r) => r.json()));
    const forged = exported.todos.find((t: { title: string }) => t.title === 'Forged user');
    expect(forged).toBeTruthy();
  });

  test('export requires authentication', async ({ request }) => {
    const res = await request.get('/api/todos/export');
    expect(res.status()).toBe(401);
  });
});
