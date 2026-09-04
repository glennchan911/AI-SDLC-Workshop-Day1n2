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
  options: {
    title: string;
    priority?: 'high' | 'medium' | 'low';
    dueDate?: string;
    isRecurring?: boolean;
    recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    reminderMinutes?: 15 | 30 | 60 | 120 | 1440 | 2880 | 10080;
  }
) {
  const titleInput = page.getByPlaceholder('Add a new todo');
  await titleInput.fill(options.title);
  if (options.priority) {
    await page.locator('select').first().selectOption(options.priority);
  }
  if (options.dueDate) {
    await page.locator('input[type="datetime-local"]').first().fill(options.dueDate);
  }
  if (options.isRecurring) {
    await page.getByLabel('Repeat').first().check();
    if (options.recurrencePattern) {
      await page.locator('select').nth(1).selectOption(options.recurrencePattern);
    }
  }
  if (options.reminderMinutes) {
    await page.getByLabel('Reminder').first().selectOption(String(options.reminderMinutes));
  }
  await expect(page.getByRole('button', { name: 'Add Todo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Add Todo' }).click();
  await expect(page.getByText(options.title)).toBeVisible();
}

export const test = base;

// Mirrors `formatDueDate` in components/TodoApp.tsx so tests can assert on the
// exact rendered text for a wall-clock Singapore date/time (e.g. '2027-03-17T14:00').
export function formatExpectedDueDate(wallClockLocal: string): string {
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(`${wallClockLocal}:00+08:00`));
}
