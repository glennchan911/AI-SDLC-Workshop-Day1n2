# Search, Filtering & Export/Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Provide powerful user-driven filtering and safe data export/import so the todo app is usable at scale and data can be moved between environments.

**Architecture:** Use pure filter functions for the client-side search logic and keep the export/import flow server-side with transaction-safe ID remapping. This keeps UI logic readable and prevents accidental data corruption.

**Tech Stack:** Next.js API routes, SQLite, React client filtering, JSON export/import transaction handling.

## Global Constraints

- Search/filter logic must be deterministic and pure.
- Export/Import must preserve relationships between todos, subtasks, and tags while remapping IDs correctly.
- Validation must reject malformed payloads or crossed-user data.
- UI filter state and badge indicators should remain easy to reason about and not depend on hidden mutation.

> **Execution note:** This plan was implemented standalone, without plan 04 (subtasks/tags/templates), which has not
> been built yet in this codebase. Tag-based filtering and subtask/tag export fields were descoped; the export
> payload is versioned (`version: 1`) so those fields can be added later without breaking existing exports.

---

### Task 1: Search and filter state

**Files:**
- Modify: `app/page.tsx`
- Test: `tests/08-search-filtering.spec.ts`

**Interfaces:**
- Consumes: todos, tags, status, priority, and text query state
- Produces: filtered `visibleTodos` array plus UI filter chips/clear actions

- [x] **Step 1: Add failing filtering tests**

```ts
test('filter by priority and tag', async ({ page }) => {
  await page.getByLabel('Priority').selectOption('high');
  await page.getByRole('button', { name: 'Filter by Work' }).click();
  await expect(page.getByText('Project Launch')).toBeVisible();
});
```

Expected: filter logic fails until state and UI are implemented.

- [x] **Step 2: Implement pure filter functions**

```ts
function applyFilters(todos: Todo[], filter: FilterState) {
  return todos.filter(todo =>
    matchesText(todo, filter.query) &&
    matchesPriority(todo, filter.priority) &&
    matchesTag(todo, filter.tagId) &&
    matchesStatus(todo, filter.completed)
  );
}
```

Expected: filter order is consistent and works as a pure transformation of the source list.

- [x] **Step 3: Add filter UI chips and clear controls**

```tsx
<button onClick={() => setFilter({ ...filter, tagId: null })}>Clear tag</button>
```

Expected: users can see which filters are active and clear them without resetting the whole page.

- [x] **Step 4: Run search/filter verification**

Run: `npx playwright test tests/08-search-filtering.spec.ts`
Expected: text, priority, tag, and status filters all pass.

### Task 2: Export and import API contract

**Files:**
- Create: `app/api/todos/export/route.ts`, `app/api/todos/import/route.ts`
- Modify: `lib/db.ts`
- Test: `tests/09-export-import.spec.ts`

**Interfaces:**
- Consumes: user-scoped todo data, subtasks, and tags
- Produces: JSON payload with remapped IDs and relationship preservation between records

- [x] **Step 1: Write failing export/import tests**

```ts
test('exported JSON imports cleanly and remaps ids', async ({ page }) => {
  const payload = await page.evaluate(() => fetch('/api/todos/export').then(r => r.json()));
  expect(payload.todos.length).toBeGreaterThan(0);
});
```

Expected: tests fail until the export/import route and remap logic are implemented.

- [x] **Step 2: Implement export payload**

```ts
return NextResponse.json({
  todos: todoRows,
  subtasks: subtaskRows,
  tags: tagRows,
  relationships: { todo_tags: joinRows }
});
```

Expected: export includes all necessary objects for safe round-tripping.

- [x] **Step 3: Implement import remapping and transaction safety**

```ts
const idMap = { todos: new Map(), subtasks: new Map(), tags: new Map() };
```

Expected: imported records re-attach to the correct user without colliding with existing IDs or orphaning relationships.

- [x] **Step 4: Run export/import verification**

Run: `npx playwright test tests/09-export-import.spec.ts`
Expected: export rounds trip successfully and malformed payloads are rejected.

### Dependencies and Exit Criteria

- Depends on: Steps 2, 3, and 4
- Enables: Calendar + final polish + validation
- Exit criteria: filtering is reliable, import/export is transaction-safe, and all user-scoped records remain consistent.
