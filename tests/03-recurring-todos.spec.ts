import { test, expect, registerUser, createTodo, formatExpectedDueDate } from './helpers';

test.describe('Recurring Todos', () => {
  test.beforeEach(async ({ page }) => {
    const username = `recurring-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await registerUser(page, username);
  });

  test('creating a daily recurring todo shows the 🔄 daily badge', async ({ page }) => {
    const title = `Morning run ${Date.now()}`;
    await createTodo(page, {
      title,
      dueDate: '2027-01-05T07:00',
      isRecurring: true,
      recurrencePattern: 'daily',
    });

    await expect(
      page.getByRole('listitem').filter({ hasText: title }).getByText('🔄 daily')
    ).toBeVisible();
  });

  test('completing a weekly recurring todo creates a next instance 7 days later', async ({ page }) => {
    const title = `Team meeting ${Date.now()}`;
    await createTodo(page, {
      title,
      dueDate: '2027-03-10T14:00',
      isRecurring: true,
      recurrencePattern: 'weekly',
    });

    await page.getByRole('listitem').filter({ hasText: title }).getByRole('checkbox').click();

    const completedSection = page.locator('h3', { hasText: 'Completed' }).locator('..');
    await expect(completedSection.getByText(title)).toBeVisible();

    const activeSection = page.locator('h3', { hasText: 'Active' }).locator('..');
    const nextInstance = activeSection.getByRole('listitem').filter({ hasText: title });
    await expect(nextInstance).toBeVisible();
    await expect(nextInstance.getByText('🔄 weekly')).toBeVisible();
    await expect(nextInstance.getByText(formatExpectedDueDate('2027-03-17T14:00'), { exact: false })).toBeVisible();
  });

  test('completing a monthly recurring todo due Jan 31 clamps to Feb 28', async ({ page }) => {
    const title = `Pay rent ${Date.now()}`;
    await createTodo(page, {
      title,
      dueDate: '2027-01-31T09:00',
      isRecurring: true,
      recurrencePattern: 'monthly',
    });

    await page.getByRole('listitem').filter({ hasText: title }).getByRole('checkbox').click();

    await expect(page.getByText(formatExpectedDueDate('2027-02-28T09:00'), { exact: false })).toBeVisible();
  });

  test('completing a yearly recurring todo due Feb 29 (leap year) clamps to Feb 28 next year', async ({ page }) => {
    const title = `Renew passport ${Date.now()}`;
    await createTodo(page, {
      title,
      dueDate: '2028-02-29T10:00',
      isRecurring: true,
      recurrencePattern: 'yearly',
    });

    await page.getByRole('listitem').filter({ hasText: title }).getByRole('checkbox').click();

    await expect(page.getByText(formatExpectedDueDate('2029-02-28T10:00'), { exact: false })).toBeVisible();
  });

  test('cannot enable repeat without a due date', async ({ page }) => {
    await page.getByPlaceholder('Add a new todo').fill('No due date recurring');
    await expect(page.getByLabel('Repeat').first()).toBeDisabled();
  });

  test('rejects creating a recurring todo without a due date via the API', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: { title: 'Missing due date', is_recurring: true, recurrence_pattern: 'daily' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects an invalid recurrence pattern via the API', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: {
        title: 'Bad pattern',
        is_recurring: true,
        recurrence_pattern: 'hourly',
        due_date: '2027-01-01T09:00:00.000Z',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);
  });

  test('unchecking Repeat stops future recurrence without affecting past instances', async ({ page }) => {
    const title = `Daily standup ${Date.now()}`;
    await createTodo(page, {
      title,
      dueDate: '2027-01-05T10:00',
      isRecurring: true,
      recurrencePattern: 'daily',
    });
    await expect(
      page.getByRole('listitem').filter({ hasText: title }).getByText('🔄 daily')
    ).toBeVisible();

    await page.getByRole('listitem').filter({ hasText: title }).getByRole('button', { name: 'Edit' }).click();
    const modal = page.locator('h3', { hasText: 'Edit todo' }).locator('..');
    await modal.getByLabel('Repeat').uncheck();
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(
      page.getByRole('listitem').filter({ hasText: title }).getByText('🔄 daily')
    ).not.toBeVisible();

    await page.getByRole('listitem').filter({ hasText: title }).getByRole('checkbox').click();

    const completedSection = page.locator('h3', { hasText: 'Completed' }).locator('..');
    await expect(completedSection.getByText(title)).toBeVisible();
    // No next instance should have been spawned - only one row with this title.
    await expect(page.getByText(title)).toHaveCount(1);
  });

  test('double-submitting a completion request does not create duplicate next instances', async ({ page }) => {
    const title = `Water plants ${Date.now()}`;
    await createTodo(page, {
      title,
      dueDate: '2027-04-01T09:00',
      isRecurring: true,
      recurrencePattern: 'daily',
    });

    const listResponse = await page.request.get('/api/todos');
    const todos = await listResponse.json();
    const todo = todos.find((t: { title: string }) => t.title === title);
    expect(todo).toBeTruthy();

    const [res1, res2] = await Promise.all([
      page.request.put(`/api/todos/${todo.id}`, {
        data: { completed: true },
        headers: { 'Content-Type': 'application/json' },
      }),
      page.request.put(`/api/todos/${todo.id}`, {
        data: { completed: true },
        headers: { 'Content-Type': 'application/json' },
      }),
    ]);
    expect(res1.ok()).toBeTruthy();
    expect(res2.ok()).toBeTruthy();

    const afterResponse = await page.request.get('/api/todos');
    const afterTodos = await afterResponse.json();
    const matching = afterTodos.filter((t: { title: string }) => t.title === title);
    expect(matching).toHaveLength(2); // the completed original + exactly one next instance
  });
});
