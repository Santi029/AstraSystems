export const WORKSPACE_ROLES = [
  "Admin",
  "Stakeholder",
  "UX Designer",
  "Architecture",
  "Full Stack Development",
  "QA",
  "PM",
] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export type Account = {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  globalRoles: string[];
  status: string;
  inviteStatus?: string | null;
  identityVerified?: boolean;
};
export function roleError(roles: string[]) {
  if (!roles.length) return "Select at least one workspace role.";
  if (
    roles.some((role) => !(WORKSPACE_ROLES as readonly string[]).includes(role))
  )
    return "Choose one of the supported workspace roles.";
  if (roles.includes("PM") && !roles.includes("Admin"))
    return "PM must also be explicitly assigned Admin. No permission is added automatically.";
  return "";
}
export function accountControls(
  account: Account,
  actorId: string,
  accounts: Account[],
) {
  const self = account.userId === actorId || account.id === actorId;
  const activeAdmin =
    account.status === "active" &&
    !!account.userId &&
    account.identityVerified !== false &&
    account.globalRoles.includes("Admin");
  const lastAdmin =
    activeAdmin &&
    accounts.filter(
      (a) =>
        a.status === "active" &&
        !!a.userId &&
        a.identityVerified !== false &&
        a.globalRoles.includes("Admin"),
    ).length <= 1;
  return {
    self,
    lastAdmin,
    canEdit: !self && !["removed", "revoked"].includes(account.status),
    canRemove:
      !self && !lastAdmin && !["removed", "revoked"].includes(account.status),
  };
}
export function setTeamAssignment(
  team: { personId: string; roles: string[] }[],
  role: string,
  personId: string,
  selected: boolean,
) {
  const next = team
    .map((entry) => ({
      ...entry,
      roles: entry.roles.filter(
        (r) => entry.personId !== personId || r !== role,
      ),
    }))
    .filter((entry) => entry.roles.length);
  if (selected) {
    const entry = next.find((entry) => entry.personId === personId);
    if (entry) entry.roles.push(role);
    else next.push({ personId, roles: [role] });
  }
  return next;
}

export function isCommittedReceipt(
  receipt: { status?: string } | null | undefined,
) {
  return receipt?.status === "committed";
}
