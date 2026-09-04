# Foundation & Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the project skeleton, database schema, timezone utilities, and WebAuthn-based authentication so every later feature can work through a signed-in `session.userId`.

**Architecture:** Build the app foundations first: project setup, shared database contracts, timezone helpers, and secure session middleware. Once the auth system is working, every follow-on feature can reuse a common session-aware API contract.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, better-sqlite3, JWT session cookies, `@simplewebauthn/server` + `@simplewebauthn/browser`, Playwright.

## Global Constraints

- Next.js App Router with `app/` and `lib/` structure.
- Use SQLite via `better-sqlite3` with synchronous DB calls.
- Use Singapore timezone (`Asia/Singapore`) via `lib/timezone.ts` — no direct `new Date()` usage in logic.
- WebAuthn-only authentication; no password login.
- All API routes must check session first and return `401` when unauthenticated.
- Next.js 16 route params are async: `const { id } = await params`.

---

### Task 1: Bootstrapping the app and shared foundations

**Files:**
- Create: `package.json`, `next.config.*`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`, `app/login/page.tsx`, `app/globals.css`
- Create: `lib/db.ts`, `lib/auth.ts`, `lib/timezone.ts`, `middleware.ts`
- Test: `tests/01-authentication.spec.ts`

**Interfaces:**
- Consumes: project dependency setup
- Produces: working app shell, typed DB modules, timezone utilities, auth helpers used by later features

- [ ] **Step 1: Initialize the Next.js app and install dependencies**

```bash
npm init next-app . --ts --tailwind --eslint --app --src-dir false --import-alias "@/*" --use-npm
npm install better-sqlite3 jsonwebtoken @simplewebauthn/server @simplewebauthn/browser
npm install -D @types/jsonwebtoken @types/better-sqlite3 tsx playwright
```

Expected: project scaffolds successfully and dependencies resolve without install errors.

- [ ] **Step 2: Create the DB schema and shared types**

```ts
// lib/db.ts
export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
export interface User { id: number; username: string; created_at: string; }
export interface Todo { ... }
```

Expected: DB interfaces and `db.prepare()` wrappers exist for `users`, `authenticators`, `todos`, and the base relationships.

- [ ] **Step 3: Add timezone helpers**

```ts
// lib/timezone.ts
export function getSingaporeNow() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' })); }
export function formatSingaporeDate(date: Date | string) { ... }
```

Expected: date logic always uses Singapore-local values across the app, with no direct use of raw `new Date()` in business logic.

- [ ] **Step 4: Run the app setup check**

Run: `npm run build`
Expected: project compiles and scaffolding is valid before auth code is added.

### Task 2: Implement WebAuthn authentication and session middleware

**Files:**
- Modify: `lib/auth.ts`, `middleware.ts`, `app/login/page.tsx`
- Create: `app/api/auth/register-options/route.ts`, `app/api/auth/register-verify/route.ts`, `app/api/auth/login-options/route.ts`, `app/api/auth/login-verify/route.ts`, `app/api/auth/logout/route.ts`
- Test: `tests/01-authentication.spec.ts`

**Interfaces:**
- Consumes: DB schema from Task 1
- Produces: `createSession`, `getSession`, `deleteSession`, protected routes, register/login verification endpoints

- [ ] **Step 1: Write the failing auth smoke test**

```ts
test('guest user is redirected to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});
```

Expected: test fails because the app does not yet redirect to login or implement session gating.

- [ ] **Step 2: Implement JWT session utilities**

```ts
// lib/auth.ts
export async function createSession(userId: number) {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  cookies().set('session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
}
```

Expected: login/register flows can create and read a secure cookie-managed session.

- [ ] **Step 3: Implement WebAuthn registration and login routes**

```ts
// app/api/auth/register-options/route.ts
const options = generateRegistrationOptions({ rpName, rpID, userID, userName, attestationType: 'none' });
return NextResponse.json(options);
```

Expected: browser can request options, verify challenge, and create a user + authenticator if valid.

- [ ] **Step 4: Add middleware and login page**

```ts
// middleware.ts
export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  if (!session && (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/calendar')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

Expected: protected routes redirect unauthenticated users to sign-in while allowing `/login` and public assets.

- [ ] **Step 5: Run targeted auth verification**

Run: `npx playwright test tests/01-authentication.spec.ts`
Expected: pass for registration/login/logout and route protection.

### Dependencies and Exit Criteria

- Depends on: none
- Enables: all subsequent feature work
- Exit criteria: app boots, database schema exists, JWT session logic works, WebAuthn registration/login works, protected routes redirect unauthenticated users.
