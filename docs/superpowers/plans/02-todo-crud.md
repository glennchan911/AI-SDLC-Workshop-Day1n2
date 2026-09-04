# Todo CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-KILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the base todo resource and its user-facing list workflow so every later todo feature sits on a stable CRUD foundation.

**Architecture:** Use a single `todos` table with `user_id`, validation, sorting, and sectioning. Build the API contract first, then connect the main client page to read and mutate todos through authenticated endpoints.

**Tech Stack:** Next.js App Router, SQLite, React client-state for the main page, `fetch`-based API calls, Singapore timezone validation.

## Global Constraints

- `lib/db.ts` remains the central source of the database contract and CRUD methods.
- API routes must check the authenticated session before all DB interactions.
- Todo creation must trim title input, reject empty values, and enforce due-date minimum logic.
- Todos are sorted by priority and due date before grouping into sections.
- Completed todos are separated from active tasks in the UI.

---

### Task 1: Extend the database and route contract

**Files:**
- Modify: `lib/db.ts`
- Create: `app/api/todos/route.ts`, `app/api/todos/[id]/route.ts`
- Test: `tests/02-todo-crud.spec.ts`

**Interfaces:**
- Consumes: auth session helpers from Step 1
- Produces: `createTodo`, `getTodosByUser`, `getTodoById`, `updateTodo`, `deleteTodo`

- [ ] **Step 1: Add failing tests for todo CRUD**

```ts
test('user can create a todo with title only', async ({ page }) => {
  await page.getByPlaceholder('Add a new todo').fill('Read PRD');
  await page.getByRole('button', { name: 'Add Todo' }).click();
  await expect(page.getByText('Read PRD')).toBeVisible();
});
```

Expected: tests fail until the todo API and UI exist.

- [ ] **Step 2: Implement DB methods and validation**

```ts
// lib/db.ts
export const todoDB = {
  create(userId: number, input: Partial<Todo>) { ... },
  list(userId: number) { ... },
  getById(userId: number, id: number) { ... },
  update(userId: number, id: number, patch: Partial<Todo>) { ... },
  delete(userId: number, id: number) { ... },
};
```

Expected: user-scoped queries return only that user’s todos and delete cascades to dependent records.

- [ ] **Step 3: Implement the todo API routes**

```ts
// app/api/todos/route.ts
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const body = await request.json();
  const todo = todoDB.create(session.userId, body);
  return NextResponse.json(todo);
}
```

Expected: create/read/update/delete endpoints are all protected and return JSON payloads.

- [ ] **Step 4: Validate plus route behavior**

Run: `npx playwright test tests/02-todo-crud.spec.ts --grep "Create todo"`
Expected: create and read operations work, and invalid due dates get blocked.

### Task 2: Build the main todo UI flow

**Files:**
- Modify: `app/page.tsx`
- Create: `components/` as needed for forms or list sections

**Interfaces:**
- Consumes: `GET /api/todos` and `POST/PUT/DELETE /api/todos`
- Produces: renderable todo list with Overdue/Active/Completed sections

- [ ] **Step 1: Implement list fetch and state hydration**

```ts
useEffect(() => {
  fetch('/api/todos').then((res) => res.json()).then(setTodos);
}, []);
```

Expected: the main page loads todos from the authenticated API once the user is signed in.

- [ ] **Step 2: Add create and delete actions**

```ts
async function handleAddTodo() {
  const res = await fetch('/api/todos', { method: 'POST', body: JSON.stringify({ title, dueDate, priority }) });
}
```

Expected: new todos appear immediately in the right section and delete removes the row cleanly.

- [ ] **Step 3: Add edit/toggle completion and sections**

```ts
const grouped = {
  overdue: todos.filter(t => !t.completed && isOverdue(t)),
  active: todos.filter(t => !t.completed && !isOverdue(t)),
  completed: todos.filter(t => t.completed),
};
```

Expected: completion toggles move items between sections and sorting remains deterministic.

- [ ] **Step 4: Run the todo CRUD E2E suite**

Run: `npx playwright test tests/02-todo-crud.spec.ts`
Expected: create/edit/toggle/delete flows all pass with validation in place.

### Dependencies and Exit Criteria

- Depends on: Step 1 (Foundation & Authentication)
- Enables: Priority, Recurring, Reminders, Subtasks, Tags, Templates, Search, Export, Calendar
- Exit criteria: authenticated users can create, read, update, complete, and delete todos; validation is enforced; UI sections work as intended.
