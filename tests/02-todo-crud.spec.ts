import { test, expect, registerUser, createTodo } from './helpers';

test.describe('Todo CRUD', () => {
  test.beforeEach(async ({ page }) => {
    const username = `todo-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await registerUser(page, username);
  });

  test('user can create a todo with title only', async ({ page }) => {
    await createTodo(page, { title: 'Read PRD' });
    await expect(page.getByText('Read PRD')).toBeVisible();
  });

  test('cannot create a todo with an empty title', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add Todo' })).toBeDisabled();
    await expect(page.getByText('No todos here.')).toHaveCount(3);
  });

  test('rejects a due date less than 1 minute in the future', async ({ page }) => {
    const nearPast = new Date(Date.now() - 60_000).toISOString();
    const response = await page.request.post('/api/todos', {
      data: { title: 'Too soon', due_date: nearPast },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);
  });

  test('toggling completion moves a todo to Completed section', async ({ page }) => {
    await createTodo(page, { title: 'Finish report' });
    const checkbox = page
      .getByRole('listitem')
      .filter({ hasText: 'Finish report' })
      .getByRole('checkbox');
    await checkbox.click();

    const completedSection = page.locator('h3', { hasText: 'Completed' }).locator('..');
    await expect(completedSection.getByText('Finish report')).toBeVisible();
  });

  test('editing a todo updates its title', async ({ page }) => {
    await createTodo(page, { title: 'Draft email' });
    await page.getByRole('listitem').filter({ hasText: 'Draft email' }).getByRole('button', { name: 'Edit' }).click();

    const modalTitleInput = page.locator('input[type="text"]').last();
    await modalTitleInput.fill('Draft email v2');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByText('Draft email v2')).toBeVisible();
  });

  test('canceling an edit discards changes', async ({ page }) => {
    await createTodo(page, { title: 'Call client' });
    await page.getByRole('listitem').filter({ hasText: 'Call client' }).getByRole('button', { name: 'Edit' }).click();

    const modalTitleInput = page.locator('input[type="text"]').last();
    await modalTitleInput.fill('Should not be saved');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByText('Call client')).toBeVisible();
    await expect(page.getByText('Should not be saved')).not.toBeVisible();
  });

  test('deleting a todo removes it immediately', async ({ page }) => {
    await createTodo(page, { title: 'Temporary task' });
    await page.getByRole('listitem').filter({ hasText: 'Temporary task' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Temporary task')).not.toBeVisible();
  });
});
