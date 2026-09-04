# Priority, Recurring Todos & Reminder System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three core todo metadata systems that extend the base CRUD model: priority ordering, recurrence generation, and reminder/notification timing.

**Architecture:** Extend `todos` with priority + repeated-cycle metadata, then implement the business logic for due-date generation and reminder checks. Build the notification polling hook once the data model is stable.

**Tech Stack:** SQLite, Next.js API routes, React client UI, browser Notification API, Singapore timezone logic.

## Global Constraints

- Priority must be one of `high | medium | low` and default to `medium`.
- Recurrence must be `daily | weekly | monthly | yearly` and only valid when a due date exists.
- Reminder minutes must match the allowed values: `15, 30, 60, 120, 1440, 2880, 10080`.
- Due-date calculations and notification scheduling use `Asia/Singapore` rules.
- Notification polling must prevent duplicates via `last_notification_sent`.

---

### Task 1: Priority system and sorting

**Files:**
- Modify: `lib/db.ts`, `app/api/todos/route.ts`, `app/api/todos/[id]/route.ts`, `app/page.tsx`
- Test: `tests/02-priority-system.spec.ts`

**Interfaces:**
- Consumes: `Todo` model from Step 2
- Produces: sorting logic, badge rendering, priority filter state

- [ ] **Step 1: Define priority validation and defaulting**

```ts
const priority = input.priority ?? 'medium';
if (!['high', 'medium', 'low'].includes(priority)) throw new Error('Invalid priority');
```

Expected: invalid priority values are rejected by API routes and defaulted on create when absent.

- [ ] **Step 2: Add sorting helpers and filter dropdown**

```ts
const sorted = [...todos].sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]);
```

Expected: `high` todos appear before `medium` before `low`, while keeping due-date ordering within each group.

- [ ] **Step 3: Render badges and filter state**

```tsx
<span className="badge badge-red">High</span>
```

Expected: priority badges are visible and filter values match the dropdown selections.

- [ ] **Step 4: Run targeted priority tests**

Run: `npx playwright test tests/02-priority-system.spec.ts`
Expected: priority flows pass across create/edit/filter/sort scenarios.

### Task 2: Recurring todo generation

**Files:**
- Modify: `lib/db.ts`, `app/api/todos/[id]/route.ts`, `app/page.tsx`
- Test: `tests/03-recurring-todos.spec.ts`

**Interfaces:**
- Consumes: due date, priority, reminder, tags, recurrence metadata
- Produces: next instance creation logic and recurrence badge UI

- [ ] **Step 1: Write failing tests for recurring due-date math**

```ts
expect(calculateNextDueDate('2026-02-28', 'monthly')).toBe('2026-03-28');
expect(calculateNextDueDate('2026-12-31', 'yearly')).toBe('2027-12-31');
```

Expected: tests fail until the schedule generator handles month/year boundaries correctly.

- [ ] **Step 2: Implement due-date calculator**

```ts
function advanceDueDate(date: string, pattern: RecurrencePattern) {
  const next = new Date(date);
  if (pattern === 'daily') next.setDate(next.getDate() + 1);
  if (pattern === 'weekly') next.setDate(next.getDate() + 7);
  if (pattern === 'monthly') next.setMonth(next.getMonth() + 1);
  if (pattern === 'yearly') next.setFullYear(next.getFullYear() + 1);
  return formatToISO(next);
}
```

Expected: all four schedules calculate the next due date in Singapore-local time without overflows.

- [ ] **Step 3: Hook recurrence into completion logic**

```ts
if (todo.is_recurring && todo.recurrence_pattern) {
  const nextTodo = { ...todo, id: undefined, due_date: calculateNextDueDate(todo.due_date, todo.recurrence_pattern), completed: 0 };
  todoDB.create(session.userId, nextTodo);
}
```

Expected: completing a recurring todo creates the next instance with preserved metadata.

- [ ] **Step 4: Run recurring E2E coverage**

Run: `npx playwright test tests/03-recurring-todos.spec.ts`
Expected: daily/weekly/monthly/yearly creation and completion flows pass.

### Task 3: Reminder and notification polling

**Files:**
- Modify: `lib/db.ts`, `app/page.tsx`, `app/api/notifications/check/route.ts`, `lib/hooks/useNotifications.ts`
- Create: `app/api/notifications/check/route.ts`, `lib/hooks/useNotifications.ts`
- Test: `tests/04-reminders-notifications.spec.ts`

**Interfaces:**
- Consumes: due date + `reminder_minutes` metadata from todo items
- Produces: notification trigger selection and browser notifications with deduping

- [ ] **Step 1: Add failing reminder tests**

```ts
expect(getReminderDueAt(todo, 'Asia/Singapore')).toBeCloseTo(...);
```

Expected: failing tests until reminder calculations and duplicate handling are implemented.

- [ ] **Step 2: Implement reminder minutes validation and UI**

```ts
const validReminderMinutes = [15, 30, 60, 120, 1440, 2880, 10080];
```

Expected: dropdowns reflect the allowed values and are disabled when no due date exists.

- [ ] **Step 3: Create notification polling hook**

```ts
useEffect(() => {
  const interval = setInterval(() => fetch('/api/notifications/check'), 30000);
  return () => clearInterval(interval);
}, []);
```

Expected: browser notifications fire on the correct reminder trigger and only once per reminder.

- [ ] **Step 4: Run reminder verification**

Run: `npx playwright test tests/04-reminders-notifications.spec.ts`
Expected: notifications are scheduled and deduplicated appropriately.

### Dependencies and Exit Criteria

- Depends on: Step 2 (Todo CRUD)
- Enables: Subtasks, Tag System, Templates, Search/Filtering, Export/Import, Calendar
- Exit criteria: all three metadata systems work together on the same todo model, with correct validation, badge UI, and scheduling behavior.
