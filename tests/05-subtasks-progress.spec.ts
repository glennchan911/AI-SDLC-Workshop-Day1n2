import { test, expect, registerUser, createTodo } from './helpers';

test.describe('Subtasks and Progress', () => {
  test.beforeEach(async ({ page }) => {
    const username = `subtask-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await registerUser(page, username);
    await createTodo(page, { title: 'Plan launch' });
  });

  test('user can add multiple subtasks and see progress updates', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'Plan launch' });

    await item.getByPlaceholder('Add subtask').fill('Write brief');
    await item.getByRole('button', { name: 'Add subtask' }).click();
    await expect(item.getByText('Write brief')).toBeVisible();

    await item.getByPlaceholder('Add subtask').fill('Review brief');
    await item.getByRole('button', { name: 'Add subtask' }).click();
    await expect(item.getByText('Review brief')).toBeVisible();

    await expect(item.getByText('0 / 2 completed (0%)')).toBeVisible();

    await item.getByRole('checkbox', { name: /Write brief/ }).click();
    await expect(item.getByText('1 / 2 completed (50%)')).toBeVisible();

    await item.getByRole('checkbox', { name: /Review brief/ }).click();
    await expect(item.getByText('2 / 2 completed (100%)')).toBeVisible();
  });

  test('deleting a subtask updates progress', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'Plan launch' });

    await item.getByPlaceholder('Add subtask').fill('Task A');
    await item.getByRole('button', { name: 'Add subtask' }).click();
    await item.getByPlaceholder('Add subtask').fill('Task B');
    await item.getByRole('button', { name: 'Add subtask' }).click();

    await item.getByRole('checkbox', { name: /Task A/ }).click();
    await expect(item.getByText('1 / 2 completed (50%)')).toBeVisible();

    await item.getByRole('button', { name: 'Delete subtask Task B' }).click();
    await expect(item.getByText('1 / 1 completed (100%)')).toBeVisible();
  });
});
