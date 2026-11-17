import {
  ACTIVE_BACKEND_CONTRACT,
  guardCurrentActorAction,
} from "./backend-contract.ts";

type OwnTasksResult = {
  ownerId: string;
  created: { taskId: string; documentId: string; title: string }[];
  count: number;
  status: "available";
};
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export function isConfirmedOwnTasksResult(
  value: unknown,
  state: unknown,
  titles: readonly string[],
): value is OwnTasksResult {
  if (
    !record(value) ||
    !record(state) ||
    !record(state.currentActor) ||
    value.ownerId !== state.currentActor.id ||
    value.status !== "available" ||
    value.count !== titles.length ||
    !Array.isArray(value.created) ||
    value.created.length !== titles.length
  )
    return false;
  return (
    value.created.every(
      (item, index) =>
        record(item) &&
        typeof item.taskId === "string" &&
        !!item.taskId.trim() &&
        typeof item.documentId === "string" &&
        !!item.documentId.trim() &&
        item.title === titles[index],
    ) &&
    new Set(value.created.map((item) => item.taskId)).size === titles.length &&
    new Set(value.created.map((item) => item.documentId)).size === titles.length
  );
}
/** No network or UI side effects. The existing authenticated transport is injected.
 * This contract stays unavailable on the live astra-v2 profile. */
export async function addAdminOwnTasks(
  state: unknown,
  projectId: string,
  titles: readonly string[],
  dispatch: (
    type: string,
    payload: { projectId: string; titles: string[] },
  ) => Promise<unknown>,
  contract = ACTIVE_BACKEND_CONTRACT,
) {
  const payload = {
    projectId,
    titles: titles.map((title) =>
      typeof title === "string" ? title.trim() : title,
    ),
  };
  const compatible = contract.guardAction("createOwnTasks", payload);
  if (!compatible.ok)
    return {
      ok: false as const,
      error: compatible,
      dispatched: false as const,
    };
  const permitted = guardCurrentActorAction(state, "createOwnTasks", payload);
  if (!permitted.ok)
    return { ok: false as const, error: permitted, dispatched: false as const };
  // No owner/roles/identity from the client. Existing transport owns request ID,
  // expected revision and receipt recovery. No optimistic rows or automatic retries.
  let result: unknown;
  try {
    result = await dispatch("createOwnTasks", payload);
  } catch {
    result = null;
  }
  if (!isConfirmedOwnTasksResult(result, state, payload.titles))
    return {
      ok: false as const,
      dispatched: true as const,
      error: {
        code: "SELF_TASK_RESULT_UNCONFIRMED",
        message:
          "The task creation result could not be confirmed. Keep your selection and check the request receipt before retrying.",
      },
    };
  return { ok: true as const, result, dispatched: true as const };
}
