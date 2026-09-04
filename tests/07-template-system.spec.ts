import { test, expect, registerUser, createTodo } from './helpers';

test.describe('Template System', () => {
  test.beforeEach(async ({ page }) => {
    const username = `template-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await registerUser(page, username);
    await createTodo(page, { title: 'Weekly review', priority: 'high' });
  });

  test('can save a todo as a template with subtasks', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'Weekly review' });
    await item.getByPlaceholder('Add subtask').fill('Check metrics');
    await item.getByRole('button', { name: 'Add subtask' }).click();

    await item.getByRole('button', { name: 'Save as Template' }).click();
    await page.getByRole('button', { name: 'Save Template' }).click();

    await page.getByRole('button', { name: 'Templates' }).click();
    const modal = page.getByRole('heading', { name: 'Templates' }).locator('..');
    await expect(modal.getByText('Weekly review')).toBeVisible();
    await modal.getByRole('button', { name: 'Close' }).click();
  });

  test('template can create a todo with subtasks and due offset', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'Weekly review' });
    await item.getByPlaceholder('Add subtask').fill('Check metrics');
    await item.getByRole('button', { name: 'Add subtask' }).click();

    await item.getByRole('button', { name: 'Save as Template' }).click();
    await page.getByLabel('Due date offset (days from use)').fill('3');
    await page.getByRole('button', { name: 'Save Template' }).click();

    await page.getByRole('button', { name: 'Templates' }).click();
    const useModal = page.getByRole('heading', { name: 'Templates' }).locator('..');
    await useModal.getByRole('button', { name: 'Use Template' }).click();
    await useModal.getByRole('button', { name: 'Close' }).click();

    const newItems = page.getByRole('listitem').filter({ hasText: 'Weekly review' });
    await expect(newItems).toHaveCount(2);
    await expect(newItems.last().getByText('Check metrics')).toBeVisible();
  });

  test('deleting a template removes it from the list', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'Weekly review' });
    await item.getByRole('button', { name: 'Save as Template' }).click();
    await page.getByRole('button', { name: 'Save Template' }).click();

    await page.getByRole('button', { name: 'Templates' }).click();
    const modal = page.getByRole('heading', { name: 'Templates' }).locator('..');
    await modal.getByRole('button', { name: 'Delete' }).click();
    await expect(modal.getByText('No templates yet.')).toBeVisible();
    await modal.getByRole('button', { name: 'Close' }).click();
  });
});
