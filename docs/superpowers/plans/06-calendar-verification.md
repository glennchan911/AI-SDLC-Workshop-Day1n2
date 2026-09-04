# Calendar View & Final Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the calendar experience and finish a final verification cycle covering build stability, feature completeness, and deployment readiness.

**Architecture:** Build a protected `/calendar` view that reads the same todo data model and renders month grid cells with due-date grouping. Final verification should validate the app against the evaluation checklist and repo constraints.

**Tech Stack:** Next.js, React, SQLite, Singapore timezone logic, Playwright, production build checks.

## Global Constraints

- Calendar must use Singapore timezone and preserve `Asia/Singapore` rules around month boundaries and holidays.
- `/calendar` is protected by middleware and requires a valid session.
- Final verification uses the same acceptance criteria listed in `EVALUATION.md`.
- Production build and lint checks must pass before calling the feature complete.

---

### Task 1: Calendar view and holiday awareness

**Files:**
- Modify: `app/calendar/page.tsx`, `middleware.ts`, `lib/db.ts`
- Create: `scripts/seed-holidays.ts`
- Test: `tests/10-calendar-view.spec.ts`

**Interfaces:**
- Consumes: user todo list, due dates, and optionally holiday records
- Produces: month grid rendering plus due-date grouping overlay

- [ ] **Step 1: Seed holiday data**

```bash
npx tsx scripts/seed-holidays.ts
```

Expected: Singapore public holidays are loaded into the `holidays` table and can be used for calendar shading or labels.

- [ ] **Step 2: Implement calendar grid logic**

```ts
const monthDays = buildMonthGrid(currentDate, todos);
```

Expected: the page accurately renders each month with date cells, weekday labels, and due-date assignments.

- [ ] **Step 3: Protect the route and render todo cards**

```ts
if (!session) return NextResponse.redirect(new URL('/login', request.url));
```

Expected: `/calendar` remains accessible only to signed-in users and shows Todo entries by date.

- [ ] **Step 4: Run calendar verification**

Run: `npx playwright test tests/10-calendar-view.spec.ts`
Expected: calendar navigation, due-date rendering, and protected access pass.

### Task 2: Full project verification against the evaluation checklist

**Files:**
- Review: `EVALUATION.md`, `README.md`, `USER_GUIDE.md`, `PRPs/README.md`
- Test: all Playwright specs, `npm run build`, `npm run lint`

**Interfaces:**
- Consumes: all project features and routes
- Produces: release-readiness status with known gaps marked clearly

- [ ] **Step 1: Re-run the end-to-end suite**

```bash
npx playwright test
```

Expected: all feature files pass in sequence, including auth, CRUD, metadata, tags, templates, filters, export/import, and calendar.

- [ ] **Step 2: Run production build and lint**

```bash
npm run build
npm run lint
```

Expected: the app builds cleanly and linting produces no blocking failures.

- [ ] **Step 3: Check completeness against `EVALUATION.md`**

Expected: every feature row has either a completed implementation or a documented known gap before release.

- [ ] **Step 4: Final deployment readiness sweep**

Run: relevant deployment instructions from `RAILWAY_DEPLOYMENT.md` / `RAILWAY_SIMPLE_SETUP.md`
Expected: environment variables, WebAuthn configuration, and runtime settings are documented for deployment.

### Dependencies and Exit Criteria

- Depends on: all previous steps
- Deliverable: a fully integrated, session-protected todo app ready for production review
- Exit criteria: all features in the evaluation checklist are present and validated, build passes, E2E tests pass, and deployment instructions are documented.
