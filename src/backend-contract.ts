/**
 * Frontend compatibility, NOT authorization.
 * Verified source: astra-api v2, artifact 2e9d72ce8582c1a0d3edfe821ba8f8dfc238a69df2d0943c9fcd3fea33238671.
 * Never infer backend readiness from manageAccounts, a role label or a URL.
 * The server still verifies identity, membership, ownership, revisions and receipts.
 * V2's historical project-admin check is NOT repaired by these presentation gates.
 */
export type ContractProfile = "astra-v2" | "prepared-next" | "astra-role-epoch" | "astra-v8-own-tasks";
export type ContractMode = "accounts" | "demo";
export type ContractPurpose = "active" | "staging" | "test";
export type GuardResult =
  | { ok: true }
  | { ok: false; code: string; message: string };
type RecordValue = Record<string, unknown>;
type Options = {
  profile?: string;
  mode?: ContractMode;
  purpose?: ContractPurpose;
};
const allow = (): GuardResult => ({ ok: true });
const deny = (code: string, message: string): GuardResult => ({
  ok: false,
  code,
  message,
});
const record = (value: unknown): value is RecordValue =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value: unknown, max = 200, empty = false) =>
  typeof value === "string" &&
  value.length <= max &&
  (empty || value.trim().length > 0);
const exactKeys = (value: RecordValue, allowed: readonly string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));

export const WORKSPACE_ROLE_NAMES = Object.freeze([
  "Admin",
  "Stakeholder",
  "UX Designer",
  "Architecture",
  "Full Stack Development",
  "QA",
  "PM",
] as const);
export const V2_PROJECT_GRANT_ROLES = Object.freeze([
  "Stakeholder",
  "Architecture",
  "QA",
] as const);
// Existing labels only. Do not offer these as new canonical role grants or rewrite them.
export const V2_EXISTING_TASK_ROLE_LABELS = Object.freeze([
  "Specialist",
  "UX Specialist",
  "Researcher",
  "UX / UI Design",
  "Brand Identity",
  "Architecture",
  "Security",
  "Development",
  "DevOps",
  "QA",
] as const);
const nextProjectRoles = WORKSPACE_ROLE_NAMES.filter(
  (role) => role !== "Admin",
);
const nextTaskRoles = [
  ...V2_EXISTING_TASK_ROLE_LABELS,
  "UX Designer",
  "Full Stack Development",
];
const actionKeys: Readonly<Record<string, readonly string[]>> = Object.freeze({
  setDocumentEditPermission: ["projectId", "documentId", "allowEdit"],
  createProject: ["project"],
  assignRole: ["projectId", "personId", "role"],
  createTask: ["projectId", "task"],
  createOwnTasks: ["projectId", "titles"],
  setRequiredSources: ["projectId", "documentIds"],
  assignQuestionnaire: ["projectId", "personId"],
  selectTasks: ["projectId", "taskIds"],
  activateTask: ["projectId", "taskId"],
  readNotice: ["projectId", "noticeId"],
  openReview: ["projectId", "deliveryId"],
  approveDelivery: ["projectId", "deliveryId"],
  returnDelivery: ["projectId", "deliveryId", "reason"],
  saveDraft: ["projectId", "documentId", "content"],
  beginRevision: ["projectId", "documentId"],
  submitDocuments: ["projectId", "documentIds"],
  completeTask: ["projectId", "taskId", "acknowledgeDemoRule"],
  preparePrd: ["projectId"],
  closePrd: ["projectId", "prdVersion", "sourceVersions"],
  saveQuestionnaire: ["projectId", "answers"],
  submitQuestionnaire: ["projectId", "answers", "confirmAvailable"],
  simulateAi: ["projectId", "taskId", "message"],
  previewExternal: ["projectId", "kind", "taskId", "deliveryId", "content"],
  publishExternal: ["projectId", "operationId", "authorized", "outcome"],
  checkExternal: ["projectId", "operationId"],
  retryExternal: ["projectId", "operationId", "outcome"],
  resetDemo: ["scenario"],
  injectFailure: ["enabled"],
  registerAccount: ["account"],
  updateAccount: ["accountId", "account"],
  removeAccount: ["accountId", "confirmedEmail"],
});
export const V2_ACCOUNT_ACTIONS = Object.freeze([
  "createProject",
  "assignRole",
  "createTask",
  "setRequiredSources",
  "assignQuestionnaire",
  "selectTasks",
  "activateTask",
  "readNotice",
  "openReview",
  "approveDelivery",
  "returnDelivery",
  "saveDraft",
  "beginRevision",
  "submitDocuments",
  "completeTask",
  "preparePrd",
  "closePrd",
  "saveQuestionnaire",
  "submitQuestionnaire",
] as const);
const demoActions = [
  "simulateAi",
  "previewExternal",
  "publishExternal",
  "checkExternal",
  "retryExternal",
  "resetDemo",
  "injectFailure",
];
const nextAccountActions = [
  "registerAccount",
  "updateAccount",
  "removeAccount",
  "createOwnTasks",
];
const simulationOutcomes = [
  "success",
  "failure",
  "uncertain_written",
  "uncertain_missing",
];

export function validateWorkspaceRoles(roles: unknown): GuardResult {
  if (
    !Array.isArray(roles) ||
    !roles.length ||
    roles.some(
      (role) => !(WORKSPACE_ROLE_NAMES as readonly unknown[]).includes(role),
    )
  )
    return deny(
      "UNSUPPORTED_ROLE",
      "Select explicit current workspace roles; legacy labels are not converted.",
    );
  if (roles.includes("PM") && !roles.includes("Admin"))
    return deny(
      "PM_REQUIRES_EXPLICIT_ADMIN",
      "PM requires an explicit Admin assignment. No permission is inferred.",
    );
  return allow();
}

/** Read-only UI eligibility from a server-returned DTO; missing evidence fails closed. */
export function isActiveVerifiedPerson(person: unknown): boolean {
  if (
    !record(person) ||
    !text(person.id) ||
    person.identityVerified !== true ||
    person.active === false ||
    person.assignable === false ||
    person.removed === true
  )
    return false;
  const status = person.accountStatus ?? person.status;
  return (
    status === "active" &&
    (person.status === undefined || person.status === "active") &&
    (person.accountStatus === undefined || person.accountStatus === "active")
  );
}
export function isActiveVerifiedAdmin(person: unknown): boolean {
  return (
    isActiveVerifiedPerson(person) &&
    record(person) &&
    Array.isArray(person.globalRoles) &&
    person.globalRoles.includes("Admin")
  );
}
export function canShowProjectAdminActions(
  state: unknown,
  project: unknown,
): boolean {
  return (
    record(state) &&
    record(project) &&
    project.isAdmin === true &&
    record(state.capabilities) &&
    state.capabilities.createProject === true &&
    isActiveVerifiedAdmin(state.currentActor)
  );
}

/**
 * Additional UI gate against the latest server-returned state, AFTER guardAction.
 * This is not server authorization and cannot repair v2's historical-admin check.
 * Ownership, delivery state and all other permissions remain server-authoritative.
 */
export function guardCurrentActorAction(
  state: unknown,
  type: string,
  payload: unknown,
): GuardResult {
  if (!record(state) || !record(payload))
    return deny(
      "CURRENT_STATE_REQUIRED",
      "Refresh the workspace before taking this action.",
    );
  if (type === "createProject") {
    if (
      !record(state.capabilities) ||
      state.capabilities.createProject !== true ||
      !isActiveVerifiedAdmin(state.currentActor)
    )
      return deny(
        "CURRENT_ADMIN_REQUIRED",
        "Only the current active verified Admin can create a project.",
      );
    const input = payload.project;
    const selectedAdmin =
      record(input) && Array.isArray(state.people)
        ? state.people.find(
            (person) => record(person) && person.id === input.adminId,
          )
        : undefined;
    if (!isActiveVerifiedAdmin(selectedAdmin))
      return deny(
        "CURRENT_TARGET_ADMIN_REQUIRED",
        "The selected project administrator is no longer an active verified Admin. Review the selection before creating the project.",
      );
  }
  const privileged = [
    "setDocumentEditPermission",
    "assignRole",
    "createTask",
    "setRequiredSources",
    "assignQuestionnaire",
    "openReview",
    "approveDelivery",
    "returnDelivery",
    "preparePrd",
    "closePrd",
  ];
  if (
    actionKeys[type]?.includes("projectId") ||
    Object.hasOwn(payload, "projectId")
  ) {
    const project = Array.isArray(state.projects)
      ? state.projects.find(
          (candidate) =>
            record(candidate) && candidate.id === payload.projectId,
        )
      : undefined;
    if (!text(payload.projectId) || !project)
      return deny(
        "CURRENT_PROJECT_REQUIRED",
        "This project is not available in the current workspace. Refresh before continuing.",
      );
    if (type === "createOwnTasks") {
      const current = state.currentActor;
      const membership =
        record(project) && Array.isArray(project.team)
          ? project.team.find(
              (member) =>
                record(member) &&
                record(current) &&
                member.personId === current.id,
            )
          : undefined;
      const isPm =
        record(membership) &&
        Array.isArray(membership.roles) &&
        membership.roles.includes("PM");
      if (
        !isActiveVerifiedAdmin(current) ||
        !record(project) ||
        (project.isAdmin !== true && !isPm)
      )
        return deny(
          "SELF_TASK_ADMIN_REQUIRED",
          "Only a current verified project Admin or explicitly assigned PM with Admin authority can create their own tasks.",
        );
    }
    if (
      privileged.includes(type) &&
      !canShowProjectAdminActions(state, project)
    )
      return deny(
        "CURRENT_PROJECT_ADMIN_REQUIRED",
        "This action requires the current verified workspace Admin and the project administrator assignment.",
      );
  }
  return allow();
}

/**
 * Default is the reviewed active v2 contract.
 * prepared-next is only an explicit test/staging contract. Its activationAllowed
 * is false, including when its forms are tested against mocked HTTP.
 * No environment, storage, querystring or server DTO can promote this profile.
 */
export function createBackendContract(options: Options = {}) {
  const profile = options.profile ?? "astra-v2";
  const mode = options.mode ?? "accounts";
  const purpose = options.purpose ?? "active";
  const recognized =
    ["astra-v2", "prepared-next", "astra-role-epoch", "astra-v8-own-tasks"].includes(profile) &&
    ["accounts", "demo"].includes(mode) &&
    ["active", "staging", "test"].includes(purpose);
  const usable =
    recognized &&
    (profile === "astra-v2" || purpose === "test" || purpose === "staging");
  const ownTasksV8 = usable && profile === "astra-v8-own-tasks" && mode === "accounts";
  const epoch = usable && (profile === "astra-role-epoch" || ownTasksV8) && mode === "accounts";
  const prepared = usable && profile === "prepared-next";
  const grants: readonly string[] = Object.freeze(
    usable ? [...(prepared ? nextProjectRoles : V2_PROJECT_GRANT_ROLES)] : [],
  );
  const taskRoles: readonly string[] = prepared
    ? nextTaskRoles
    : V2_EXISTING_TASK_ROLE_LABELS;
  const supportedActions: readonly string[] = Object.freeze(
    usable
      ? [
          ...V2_ACCOUNT_ACTIONS,
          ...(ownTasksV8 ? ["createOwnTasks"] : []),
          ...(epoch ? ["setDocumentEditPermission"] : []),
          ...(mode === "demo" ? demoActions : []),
          ...(prepared && mode === "accounts" ? nextAccountActions : []),
        ]
      : [],
  );
  const features = Object.freeze({
    documentEditPermissions: epoch,
    ownTasks: (prepared || ownTasksV8) && mode === "accounts",
    accountManagement: prepared && mode === "accounts",
    accountRegistration: prepared && mode === "accounts",
    invitations: false,
    emailChange: false,
    liveAi: false,
    voice: false,
    uploads: false,
    externalProviders: false,
    simulations: usable && mode === "demo",
    manualCompletion: usable, // Only v2's explicit manual declaration, not agreed product criteria.
    newCanonicalSpecialistGrants: prepared,
    pmGrant: prepared,
  });
  const isProjectGrantRole = (role: unknown) =>
    typeof role === "string" && grants.includes(role);
  const isTaskRole = (role: unknown) =>
    usable &&
    typeof role === "string" &&
    taskRoles.some(
      (label) => label.toLowerCase() === role.trim().toLowerCase(),
    );
  const isTaskOwnerEligible = (person: unknown, membership: unknown) =>
    record(person) &&
    record(membership) &&
    membership.personId === person.id &&
    (mode === "demo" || isActiveVerifiedPerson(person)) &&
    Array.isArray(membership.roles) &&
    membership.roles.some(isTaskRole);

  function guardAction(type: unknown, payload: unknown = {}): GuardResult {
    if (!usable)
      return deny(
        "BACKEND_CONTRACT_UNAVAILABLE",
        "This frontend contract is not approved for active use.",
      );
    if (typeof type !== "string" || !supportedActions.includes(type))
      return deny(
        "ACTION_UNAVAILABLE",
        "This action is unavailable under the selected backend contract.",
      );
    if (!record(payload) || !exactKeys(payload, actionKeys[type]))
      return deny(
        "INVALID_PAYLOAD",
        "Use only the documented action fields. Identity, transport metadata and aliases are not accepted here.",
      );
    const invalid = (message: string) => deny("INVALID_PAYLOAD", message);
    const badRole = () =>
      deny(
        "ROLE_NOT_AVAILABLE",
        "This role cannot be newly assigned under this backend contract. Existing labels are preserved without conversion.",
      );
    if (actionKeys[type].includes("projectId") && !text(payload.projectId))
      return invalid("Select an existing project.");
    for (const key of [
      "personId",
      "taskId",
      "noticeId",
      "deliveryId",
      "documentId",
      "operationId",
      "accountId",
    ]) {
      if (
        actionKeys[type].includes(key) &&
        !(type === "previewExternal" && key === "deliveryId") &&
        !text(payload[key])
      )
        return invalid("Provide the documented identifier: " + key + ".");
    }
    if (type === "setDocumentEditPermission" && typeof payload.allowEdit !== "boolean") return invalid("Specify allowEdit as an explicit boolean.");
    if (type === "createProject") {
      const p = payload.project;
      if (
        !record(p) ||
        !exactKeys(p, [
          "name",
          "description",
          "startDate",
          "endDate",
          "adminId",
          "team",
        ]) ||
        !text(p.name) ||
        !text(p.adminId)
      )
        return invalid(
          "A project name and explicitly selected administrator are required. Team assignments may be empty.",
        );
      if (p.description !== undefined && !text(p.description, 100000, true))
        return invalid("Description must be text.");
      for (const key of ["startDate", "endDate"])
        if (p[key] !== undefined && !text(p[key], 100, true))
          return invalid("Dates must use the documented text fields.");
      if (p.team !== undefined && !Array.isArray(p.team))
        return invalid("Team must be an array; [] is valid.");
      for (const entry of (p.team ?? []) as unknown[]) {
        if (
          !record(entry) ||
          !exactKeys(entry, ["personId", "roles"]) ||
          !text(entry.personId) ||
          !Array.isArray(entry.roles)
        )
          return invalid("Team entries require personId and explicit roles.");
        if (!entry.roles.every(isProjectGrantRole)) return badRole();
      }
    }
    if (type === "assignRole" && !isProjectGrantRole(payload.role))
      return badRole();
    if (type === "createOwnTasks") {
      if (
        !Array.isArray(payload.titles) ||
        payload.titles.length < 1 ||
        payload.titles.length > 100 ||
        !payload.titles.every((title) => text(title, 200))
      )
        return invalid("Choose between one and 100 nonempty task titles.");
      const keys = payload.titles.map((title) =>
        String(title)
          .trim()
          .normalize("NFKC")
          .replace(/\s+/g, " ")
          .toLocaleLowerCase("en-US"),
      );
      if (new Set(keys).size !== keys.length)
        return invalid("Choose distinct task titles.");
    }
    if (type === "createTask") {
      const task = payload.task;
      if (
        !record(task) ||
        !exactKeys(task, ["title", "ownerId", "documentTitles"]) ||
        !text(task.title) ||
        !text(task.ownerId) ||
        !Array.isArray(task.documentTitles) ||
        task.documentTitles.length < 1 ||
        task.documentTitles.length > 10 ||
        !task.documentTitles.every((title) => text(title))
      )
        return invalid(
          "Tasks require an explicit owner, title and one to ten document titles. Role eligibility remains server-checked.",
        );
    }
    for (const key of ["taskIds", "documentIds"]) {
      if (!actionKeys[type].includes(key)) continue;
      const ids = payload[key];
      if (
        !Array.isArray(ids) ||
        !ids.every((id) => text(id)) ||
        new Set(ids).size !== ids.length ||
        (type !== "setRequiredSources" && ids.length === 0)
      )
        return invalid("Select a distinct list of existing identifiers.");
    }
    if (type === "saveDraft" && !text(payload.content, 100000, true))
      return invalid("Draft content must be text.");
    if (type === "returnDelivery" && !text(payload.reason, 20000))
      return invalid("Returning a delivery requires a reason.");
    if (type === "completeTask" && payload.acknowledgeDemoRule !== true)
      return deny(
        "MANUAL_COMPLETION_ACK_REQUIRED",
        "This records only the explicit v2 manual declaration, separate from submission and approval.",
      );
    if (type === "closePrd") {
      if (
        !Number.isInteger(payload.prdVersion) ||
        (payload.prdVersion as number) < 1 ||
        !Array.isArray(payload.sourceVersions) ||
        !payload.sourceVersions.every(
          (source) =>
            record(source) &&
            exactKeys(source, ["documentId", "version", "contentHash"]) &&
            text(source.documentId) &&
            Number.isInteger(source.version) &&
            (source.version as number) >= 1 &&
            typeof source.contentHash === "string" &&
            /^[a-f0-9]{64}$/.test(source.contentHash),
        )
      )
        return invalid(
          "Confirm the exact PRD and source versions returned by the server.",
        );
    }
    if (["saveQuestionnaire", "submitQuestionnaire"].includes(type)) {
      if (
        !record(payload.answers) ||
        !Object.entries(payload.answers).every(
          ([key, value]) =>
            /^q([1-9]|10)$/.test(key) && text(value, 20000, true),
        )
      )
        return invalid(
          "Questionnaire answers must be an object keyed q1 through q10, not an array or alternate field names.",
        );
      if (
        type === "submitQuestionnaire" &&
        payload.confirmAvailable !== undefined &&
        typeof payload.confirmAvailable !== "boolean"
      )
        return invalid("Pending-answer confirmation must be explicit.");
    }
    if (type === "simulateAi" && !text(payload.message, 20000))
      return invalid("Provide simulation text.");
    if (
      type === "previewExternal" &&
      (!["comment", "approvedUpdate"].includes(String(payload.kind)) ||
        !text(payload.content, 20000) ||
        (payload.kind === "approvedUpdate" && !text(payload.deliveryId)))
    )
      return invalid("Provide the exact simulated target, kind and content.");
    if (type === "publishExternal" && payload.authorized !== true)
      return invalid(
        "Simulated publication requires a separate explicit authorization.",
      );
    if (
      ["publishExternal", "retryExternal"].includes(type) &&
      payload.outcome !== undefined &&
      !simulationOutcomes.includes(String(payload.outcome))
    )
      return invalid("Unsupported simulation outcome.");
    if (
      type === "resetDemo" &&
      payload.scenario !== undefined &&
      !["default", "ready", "incomplete"].includes(String(payload.scenario))
    )
      return invalid("Unsupported demo scenario.");
    if (type === "injectFailure" && typeof payload.enabled !== "boolean")
      return invalid("Failure injection requires an explicit boolean.");
    if (["registerAccount", "updateAccount"].includes(type)) {
      const a = payload.account;
      const keys =
        type === "registerAccount"
          ? ["name", "email", "globalRoles"]
          : ["name", "globalRoles", "status"];
      if (!record(a) || !exactKeys(a, keys) || !text(a.name))
        return invalid("Use only the documented account fields.");
      const roleCheck = validateWorkspaceRoles(a.globalRoles);
      if (!roleCheck.ok) return roleCheck;
      if (
        type === "registerAccount" &&
        (!text(a.email, 254) ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email as string))
      )
        return invalid(
          "Provide an email address; this does not verify identity or send an invitation.",
        );
      if (
        type === "updateAccount" &&
        !["active", "pending", "suspended"].includes(String(a.status))
      )
        return invalid("Use an explicit supported account status.");
    }
    if (type === "removeAccount" && !text(payload.confirmedEmail, 254))
      return invalid("Confirm the exact account email.");
    return allow();
  }
  return Object.freeze({
    profile,
    mode,
    purpose,
    configured: usable,
    activationAllowed: usable && profile === "astra-v2",
    features,
    projectGrantRoles: grants,
    supportedActions,
    isProjectGrantRole,
    isTaskRole,
    isTaskOwnerEligible,
    guardAction,
  });
}

export const ACTIVE_BACKEND_CONTRACT = createBackendContract();
/** Pass action data only. requestId/expectedRevision/CSRF are added by the unchanged transport after this check. */
export const guardAction = ACTIVE_BACKEND_CONTRACT.guardAction;
