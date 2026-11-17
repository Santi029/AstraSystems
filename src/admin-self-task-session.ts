import {
  addAdminOwnTasks,
  isConfirmedOwnTasksResult,
} from "./admin-self-tasks.ts";
import { createBackendContract } from "./backend-contract.ts";

/** Isolated mock-integration controller. Never imported by the production entrypoint. */
type State = {
  demo: false;
  revision: number;
  currentActor: { id: string };
  projects: Array<Record<string, unknown> & { id: string }>;
};
export type MockReply = {
  environment: "isolated-self-task-mock";
  status: number;
  ok: boolean;
  state?: State;
  result?: unknown;
  receipt?: { requestId: string; status: string; result: unknown } | null;
  error?: { code: string; message: string };
};
type Pending = {
  type: "createOwnTasks";
  projectId: string;
  titles: string[];
  requestId: string;
  expectedRevision: number;
};
export type MockTaskTransport = {
  state: () => Promise<MockReply>;
  action: (body: Pending) => Promise<MockReply>;
  receipt: (id: string) => Promise<MockReply>;
};
export type TaskSessionSnapshot = {
  state: State | null;
  phase:
    | "loading"
    | "ready"
    | "saving"
    | "saved"
    | "conflict"
    | "uncertain"
    | "recovering"
    | "rejected";
  message: string;
  busy: boolean;
  blocked: boolean;
  selectionEpoch: number;
  pendingRequestId: string | null;
};
const contract = createBackendContract({
  profile: "prepared-next",
  purpose: "test",
});
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function validState(v: unknown): v is State {
  return (
    record(v) &&
    v.demo === false &&
    Number.isSafeInteger(v.revision) &&
    Number(v.revision) >= 0 &&
    record(v.currentActor) &&
    typeof v.currentActor.id === "string" &&
    Array.isArray(v.projects) &&
    v.projects.every((p) => record(p) && typeof p.id === "string")
  );
}
function mockReply(reply: MockReply) {
  if (reply?.environment !== "isolated-self-task-mock")
    throw Error("Not an isolated mock response.");
  return reply;
}
function committed(result: unknown, state: unknown, request: Pending) {
  if (
    !validState(state) ||
    !isConfirmedOwnTasksResult(result, state, request.titles)
  )
    return false;
  const project = state.projects.find((p) => p.id === request.projectId);
  if (
    !project ||
    !Array.isArray(project.tasks) ||
    !Array.isArray(project.documents)
  )
    return false;
  return result.created.every(
    (created) =>
      (project.tasks as unknown[]).some(
        (t) =>
          record(t) &&
          t.id === created.taskId &&
          t.ownerId === result.ownerId &&
          t.title === created.title &&
          Array.isArray(t.documentIds) &&
          t.documentIds.includes(created.documentId),
      ) &&
      (project.documents as unknown[]).some(
        (d) =>
          record(d) &&
          d.id === created.documentId &&
          d.ownerId === result.ownerId &&
          d.taskId === created.taskId,
      ),
  );
}
export function createMockSelfTaskSession(
  transport: MockTaskTransport,
  id = () => crypto.randomUUID(),
) {
  let pending: Pending | null = null;
  let snapshot: TaskSessionSnapshot = {
    state: null,
    phase: "loading",
    message: "Loading synthetic data…",
    busy: false,
    blocked: true,
    selectionEpoch: 0,
    pendingRequestId: null,
  };
  const listeners = new Set<() => void>();
  function update(changes: Partial<TaskSessionSnapshot>) {
    snapshot = {
      ...snapshot,
      ...changes,
      pendingRequestId: pending?.requestId ?? null,
    };
    for (const listener of listeners) listener();
  }
  function unknown() {
    update({
      phase: "uncertain",
      busy: false,
      blocked: true,
      message:
        "Mock result unconfirmed. Your selection is preserved. Check the saved result before retrying.",
    });
  }
  function success(reply: MockReply, request: Pending, result: unknown) {
    if (
      !committed(result, reply.state, request) ||
      reply.state?.currentActor.id !== snapshot.state?.currentActor.id
    )
      return false;
    pending = null;
    update({
      state: reply.state!,
      phase: "saved",
      busy: false,
      blocked: false,
      selectionEpoch: snapshot.selectionEpoch + 1,
      message:
        "Saved to the isolated mock server only. No real project data changed.",
    });
    return true;
  }
  async function send() {
    if (!pending || !snapshot.state || snapshot.busy) return;
    const request = structuredClone(pending);
    update({
      phase: "saving",
      busy: true,
      blocked: true,
      message: "Saving to isolated mock server…",
    });
    let reply: MockReply | undefined;
    const result = await addAdminOwnTasks(
      snapshot.state,
      request.projectId,
      request.titles,
      async () => {
        reply = mockReply(await transport.action(structuredClone(request)));
        return reply.ok && reply.status === 200 ? reply.result : null;
      },
      contract,
    );
    if (result.ok && reply && success(reply, request, result.result)) return;
    if (!result.ok && !result.dispatched) {
      pending = null;
      update({
        phase: "rejected",
        busy: false,
        blocked: false,
        message: result.error.message,
      });
      return;
    }
    // These replies definitively reject this mock request before a commit.
    // Timeouts, rate limits, malformed replies and server errors remain unknown.
    if (
      reply &&
      !reply.ok &&
      [400, 401, 403, 404, 409, 415, 422].includes(reply.status) &&
      reply.error?.code
    ) {
      pending = null;
      update({
        phase: reply.status === 409 ? "conflict" : "rejected",
        busy: false,
        blocked: reply.status === 409,
        message:
          reply.status === 409
            ? "Mock conflict: nothing from this request was saved. Refresh the mock state; your selection stays."
            : "Mock request rejected: " + reply.error.message,
      });
      return;
    }
    unknown();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async refresh() {
      if (snapshot.busy || pending) return;
      update({
        busy: true,
        blocked: true,
        phase: "loading",
        message: "Refreshing synthetic data…",
      });
      try {
        const reply = mockReply(await transport.state());
        if (!reply.ok || !validState(reply.state))
          throw Error("Invalid mock state.");
        if (
          snapshot.state &&
          snapshot.state.currentActor.id !== reply.state.currentActor.id
        )
          throw Error("Identity changed.");
        update({
          state: reply.state,
          phase: "ready",
          busy: false,
          blocked: false,
          message:
            "Isolated mock only. Fixed example recommendations, not AI-generated.",
        });
      } catch {
        update({
          phase: "rejected",
          busy: false,
          blocked: true,
          message: "Mock state unavailable. Nothing was submitted.",
        });
      }
    },
    async submit(projectId: string, titles: readonly string[]) {
      if (snapshot.busy || snapshot.blocked || pending || !snapshot.state)
        return;
      pending = {
        type: "createOwnTasks",
        projectId,
        titles: titles.map((title) =>
          typeof title === "string" ? title.trim() : title,
        ),
        requestId: id(),
        expectedRevision: snapshot.state.revision,
      };
      await send();
    },
    async recover() {
      if (snapshot.busy || !pending) return;
      const request = structuredClone(pending);
      update({
        phase: "recovering",
        busy: true,
        blocked: true,
        message: "Checking mock request receipt…",
      });
      try {
        const reply = mockReply(await transport.receipt(request.requestId));
        if (
          reply.ok &&
          reply.status === 200 &&
          reply.receipt?.requestId === request.requestId &&
          reply.receipt.status === "committed" &&
          success(reply, request, reply.receipt.result)
        )
          return;
      } catch {
        /* Unknown is not permission to start a new request. */
      }
      unknown();
    },
    async retryPending() {
      if (!snapshot.busy && pending) await send(); // exact original ID, payload and revision
    },
  };
}
