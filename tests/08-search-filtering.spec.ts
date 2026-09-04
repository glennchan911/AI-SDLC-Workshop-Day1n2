import { test, expect, registerUser, createTodo } from './helpers';

test.describe('Search and Filtering', () => {
  test.beforeEach(async ({ page }) => {
    const username = `filter-user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await registerUser(page, username);
    await createTodo(page, { title: 'Project Launch', priority: 'high' });
    await createTodo(page, { title: 'Buy groceries', priority: 'low' });
    await createTodo(page, { title: 'Write report', priority: 'medium' });
  });

  test('filters by text query', async ({ page }) => {
    await page.getByPlaceholder('Search todos').fill('Project');
    await expect(page.getByText('Project Launch')).toBeVisible();
    await expect(page.getByText('Buy groceries')).not.toBeVisible();
    await expect(page.getByText('Write report')).not.toBeVisible();
  });

  test('filters by priority', async ({ page }) => {
    await page.getByLabel('Filter by priority').selectOption('high');
    await expect(page.getByText('Project Launch')).toBeVisible();
    await expect(page.getByText('Buy groceries')).not.toBeVisible();
  });

  test('filters by status', async ({ page }) => {
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Buy groceries' })
      .getByRole('checkbox')
      .click();

    await page.getByLabel('Filter by status').selectOption('completed');
    await expect(page.getByText('Buy groceries')).toBeVisible();
    await expect(page.getByText('Project Launch')).not.toBeVisible();
  });

  test('combines text and priority filters', async ({ page }) => {
    await page.getByPlaceholder('Search todos').fill('report');
    await page.getByLabel('Filter by priority').selectOption('medium');
    await expect(page.getByText('Write report')).toBeVisible();
    await expect(page.getByText('Project Launch')).not.toBeVisible();
  });

  test('shows active filter chip and clears it', async ({ page }) => {
    await page.getByLabel('Filter by priority').selectOption('high');
    await expect(page.getByRole('button', { name: /Clear priority/i })).toBeVisible();
    await page.getByRole('button', { name: /Clear priority/i }).click();
    await expect(page.getByText('Buy groceries')).toBeVisible();
  });

  test('clear all filters restores full list', async ({ page }) => {
    await page.getByPlaceholder('Search todos').fill('Project');
    await page.getByLabel('Filter by priority').selectOption('high');
    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(page.getByText('Buy groceries')).toBeVisible();
    await expect(page.getByText('Write report')).toBeVisible();
  });
});
