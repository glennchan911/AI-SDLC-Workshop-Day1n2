import { test, expect, registerUser, createTodo } from './helpers';

const REMINDER_PRESETS: Array<{ minutes: 15 | 30 | 60 | 120 | 1440 | 2880 | 10080; label: string }> = [
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
  { minutes: 1440, label: '1d' },
  { minutes: 2880, label: '2d' },
  { minutes: 10080, label: '1w' },
];

test.describe('Reminders & Notifications', () => {
  test.beforeEach(async ({ page }) => {
    const username = `reminders-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await registerUser(page, username);
  });

  test('reminder dropdown offers exactly 7 timing presets plus None', async ({ page }) => {
    const options = await page.getByLabel('Reminder').first().locator('option').allTextContents();
    expect(options).toEqual([
      'None',
      '15m before',
      '30m before',
      '1h before',
      '2h before',
      '1d before',
      '2d before',
      '1w before',
    ]);
  });

  test('reminder dropdown is disabled until a due date is set', async ({ page }) => {
    await expect(page.getByLabel('Reminder').first()).toBeDisabled();
    await page.locator('input[type="datetime-local"]').first().fill('2027-06-01T09:00');
    await expect(page.getByLabel('Reminder').first()).toBeEnabled();
  });

  for (const preset of REMINDER_PRESETS) {
    test(`setting a ${preset.label} reminder shows the correct badge`, async ({ page }) => {
      const title = `Reminder task ${preset.minutes} ${Date.now()}`;
      await createTodo(page, {
        title,
        dueDate: '2027-06-01T09:00',
        reminderMinutes: preset.minutes,
      });

      await expect(
        page.getByRole('listitem').filter({ hasText: title }).getByText(`🔔 ${preset.label}`)
      ).toBeVisible();
    });
  }

  test('rejects a reminder without a due date via the API', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: { title: 'No due date reminder', reminder_minutes: 60 },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);
  });

  test('rejects an invalid reminder timing via the API', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: { title: 'Bad reminder', due_date: '2027-06-01T09:00:00.000Z', reminder_minutes: 45 },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);
  });

  test('GET /api/notifications/check returns a todo whose reminder window has opened', async ({ page }) => {
    const dueSoon = new Date(Date.now() + 2 * 60_000).toISOString(); // 2 minutes out
    const createRes = await page.request.post('/api/todos', {
      data: { title: 'Due soon reminder', due_date: dueSoon, reminder_minutes: 1440 }, // 1-day window already open
      headers: { 'Content-Type': 'application/json' },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();

    const checkRes = await page.request.get('/api/notifications/check');
    expect(checkRes.ok()).toBeTruthy();
    const { success, data } = await checkRes.json();
    expect(success).toBe(true);
    expect(data.some((t: { id: number }) => t.id === created.id)).toBe(true);
  });

  test('GET /api/notifications/check excludes todos whose reminder window has not opened', async ({ page }) => {
    const dueFar = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString(); // 3 days out
    const createRes = await page.request.post('/api/todos', {
      data: { title: 'Due later reminder', due_date: dueFar, reminder_minutes: 15 },
      headers: { 'Content-Type': 'application/json' },
    });
    const created = await createRes.json();

    const checkRes = await page.request.get('/api/notifications/check');
    const { data } = await checkRes.json();
    expect(data.some((t: { id: number }) => t.id === created.id)).toBe(false);
  });

  test('a reminder marked sent is excluded until due date or timing is edited', async ({ page }) => {
    const dueSoon = new Date(Date.now() + 2 * 60_000).toISOString();
    const createRes = await page.request.post('/api/todos', {
      data: { title: 'Ack reminder', due_date: dueSoon, reminder_minutes: 1440 },
      headers: { 'Content-Type': 'application/json' },
    });
    const created = await createRes.json();

    await page.request.put(`/api/todos/${created.id}`, {
      data: { last_notification_sent: new Date().toISOString() },
      headers: { 'Content-Type': 'application/json' },
    });

    const checkRes = await page.request.get('/api/notifications/check');
    const { data } = await checkRes.json();
    expect(data.some((t: { id: number }) => t.id === created.id)).toBe(false);

    // Editing the due date re-arms the reminder for the new window.
    const newDueSoon = new Date(Date.now() + 3 * 60_000).toISOString();
    const editRes = await page.request.put(`/api/todos/${created.id}`, {
      data: { due_date: newDueSoon },
      headers: { 'Content-Type': 'application/json' },
    });
    const edited = await editRes.json();
    expect(edited.last_notification_sent).toBeNull();

    const checkRes2 = await page.request.get('/api/notifications/check');
    const { data: data2 } = await checkRes2.json();
    expect(data2.some((t: { id: number }) => t.id === created.id)).toBe(true);
  });

  test('Enable Notifications button requests permission and reflects granted state', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);

    const button = page.getByRole('button', { name: /Enable Notifications/i });
    await expect(button).toBeVisible();
    await button.click();

    await expect(page.getByRole('button', { name: /Notifications On/i })).toBeVisible();
  });
});
