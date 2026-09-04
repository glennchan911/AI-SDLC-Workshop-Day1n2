# Subtasks, Tags & Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Expand the todo model with child-work tracking, tag-based organization, and reusable templates while keeping all child records scoped to the authenticated user.

**Architecture:** Use one-to-many subtasks, many-to-many tag assignments, and a template table that serializes subtasks and metadata to JSON. Each feature reuses the same user-scoped DB contract and UI patterns.

**Tech Stack:** SQLite with foreign keys, JSON serialization for template payloads, React UI state management, REST endpoints.

## Global Constraints

- A todo can have many subtasks; deleting the parent must cascade to child subtasks.
- Tags are unique per user and can be edited without corrupting existing todo associations.
- Templates store a reusable pattern, including its associated subtasks, as serialized JSON.
- Every route must check session presence and use `session.userId` for all queries.

---

### Task 1: Subtasks and progress tracking

**Files:**
- Modify: `lib/db.ts`, `app/page.tsx`
- Create: `app/api/todos/[id]/subtasks/route.ts`, `app/api/subtasks/[id]/route.ts`
- Test: `tests/05-subtasks-progress.spec.ts`

**Interfaces:**
- Consumes: todo id from the base route
- Produces: subtask CRUD plus progress calculation for display bars

- [x] **Step 1: Add failing subtask tests**

```ts
test('user can add multiple subtasks and see progress updates', async ({ page }) => {
  await page.getByRole('button', { name: 'Add subtask' }).click();
  await expect(page.getByText('2 / 2 completed (100%)')).toBeVisible();
});
```

Expected: tests fail before the routes and UI exist.

- [x] **Step 2: Implement the DB layer and API routes**

```ts
export const subtaskDB = {
  create(todoId: number, title: string) { ... },
  update(id: number, patch: Partial<Subtask>) { ... },
  delete(id: number) { ... },
  listByTodo(todoId: number) { ... },
};
```

Expected: subtask records are created and updated in a user-safe, todo-scoped way.

- [x] **Step 3: Add progress UI**

```ts
const progress = (completed / total) * 100;
```

Expected: progress bars and completion counters update in real time as subtasks change state.

- [x] **Step 4: Run subtask verification**

Run: `npx playwright test tests/05-subtasks-progress.spec.ts`
Expected: add/edit/check/delete flows pass and progress values are accurate.

### Task 2: Tag system CRUD and assignment

**Files:**
- Modify: `lib/db.ts`, `app/page.tsx`
- Create: `app/api/tags/route.ts`, `app/api/tags/[id]/route.ts`, `app/api/todos/[id]/tags/route.ts`
- Test: `tests/06-tag-system.spec.ts`

**Interfaces:**
- Consumes: tag list and todo id from the main page
- Produces: tag CRUD actions, assign/remove from todo, filtering by tag

- [x] **Step 1: Add failing tag tests**

```ts
test('can manage tags and assign multiple tags to a todo', async ({ page }) => {
  await page.getByRole('button', { name: 'Manage Tags' }).click();
  await page.getByRole('button', { name: 'Create Tag' }).click();
});
```

Expected: tag creation and assignment do not exist before implementation.

- [x] **Step 2: Implement tag DB and API routes**

```ts
export const tagDB = {
  list(userId: number) { ... },
  create(userId: number, name: string, color: string) { ... },
  update(id: number, patch: Partial<Tag>) { ... },
  delete(id: number) { ... },
};
```

Expected: tags are unique per user and removing a tag removes its join rows from todos.

- [x] **Step 3: Add UI modal and todo-badge assignment**

```tsx
{todo.tags?.map(tag => <span key={tag.id} className="tag" style={{ background: tag.color }}>{tag.name}</span>)}
```

Expected: Manage Tags modal supports create/edit/delete and todo forms support multiple tag selection.

- [x] **Step 4: Run tag verification**

Run: `npx playwright test tests/06-tag-system.spec.ts`
Expected: all tag-related CRUD behaviors and filter interactions pass.

### Task 3: Template system reuse flow

**Files:**
- Modify: `lib/db.ts`, `app/page.tsx`
- Create: `app/api/templates/route.ts`, `app/api/templates/[id]/route.ts`, `app/api/templates/[id]/use/route.ts`
- Test: `tests/07-template-system.spec.ts`

**Interfaces:**
- Consumes: todo metadata and serialized subtask arrays
- Produces: reusable template creation + application to make new todos from a pattern

- [x] **Step 1: Add failing template tests**

```ts
test('template can create a todo with subtasks and due offset', async ({ page }) => {
  await page.getByRole('button', { name: 'Use Template' }).click();
});
```

Expected: tests fail until templates exist.

- [x] **Step 2: Implement template DB and JSON serialization**

```ts
const serialized = JSON.stringify(subtasks.map((s, index) => ({ title: s.title, position: index })));
```

Expected: template payloads store their pattern in a consistent structure that can later be used to make a new todo.

- [x] **Step 3: Add `/use` logic and UI actions**

```ts
const newTodo = todoDB.create(session.userId, {
  title: template.title,
  due_date: addDays(today, template.offset_days),
  priority: template.priority,
});
```

Expected: a template can generate a new todo with the right metadata and subtasks.

- [x] **Step 4: Run template verification**

Run: `npx playwright test tests/07-template-system.spec.ts`
Expected: all template CRUD and reuse flows pass.

### Dependencies and Exit Criteria

- Depends on: Steps 1 and 2
- Enables: Search/Filtering, Export/Import, Calendar
- Exit criteria: subtasks, tags, and templates all work on top of the todo model without interfering with one another.

## Execution Notes

- Implemented as planned: `subtasks`, `tags`, `todo_tags`, and `templates` tables added to `lib/db.ts` with `PRAGMA foreign_keys = ON` and cascading deletes; `subtaskDB`, `tagDB`, `templateDB` helper objects added.
- Added pure-function unit test coverage (`lib/subtasks.ts`, `lib/tags.ts`, `lib/templates.ts` with `tests/unit/*.test.ts`, 15 tests, run via `npm run test:unit`) in addition to the Playwright e2e specs called for by the plan.
- All 8 API routes implemented exactly as scoped (subtasks, tags, tag assignment, templates, template use).
- UI implemented in `components/TodoApp.tsx` (this project's `app/page.tsx` renders `TodoApp`, so UI changes landed there instead of directly in `app/page.tsx`): `TodoTags`, `TodoSubtasks`, `TagModal`, `TemplateModal`, `SaveTemplateModal` components, plus "Manage Tags" and "Templates" toolbar buttons.
- Bug found/fixed during e2e verification: the tag badge rendered its name and the remove ("×") button as sibling text nodes in the same `<span>`, so accessible/text-based queries picked up "Urgent×" instead of "Urgent". Fixed by wrapping the tag name in its own inner `<span>`. Also fixed a pre-existing `SaveTemplateModal` accessibility bug where the due-date-offset `<label>` had no `htmlFor`/`id` link to its `<input>`.
- Final verification: `npx tsc --noEmit` clean, `npx eslint .` clean, unit tests 15/15 passing, full Playwright suite (plans 04 + 05 combined) 30/30 passing.
