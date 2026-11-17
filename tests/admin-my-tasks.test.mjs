import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildSync } from "esbuild";
import {
  ownTaskRows,
  myTaskStatus,
  myTaskStatusOptions,
  filterMyTasks,
  paginateMyTasks,
  shouldRecommendSrs,
  ownTaskDetail,
  selectedOwnTaskDetail,
} from "../src/admin-my-tasks-model.ts";

const actor = "verified-admin-user-id";
const personName = (id) => (id === actor ? "Ada Admin" : "Other person");
const task = (id, extra = {}) => ({
  id,
  title: "Task " + id,
  ownerId: actor,
  status: "active",
  ...extra,
});
const project = () => ({
  id: "project-one",
  isAdmin: true,
  tasks: [
    task("own"),
    task("other", { ownerId: "other-user", title: "OTHER PRIVATE TASK" }),
  ],
  documents: [
    {
      id: "own-doc",
      ownerId: actor,
      taskId: "own",
      title: "Own research",
      workingVersion: 3,
      versions: [
        { version: 1, status: "approved", content: "  Approved exact\n" },
        { version: 2, status: "returned", content: "Returned exact" },
        { version: 3, status: "draft", content: "Working exact" },
      ],
    },
    {
      id: "other-owner",
      ownerId: "other-user",
      taskId: "own",
      title: "OTHER OWNER DOCUMENT",
      versions: [{ version: 1, content: "PRIVATE OWNER CONTENT" }],
    },
    {
      id: "other-task",
      ownerId: actor,
      taskId: "different",
      title: "OTHER TASK DOCUMENT",
      versions: [{ version: 1, content: "PRIVATE TASK CONTENT" }],
    },
    {
      id: "missing-task",
      ownerId: actor,
      title: "UNLINKED DOCUMENT",
      versions: [{ version: 1, content: "UNLINKED CONTENT" }],
    },
  ],
});
const source = readFileSync(
  new URL("../src/AdminMyTasks.tsx", import.meta.url),
  "utf8",
);
const filename = fileURLToPath(
  new URL("./admin-my-tasks.fixture.cjs", import.meta.url),
);
const require = createRequire(import.meta.url);
const output = buildSync({
  stdin: {
    contents: source + "\nexport { MyTasksTable, TaskDetailDialog };",
    sourcefile: "AdminMyTasks.tsx",
    loader: "tsx",
    resolveDir: fileURLToPath(new URL("../src", import.meta.url)),
  },
  jsx: "automatic",
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  external: ["react"],
  loader: { ".css": "empty" },
}).outputFiles[0].text;
function load(react = React) {
  const module = new Module(filename);
  module.filename = filename;
  module.paths = require.resolve.paths("react");
  module.require = (id) => (id === "react" ? react : require(id));
  module._compile(output, filename);
  return module.exports;
}
const { AdminMyTasks, MyTasksTable, TaskDetailDialog } = load();
const render = (p, actorId = actor) =>
  renderToStaticMarkup(
    React.createElement(AdminMyTasks, { p, actorId, personName }),
  );
const detailOf = (p) =>
  ownTaskDetail(p, actor, ownTaskRows(p, actor)[0]?.key, personName);
const renderDetail = (detail) =>
  renderToStaticMarkup(
    React.createElement(TaskDetailDialog, { detail, onClose() {} }),
  );
function elements(tree) {
  const found = [];
  function visit(node) {
    if (!React.isValidElement(node)) return;
    found.push(node);
    React.Children.forEach(node.props.children, visit);
  }
  visit(tree);
  return found;
}
function interactive(p = project(), actorId = actor, extra = {}) {
  let slots = [],
    hookIndex = 0,
    idIndex = 0;
  const exports = load({
    ...React,
    useState(initial) {
      const index = hookIndex++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value) => {
          slots[index] =
            typeof value === "function" ? value(slots[index]) : value;
        },
      ];
    },
    useId() {
      return "test-id-" + idIndex++;
    },
  });
  return {
    render(nextP = p, nextActor = actorId) {
      p = nextP;
      actorId = nextActor;
      hookIndex = 0;
      idIndex = 0;
      return exports.AdminMyTasks({ p, actorId, personName, ...extra });
    },
    table(tree) {
      return elements(tree).find((node) => node.type === exports.MyTasksTable);
    },
    dialog(tree) {
      return elements(tree).find(
        (node) => node.type === exports.TaskDetailDialog,
      );
    },
  };
}

test("strict ownership never broadens via project Admin, role, assignee aliases or selected work", () => {
  const p = project();
  p.tasks.push(
    task("alias", { ownerId: undefined, assigneeId: actor, roles: ["Admin"] }),
  );
  p.tasks.push(task("unowned", { ownerId: null }));
  p.tasks.push(task("case", { ownerId: actor.toUpperCase() }));
  p.tasks.push(task("spacing", { ownerId: actor + " " }));
  p.workSelections = { [actor]: { selectedTaskIds: ["other"] } };
  assert.deepEqual(
    ownTaskRows(p, actor).map((row) => row.id),
    ["own"],
  );
  for (const invalid of ["", " ", undefined, null, 0, false])
    assert.deepEqual(ownTaskRows(p, invalid), []);
  assert.deepEqual(ownTaskRows(p, "admin"), []);
});
test("other owners' titles, statuses and descriptions never enter rows or status filters", () => {
  const p = project();
  p.tasks[1].status = "OTHER SECRET STATUS";
  p.tasks[1].description = "OTHER SECRET DESCRIPTION";
  const rows = ownTaskRows(p, actor, personName);
  assert.equal(rows[0].responsible, "Ada Admin");
  assert.deepEqual(myTaskStatusOptions(rows), [
    { key: "all", label: "All" },
    { key: "status:active", label: "Active" },
  ]);
  assert.doesNotMatch(JSON.stringify(rows), /OTHER|other-user/);
});
test("statuses use explicit recorded values; missing/false completion remains Unknown", () => {
  for (const completed of [false, "true", 1, null, undefined])
    assert.equal(myTaskStatus({ completed }).label, "Unknown");
  assert.equal(myTaskStatus({ completed: true }).label, "Complete");
  assert.equal(
    myTaskStatus({ status: "active", completed: true }).label,
    "Active",
  );
  assert.equal(
    myTaskStatus({ status: "complete", completed: false }).label,
    "Complete",
  );
  assert.equal(myTaskStatus({ status: "completed" }).key, "status:complete");
  assert.equal(myTaskStatus({ status: "available" }).label, "Available");
  assert.equal(myTaskStatus({ status: "in_progress" }).label, "In progress");
  assert.equal(myTaskStatus({ status: "not_started" }).label, "Not started");
  assert.equal(myTaskStatus({ status: "blocked" }).label, "Blocked");
  assert.equal(
    myTaskStatus({ status: "custom state" }).label,
    "Recorded: custom state",
  );
  assert.equal(
    myTaskStatus({ status: " Active " }).label,
    "Recorded:  Active ",
  );
});
test("missing and duplicate task identifiers remain visible but cannot open ambiguous document relationships", () => {
  const p = {
    tasks: [
      null,
      {},
      task(undefined),
      task("duplicate"),
      task("duplicate", { ownerId: "other" }),
      task("valid"),
    ],
    documents: [],
  };
  const rows = ownTaskRows(p, actor);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((row) => row.canOpen),
    [false, false, true],
  );
  assert.equal(new Set(rows.map((row) => row.key)).size, 3);
  assert.equal(ownTaskDetail(p, actor, rows[0].key), null);
  assert.equal(ownTaskDetail(p, actor, rows[1].key), null);
  assert.equal(ownTaskDetail(p, actor, "made-up-key"), null);
});
test("search and status filters are local, intersect, preserve order and never mutate records", () => {
  const p = {
    tasks: [
      task("1", { title: "SRS outline", status: "active" }),
      task("2", { title: "SRS review", status: "complete" }),
      task("3", { title: "Plan review", status: "complete" }),
    ],
  };
  const before = structuredClone(p),
    rows = ownTaskRows(p, actor);
  assert.deepEqual(
    filterMyTasks(rows, " sRs ", "status:complete").map((row) => row.id),
    ["2"],
  );
  assert.equal(filterMyTasks(rows, "no match").length, 0);
  assert.equal(filterMyTasks(rows, "", "unknown-filter").length, 0);
  assert.deepEqual(p, before);
  assert.equal(rows.length, 3);
});
test("pagination defaults to six, supports twelve/twenty-four, clamps bounds and has honest zero counts", () => {
  const rows = ownTaskRows(
    { tasks: Array.from({ length: 25 }, (_, i) => task(String(i))) },
    actor,
  );
  assert.deepEqual(
    paginateMyTasks(rows, 2).rows.map((row) => row.id),
    ["6", "7", "8", "9", "10", "11"],
  );
  assert.equal(paginateMyTasks(rows, 1, 12).rows.length, 12);
  assert.equal(paginateMyTasks(rows, 1, 24).rows.length, 24);
  assert.equal(paginateMyTasks(rows, 999).page, 5);
  for (const page of [-1, 0, NaN, 1.5, "2"])
    assert.equal(paginateMyTasks(rows, page).page, 1);
  for (const size of [0, -1, NaN, 100, 1.5, "12"])
    assert.equal(paginateMyTasks(rows, 1, size).pageSize, 6);
  const empty = paginateMyTasks([]);
  assert.equal(empty.from, 0);
  assert.equal(empty.to, 0);
  assert.equal(empty.total, 0);
  assert.equal(empty.hasPrevious, false);
  assert.equal(empty.hasNext, false);
  assert.equal(rows.length, 25);
});
test("SRS recommendation is separate and only absent explicit own SRS names suppress it", () => {
  assert.equal(shouldRecommendSrs({ tasks: [] }, actor), true);
  for (const title of [
    "SRS",
    "Software Requirements Specification",
    "Software Requirements Specification (SRS)",
    " software  requirements specification (srs) ",
  ])
    assert.equal(
      shouldRecommendSrs({ tasks: [task("srs", { title })] }, actor),
      false,
      title,
    );
  assert.equal(
    shouldRecommendSrs(
      { tasks: [task("srs", { title: "SRS", ownerId: "other" })] },
      actor,
    ),
    true,
  );
  assert.equal(
    shouldRecommendSrs(
      { tasks: [], documents: [{ title: "SRS", ownerId: actor }] },
      actor,
    ),
    true,
  );
  assert.equal(
    shouldRecommendSrs(
      { tasks: [task("non-srs", { title: "Research" })] },
      actor,
    ),
    true,
  );
  for (const p of [{}, { tasks: null }, { tasks: {} }])
    assert.equal(shouldRecommendSrs(p, actor), false);
  assert.equal(shouldRecommendSrs({ tasks: [] }, ""), false);
});
test("detail requires both task ownership and document ownership with exact taskId, not documentIds aliases", () => {
  const p = project();
  p.tasks[0].documentIds = ["other-owner", "other-task", "missing-task"];
  const detail = detailOf(p);
  assert.equal(detail.task.id, "own");
  assert.deepEqual(
    detail.documents.map((doc) => doc.title),
    ["Own research"],
  );
  assert.deepEqual(
    detail.documents[0].versions.map((v) => [v.version, v.status, v.content]),
    [
      ["v1", "approved", "  Approved exact\n"],
      ["v2", "returned", "Returned exact"],
      ["v3", "draft", "Working exact"],
    ],
  );
  assert.equal(
    ownTaskDetail(p, "other-user", ownTaskRows(p, actor)[0].key),
    null,
  );
});
test("detail uses recorded version arrays, never infers latest content from workingVersion or top-level document content", () => {
  const p = project(),
    doc = p.documents[0];
  Object.defineProperty(doc, "workingVersion", {
    get() {
      throw new Error("workingVersion read");
    },
  });
  Object.defineProperty(doc, "content", {
    get() {
      throw new Error("current content read");
    },
  });
  Object.defineProperty(p, "deliveries", {
    get() {
      throw new Error("delivery read");
    },
  });
  const detail = detailOf(p);
  assert.equal(detail.documents[0].versions.length, 3);
});
test("actor/project refresh or ownership change invalidates the open selection before rendering content", () => {
  const p = project(),
    key = ownTaskRows(p, actor)[0].key;
  const selection = { project: p, actorId: actor, key };
  assert.equal(selectedOwnTaskDetail(p, actor, selection).task.id, "own");
  assert.equal(selectedOwnTaskDetail({ ...p }, actor, selection), null);
  assert.equal(selectedOwnTaskDetail(p, "other-user", selection), null);
  p.tasks[0].ownerId = "other-user";
  assert.equal(selectedOwnTaskDetail(p, actor, selection), null);
});
test("malformed documents, missing versions and empty content are represented honestly", () => {
  const p = {
    tasks: [task("own")],
    documents: [
      null,
      {
        ownerId: actor,
        taskId: "own",
        versions: [
          null,
          { version: "1", content: null },
          { version: 2, content: "" },
        ],
      },
      { ownerId: actor, taskId: "own" },
    ],
  };
  const detail = detailOf(p);
  assert.equal(detail.documents.length, 2);
  assert.equal(detail.documents[0].title, "Document title not recorded");
  assert.deepEqual(
    detail.documents[0].versions.map((v) => [v.version, v.status, v.content]),
    [
      ["Version not recorded", "Unknown", null],
      ["v2", "Unknown", ""],
    ],
  );
  assert.deepEqual(detail.documents[1].versions, []);
  assert.equal(detailOf({ tasks: [task("own")] }).documentsAvailable, false);
});
test("all projections preserve input including frozen arrays and do not consult the clock", () => {
  const p = project(),
    before = structuredClone(p);
  Object.freeze(p.tasks);
  Object.freeze(p.documents);
  const now = Date.now;
  Date.now = () => {
    throw new Error("clock consulted");
  };
  try {
    ownTaskRows(p, actor);
    detailOf(p);
    shouldRecommendSrs(p, actor);
    filterMyTasks(ownTaskRows(p, actor), "Task");
    paginateMyTasks(ownTaskRows(p, actor));
  } finally {
    Date.now = now;
  }
  assert.deepEqual(p, before);
});
test("table matches approved five-column layout, with local controls and disabled Add task", () => {
  const html = render(project());
  for (const text of [
    "My Tasks",
    "Search my tasks…",
    "Status: All",
    "Task",
    "Work status",
    "Action",
    "Open",
    "Rows: 6",
    "Page 1 of 1",
  ])
    assert.ok(html.includes(text), text);
  assert.equal((html.match(/scope="col"/g) || []).length, 5);
  assert.doesNotMatch(html, /Responsible|OTHER PRIVATE TASK/);
  assert.match(html, /Not created or saved/);
  assert.match(
    html,
    /<button type="button" disabled="">Add Selected Tasks<\/button>/,
  );
  assert.match(html, /<button type="submit" disabled="">/);
  assert.match(html, /aria-label="Task pages"/);
  assert.match(html, /Showing 1–1 of 1 tasks/);
});
test("missing status renders Unknown; no assigned tasks and unavailable records are distinct", () => {
  assert.match(
    render({
      tasks: [task("missing", { status: undefined, completed: false })],
    }),
    /Unknown/,
  );
  const html = render({ tasks: [] });
  assert.match(html, /No tasks assigned to you/);
  assert.match(html, /Task suggestions/);
  assert.match(html, /Not created/);
  assert.doesNotMatch(html, /<tbody>|scope="row"/);
  assert.match(render({}), /Task records not available/);
  assert.doesNotMatch(render({}), /Not created/);
  assert.match(render({ tasks: [] }, ""), /Current user not available/);
});
test("dialog renders only owned exact versions, escapes all author text and offers no mutation controls", () => {
  const p = project(),
    malicious = '<img src="https://bad.test/pixel"><script>alert(1)</script>';
  p.tasks[0].title = malicious;
  p.tasks[0].description = malicious;
  p.documents[0].title = malicious;
  p.documents[0].versions[2].content = malicious + "\n  exact spacing  ";
  const html = renderDetail(detailOf(p));
  assert.match(html, /<dialog[^>]*aria-labelledby=/);
  assert.match(html, /Read only/);
  assert.match(html, /Responsible/);
  assert.match(html, /Ada Admin/);
  assert.match(html, /v1 · approved/);
  assert.match(html, /v3 · draft/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /\n  exact spacing  <\/pre>/);
  assert.doesNotMatch(
    html,
    /<script|<img|<iframe|href=|<input|<textarea|<select|PRIVATE OWNER|PRIVATE TASK|UNLINKED|Save|Submit|Complete task/,
  );
  assert.equal((html.match(/<button/g) || []).length, 1);
});
test("local table Open passes its own selected row and disabled ambiguous rows do nothing", () => {
  const p = { tasks: [task("own"), task(undefined)] },
    rows = ownTaskRows(p, actor),
    opened = [];
  const tree = MyTasksTable({ rows, onOpen: (row) => opened.push(row) });
  const buttons = elements(tree).filter((node) => node.type === "button");
  buttons[0].props.onClick();
  buttons[1].props.onClick();
  assert.deepEqual(opened, [rows[0]]);
});
test("interactive search/status/page-size reset pagination without changing the project", () => {
  const p = {
    tasks: Array.from({ length: 13 }, (_, i) =>
      task(String(i), {
        title: "Work " + i,
        status: i % 2 ? "complete" : "active",
      }),
    ),
  };
  const before = structuredClone(p),
    ui = interactive(p);
  let tree = ui.render();
  assert.equal(ui.table(tree).props.rows[0].id, "0");
  elements(tree)
    .find(
      (node) => node.type === "button" && node.props.children?.[0] === "Next ",
    )
    .props.onClick();
  tree = ui.render();
  assert.equal(ui.table(tree).props.rows[0].id, "6");
  const search = elements(tree).find(
    (node) => node.type === "input" && node.props.type === "search",
  );
  search.props.onChange({ target: { value: "Work 1" } });
  tree = ui.render();
  assert.deepEqual(
    ui.table(tree).props.rows.map((row) => row.id),
    ["1", "10", "11", "12"],
  );
  elements(tree)
    .find((node) => node.type === "select" && node.props.value === "all")
    .props.onChange({ target: { value: "status:complete" } });
  tree = ui.render();
  assert.deepEqual(
    ui.table(tree).props.rows.map((row) => row.id),
    ["1", "11"],
  );
  elements(tree)
    .find((node) => node.type === "select" && node.props.value === 6)
    .props.onChange({ target: { value: "12" } });
  tree = ui.render();
  assert.ok(
    elements(tree).some(
      (node) => node.type === "select" && node.props.value === 12,
    ),
  );
  assert.deepEqual(p, before);
});
test("interactive Open is local and loses access after actor or project changes", () => {
  const p = project(),
    ui = interactive(p);
  let tree = ui.render();
  ui.table(tree).props.onOpen(ui.table(tree).props.rows[0]);
  tree = ui.render();
  assert.equal(ui.dialog(tree).props.detail.task.id, "own");
  assert.equal(ui.dialog(ui.render({ ...p })), undefined);
  assert.equal(ui.dialog(ui.render(p, "other-user")), undefined);
});
test("styles are scoped, responsive, use Astra identity and contain no font below fourteen pixels", () => {
  const css = readFileSync(
    new URL("../src/admin-my-tasks.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /Montserrat/);
  assert.match(css, /Open Sans/);
  assert.match(css, /var\(--astra-/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media/);
  for (const [, value] of css.matchAll(/font-size:\s*(\d+)px/g))
    assert.ok(Number(value) >= 14);
  assert.doesNotMatch(
    css,
    /(^|\n)(body|table|button|dialog|input|:root)\s*[{,]/,
  );
});
test("component and model expose no API, editor navigation, provider, persistence or write action", () => {
  for (const file of ["AdminMyTasks.tsx", "admin-my-tasks-model.ts"]) {
    const text = readFileSync(
      new URL("../src/" + file, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      text,
      /\bfetch\s*\(|XMLHttpRequest|\/api\/|supabase|localStorage|sessionStorage|indexedDB|dangerouslySetInnerHTML|window\.open|location\.|history\.(?:push|replace)|createTask|saveDraft|submitDocuments|completeTask|onAction|onCreate/,
    );
  }
  assert.match(source, /showModal\(\)/);
  assert.match(source, /returnFocus\.focus\(\)/);
});

test("unknown task records or actor do not masquerade as a known zero count", () => {
  for (const [p, actorId] of [
    [{}, actor],
    [{ tasks: null }, actor],
    [{ tasks: {} }, actor],
    [{ tasks: [] }, ""],
    [{ tasks: [] }, null],
    [{ tasks: [] }, 42],
  ]) {
    const html = render(p, actorId);
    assert.doesNotMatch(html, /Showing|Page 1 of 1|Task pages|Rows per page/);
    assert.doesNotMatch(html, /Not created/);
  }
  const empty = render({ tasks: [] });
  assert.match(empty, /Showing 0–0 of 0 tasks/);
  assert.match(empty, /Task pages/);
});

test("SRS visual checkbox toggles without creating a task, opening detail or persisting selection", () => {
  const p = { id: "visual-project", tasks: [], documents: [] },
    before = structuredClone(p);
  const ui = interactive(p);
  const checkbox = (tree) =>
    elements(tree).find(
      (node) => node.type === "input" && node.props.type === "checkbox",
    );
  assert.equal(checkbox(ui.render()).props.checked, false);
  checkbox(ui.render()).props.onChange({ target: { checked: true } });
  assert.equal(checkbox(ui.render()).props.checked, true);
  assert.equal(ui.table(ui.render()), undefined);
  assert.equal(ui.dialog(ui.render()), undefined);
  assert.deepEqual(p, before);
  checkbox(ui.render()).props.onChange({ target: { checked: false } });
  assert.equal(checkbox(ui.render()).props.checked, false);
  checkbox(ui.render()).props.onChange({ target: { checked: true } });
  assert.equal(checkbox(ui.render({ ...p })).props.checked, false);
  assert.equal(checkbox(ui.render(p, "another-actor")).props.checked, false);
  assert.equal(checkbox(interactive(p).render()).props.checked, false);
});

test("only honest predefined SRS suggestion is shown, without AI or dummy task claims", () => {
  const p = { tasks: [], documents: [] }, ui = interactive(p);
  const boxes = (tree) => elements(tree).filter(n => n.type === "input" && n.props.type === "checkbox");
  assert.equal(boxes(ui.render()).length, 1);
  boxes(ui.render())[0].props.onChange({target:{checked:true}});
  assert.equal(boxes(ui.render())[0].props.checked, true);
  assert.deepEqual(p, {tasks:[],documents:[]});
  const html=render(p);
  assert.match(html, /Task suggestions/);
  assert.match(html, /predefined suggestion, not generated by AI/);
  assert.match(html, /Selecting a name does not save a task/);
  assert.doesNotMatch(html, /AI Recommended Tasks|Task Two|Task Three|Task Four/);
  assert.equal((html.match(/type="checkbox"/g)||[]).length,1);
});

test("custom Add only adds an unchecked local name, rejects duplicate names, and never changes project tasks", () => {
  const p = { id: "custom-preview", tasks: [], documents: [] },
    before = structuredClone(p),
    ui = interactive(p);
  const input = (tree) =>
    elements(tree).find(
      (n) =>
        n.type === "input" &&
        n.props.placeholder === "Enter a custom task name",
    );
  const submit = () =>
    elements(ui.render())
      .find((n) => n.type === "form")
      .props.onSubmit({ preventDefault() {} });
  const boxes = () =>
    elements(ui.render()).filter(
      (n) => n.type === "input" && n.props.type === "checkbox",
    );
  input(ui.render()).props.onChange({ target: { value: "  My own note  " } });
  submit();
  assert.equal(boxes().length, 2);
  assert.equal(boxes()[1].props.checked, false);
  assert.equal(input(ui.render()).props.value, "");
  input(ui.render()).props.onChange({ target: { value: "my own note" } });
  submit();
  assert.equal(boxes().length, 2);
  assert.ok(elements(ui.render()).some((n) => n.props.role === "alert"));
  assert.equal(ui.table(ui.render()), undefined);
  assert.equal(ui.dialog(ui.render()), undefined);
  assert.deepEqual(p, before);
  assert.equal(
    elements(ui.render({ ...p })).filter(
      (n) => n.type === "input" && n.props.type === "checkbox",
    ).length,
    1,
  );
});

test("task dates preserve independent recorded values and label only explicit examples", () => {
  const p = {
    tasks: [
      task("dated", {
        createdAt: "2027-03-12T09:00:00Z",
        updatedAt: "2027-03-14T16:00:00Z",
      }),
      task("missing", { createdAt: "bad" }),
    ],
  };
  const rows = ownTaskRows(p, actor);
  assert.equal(rows[0].createdAt, "2027-03-12T09:00:00Z");
  assert.equal(rows[0].updatedAt, "2027-03-14T16:00:00Z");
  assert.equal(rows[1].updatedAt, null);
  const html = render(p);
  assert.match(html, /Created/);
  assert.match(html, /Last Updated/);
  assert.match(html, /Mar 12, 2027/);
  assert.match(html, /Mar 14, 2027/);
  assert.match(html, /Not recorded/);
  assert.doesNotMatch(html, /my-tasks-example-date/);
  const example = render({
    tasks: [task("sample", { createdAt: "2027-03-13", exampleDates: true })],
  });
  assert.match(example, /my-tasks-example-date/);
  assert.match(example, /Example/);
});


test("explicit submit preserves creation callback and title payload without local task insertion", () => {
  const p={id:"callback-project",tasks:[],documents:[]}, calls=[];
  const ui=interactive(p,actor,{onAddSelectedTasks:titles=>calls.push([...titles]),taskCreationState:{scope:"test",busy:false,blocked:false,message:"Ready"}});
  const boxes=()=>elements(ui.render()).filter(n=>n.type==="input"&&n.props.type==="checkbox");
  boxes()[0].props.onChange({target:{checked:true}});
  assert.deepEqual(calls,[]);
  const submit=elements(ui.render()).find(n=>n.type==="button"&&n.props.children==="Add Selected Tasks");
  assert.equal(!!submit.props.disabled,false);
  submit.props.onClick();
  assert.deepEqual(calls,[["Software Requirements Specification (SRS)"]]);
  assert.deepEqual(p.tasks,[]);
});
