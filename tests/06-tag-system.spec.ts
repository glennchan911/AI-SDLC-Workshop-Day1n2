import { test, expect, registerUser, createTodo } from './helpers';

test.describe('Tag System', () => {
  test.beforeEach(async ({ page }) => {
    const username = `tag-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await registerUser(page, username);
    await createTodo(page, { title: 'Ship feature' });
  });

  test('can create tags via Manage Tags modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage Tags' }).click();
    const modal = page.getByRole('heading', { name: 'Manage Tags' }).locator('..');
    await modal.getByPlaceholder('Tag name').fill('Work');
    await modal.getByRole('button', { name: 'Create Tag' }).click();
    await expect(modal.getByText('Work')).toBeVisible();
    await modal.getByRole('button', { name: 'Close' }).click();
  });

  test('can assign a tag to a todo and see the badge', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage Tags' }).click();
    await page.getByPlaceholder('Tag name').fill('Urgent');
    await page.getByRole('button', { name: 'Create Tag' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    const item = page.getByRole('listitem').filter({ hasText: 'Ship feature' });
    await item.getByLabel('Assign tag to Ship feature').selectOption({ label: 'Urgent' });
    await expect(item.getByText('Urgent', { exact: true })).toBeVisible();
  });

  test('can assign multiple tags to a todo', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage Tags' }).click();
    await page.getByPlaceholder('Tag name').fill('Work');
    await page.getByRole('button', { name: 'Create Tag' }).click();
    await page.getByPlaceholder('Tag name').fill('Personal');
    await page.getByRole('button', { name: 'Create Tag' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    const item = page.getByRole('listitem').filter({ hasText: 'Ship feature' });
    await item.getByLabel('Assign tag to Ship feature').selectOption({ label: 'Work' });
    await item.getByLabel('Assign tag to Ship feature').selectOption({ label: 'Personal' });

    await expect(item.getByText('Work', { exact: true })).toBeVisible();
    await expect(item.getByText('Personal', { exact: true })).toBeVisible();
  });

  test('removing a tag detaches it from the todo', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage Tags' }).click();
    await page.getByPlaceholder('Tag name').fill('Temp');
    await page.getByRole('button', { name: 'Create Tag' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    const item = page.getByRole('listitem').filter({ hasText: 'Ship feature' });
    await item.getByLabel('Assign tag to Ship feature').selectOption({ label: 'Temp' });
    await expect(item.getByText('Temp', { exact: true })).toBeVisible();

    await item.getByLabel('Remove tag Temp from Ship feature').click();
    await expect(item.getByText('Temp', { exact: true })).not.toBeVisible();
  });

  test('deleting a tag removes its badge from todos', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage Tags' }).click();
    await page.getByPlaceholder('Tag name').fill('Deprecated');
    await page.getByRole('button', { name: 'Create Tag' }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    const item = page.getByRole('listitem').filter({ hasText: 'Ship feature' });
    await item.getByLabel('Assign tag to Ship feature').selectOption({ label: 'Deprecated' });
    await expect(item.getByText('Deprecated', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Manage Tags' }).click();
    const modal = page.getByRole('heading', { name: 'Manage Tags' }).locator('..');
    await modal.getByRole('listitem').filter({ hasText: 'Deprecated' }).getByRole('button', { name: 'Delete' }).click();
    await modal.getByRole('button', { name: 'Close' }).click();

    await expect(item.getByText('Deprecated', { exact: true })).not.toBeVisible();
  });
});
