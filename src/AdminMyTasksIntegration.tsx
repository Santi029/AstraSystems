import { useEffect, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { AdminMyTasks } from "./AdminMyTasks";
import {
  createMockSelfTaskSession,
  type MockReply,
} from "./admin-self-task-session";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/montserrat/700.css";
import "./styles.css";
import "./admin-layout.css";

async function call(route: string, body?: unknown): Promise<MockReply> {
  const response = await fetch("/__mock/tasks/" + route, {
    method: body ? "POST" : "GET",
    credentials: "omit",
    cache: "no-store",
    headers: {
      "X-Astra-Mock": "isolated-self-task-test",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.headers.get("X-Astra-Test-Only") !== "1")
    throw Error("Mock server required.");
  return { ...(await response.json()), status: response.status };
}
const session = createMockSelfTaskSession({
  state: () => call("state"),
  action: (body) => call("action", body),
  receipt: (id) => call("receipts/" + encodeURIComponent(id)),
});
function Integration() {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => {
    void session.refresh();
  }, []);
  const state = snapshot.state,
    project = state?.projects[0],
    actor = state?.currentActor.id;
  return (
    <main style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <aside
        aria-label="Isolated integration test controls"
        style={{ padding: 16, marginBottom: 20, border: "2px solid #b45309" }}
      >
        <h1>Isolated My Tasks test</h1>
        <p>
          Synthetic data · Memory-only mock server · No Supabase, no real
          account, no AI. Closing the test server discards this data.
        </p>
        <button
          type="button"
          disabled={snapshot.busy || !!snapshot.pendingRequestId}
          onClick={() => void session.refresh()}
        >
          Refresh mock state
        </button>{" "}
        <button
          type="button"
          disabled={snapshot.busy || !snapshot.pendingRequestId}
          onClick={() => void session.recover()}
        >
          Check mock receipt
        </button>{" "}
        <button
          type="button"
          disabled={snapshot.busy || !snapshot.pendingRequestId}
          onClick={() => void session.retryPending()}
        >
          Retry same mock request
        </button>
        <p role="status" data-testid="integration-status">
          {snapshot.message}
        </p>
      </aside>
      {state && project && actor && (
        <AdminMyTasks
          p={project}
          actorId={actor}
          personName={() => "Synthetic Admin"}
          onAddSelectedTasks={(titles) => {
            void session.submit(project.id, titles);
          }}
          taskCreationState={{
            scope: actor + ":" + project.id + ":" + snapshot.selectionEpoch,
            busy: snapshot.busy,
            blocked: snapshot.blocked,
            message: snapshot.message,
          }}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Integration />);
