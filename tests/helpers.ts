import { test as base, expect, type Page } from '@playwright/test';

export { expect };

async function addVirtualAuthenticator(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { client, authenticatorId };
}

export async function registerUser(page: Page, username: string) {
  await addVirtualAuthenticator(page);
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: /Register with Passkey/i }).click();
  await page.waitForURL('/', { waitUntil: 'commit' });
  await expect(page.getByText('Welcome back')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.getByPlaceholder('Add a new todo')).toBeVisible();
}

export async function createTodo(
  page: Page,
  options: { title: string; priority?: 'high' | 'medium' | 'low'; dueDate?: string }
) {
  const titleInput = page.getByPlaceholder('Add a new todo');
  await titleInput.fill(options.title);
  if (options.priority) {
    await page.locator('select').first().selectOption(options.priority);
  }
  if (options.dueDate) {
    await page.locator('input[type="datetime-local"]').first().fill(options.dueDate);
  }
  await expect(page.getByRole('button', { name: 'Add Todo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Add Todo' }).click();
  await expect(page.getByText(options.title)).toBeVisible();
}

export const test = base;
