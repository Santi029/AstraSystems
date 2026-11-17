import { useEffect, useRef, useState } from "react";
import { Plus, Send, Pencil, UserMinus, X } from "lucide-react";
import {
  WORKSPACE_ROLES,
  accountControls,
  roleError,
  type Account,
} from "./account-model";

type Action = (
  type: string,
  payload?: Record<string, any>,
  success?: string,
) => Promise<any>;
type Props = {
  accounts: Account[];
  actorId: string;
  action: Action;
  busy: boolean;
  invitationEnabled: boolean;
  invitationReason?: string;
  errorMessage?: string;
};
export function PersonDialog({
  account,
  onClose,
  onRegistered,
  ...props
}: Props & {
  account?: Account;
  onClose: () => void;
  onRegistered?: (result: any) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [input, setInput] = useState({
    name: account?.name || "",
    email: account?.email || "",
    globalRoles: [...(account?.globalRoles || [])],
    status: account?.status || "pending",
  });
  const [registered, setRegistered] = useState<{
    accountId: string;
    inviteStatus?: string;
  } | null>(null);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const controls = account
    ? accountControls(account, props.actorId, props.accounts)
    : null;
  useEffect(() => {
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.current?.showModal();
    return () => {
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);
  const identityVerified =
    account?.identityVerified ??
    Boolean(account?.userId && account.status !== "pending");
  const invalid = roleError(input.globalRoles);
  if (registered)
    return (
      <dialog
        ref={dialog}
        className="person-dialog"
        aria-labelledby="person-registered-title"
        onCancel={(event) => {
          if (props.busy) event.preventDefault();
          else onClose();
        }}
      >
        <h2 id="person-registered-title">Person registered</h2>
        <p>
          <strong>{input.name}</strong>
          <br />
          {input.email}
        </p>
        <p>Roles: {input.globalRoles.join(", ")}</p>
        <p>
          {registered.inviteStatus === "sent"
            ? "Supabase accepted the invitation email. Delivery and identity verification are not yet confirmed."
            : registered.inviteStatus === "uncertain"
              ? "The invitation outcome is uncertain. Do not send another invitation until the result is checked."
              : "No invitation has been sent. This person cannot sign in until their identity is verified."}
        </p>
        {!props.invitationEnabled && (
          <p className="inline-note">
            {props.invitationReason ||
              "Invitation delivery is not enabled. An accessible activation link and email provider must be configured first."}
          </p>
        )}
        {error && (
          <p role="alert" className="inline-note">
            {props.errorMessage || error}
          </p>
        )}
        <div className="modal-actions">
          <button disabled={props.busy} onClick={onClose}>
            Done
          </button>
          {!registered.inviteStatus && (
            <button
              className="primary"
              disabled={
                props.busy || !props.invitationEnabled || !registered.accountId
              }
              onClick={async () => {
                const result = await props.action("inviteRegisteredAccount", {
                  accountId: registered.accountId,
                  confirmedEmail: input.email.trim().toLowerCase(),
                });
                if (result)
                  setRegistered({
                    ...registered,
                    inviteStatus: result.inviteStatus || "uncertain",
                  });
                else
                  setError(
                    "Invitation was not confirmed. Check the workspace message and saved result before retrying. No automatic resend will occur.",
                  );
              }}
            >
              Send invitation to {input.email}
            </button>
          )}
        </div>
      </dialog>
    );
  return (
    <dialog
      ref={dialog}
      className="person-dialog"
      aria-labelledby="person-dialog-title"
      onCancel={(event) => {
        if (props.busy) event.preventDefault();
        else onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="person-dialog-title">
          {account ? "Edit member" : "Add New Person"}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close person form"
          disabled={props.busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p className="muted">
        {account
          ? "Update another person’s workspace access. Project assignments and saved history remain separate."
          : "Register the person’s access first. Sending an invitation is a separate, explicit action. Your project form stays open."}
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          if (invalid) {
            setError(invalid);
            return;
          }
          if (!review) {
            setReview(true);
            return;
          }
          const result = await props.action(
            account ? "updateAccount" : "registerAccount",
            account
              ? {
                  accountId: account.id,
                  account: {
                    name: input.name,
                    globalRoles: input.globalRoles,
                    status: input.status,
                  },
                }
              : {
                  account: {
                    name: input.name,
                    email: input.email,
                    globalRoles: input.globalRoles,
                  },
                },
            account
              ? "Member access updated. Project history is preserved."
              : "Person registered. No invitation has been sent yet.",
          );
          if (result) {
            onRegistered?.(result);
            if (account) onClose();
            else
              setRegistered({
                accountId: result.accountId || result.account?.id || "",
              });
          } else {
            setReview(false);
            setError(
              "The change was not confirmed. Your entries are preserved. Check the workspace message before retrying.",
            );
          }
        }}
      >
        {review ? (
          <div className="account-review">
            <h3>Review {account ? "changes" : "new person"}</h3>
            <p>
              <strong>{input.name}</strong>
              <br />
              {input.email}
            </p>
            <p>Workspace roles: {input.globalRoles.join(", ")}</p>
            {account && <p>Status: {input.status}</p>}
            <p>
              {input.globalRoles.includes("Admin")
                ? "Admin grants permission to create projects and manage other members."
                : "These roles do not grant Admin access."}
            </p>
            <p>No email is sent by this save.</p>
          </div>
        ) : (
          <>
            <label>
              Name
              <input
                required
                maxLength={200}
                value={input.name}
                onChange={(event) =>
                  setInput({ ...input, name: event.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                maxLength={254}
                value={input.email}
                readOnly={!!account}
                onChange={(event) =>
                  setInput({ ...input, email: event.target.value })
                }
              />
            </label>
            {account && (
              <p className="helper">
                Email is a verified sign-in identity. Changing it requires a
                separate secure verification flow, which is not available in
                this build. It is not changed by this form.
              </p>
            )}
            {input.globalRoles.some(
              (role) => !(WORKSPACE_ROLES as readonly string[]).includes(role),
            ) && (
              <p className="inline-note">
                Previous labels:{" "}
                {input.globalRoles
                  .filter(
                    (role) =>
                      !(WORKSPACE_ROLES as readonly string[]).includes(role),
                  )
                  .join(", ")}
                . Replace them explicitly, then select the intended current
                roles.{" "}
                <button
                  type="button"
                  onClick={() =>
                    setInput({
                      ...input,
                      globalRoles: input.globalRoles.filter((role) =>
                        (WORKSPACE_ROLES as readonly string[]).includes(role),
                      ),
                    })
                  }
                >
                  Replace previous labels
                </button>
              </p>
            )}
            <fieldset>
              <legend>Workspace roles</legend>
              <div className="account-role-grid">
                {WORKSPACE_ROLES.map((role) => (
                  <label className="inline" key={role}>
                    <input
                      type="checkbox"
                      checked={input.globalRoles.includes(role)}
                      disabled={!!controls?.lastAdmin && role === "Admin"}
                      onChange={(event) =>
                        setInput({
                          ...input,
                          globalRoles: event.target.checked
                            ? [...input.globalRoles, role]
                            : input.globalRoles.filter(
                                (value) => value !== role,
                              ),
                        })
                      }
                    />
                    {role}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="helper">
              Select every role explicitly. PM requires Admin too. Workspace
              roles do not automatically assign project work.
            </p>
            {account && (
              <label>
                Status
                <select
                  value={input.status}
                  disabled={controls?.lastAdmin}
                  onChange={(event) =>
                    setInput({ ...input, status: event.target.value })
                  }
                >
                  {(input.status === "pending" || !identityVerified) && (
                    <option value="pending">Pending verification</option>
                  )}
                  {identityVerified && <option value="active">Active</option>}
                  <option value="suspended">Suspended</option>
                </select>
              </label>
            )}
            {controls?.lastAdmin && (
              <p className="helper">
                The last active Admin cannot be suspended, removed or lose Admin
                access.
              </p>
            )}
          </>
        )}
        {error && (
          <p className="inline-note" role="alert">
            {props.errorMessage || error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            disabled={props.busy}
            onClick={() => (review ? setReview(false) : onClose())}
          >
            {review ? "Back" : "Cancel"}
          </button>
          <button className="primary" disabled={props.busy || !!controls?.self}>
            {props.busy
              ? "Saving…"
              : review
                ? "Confirm and save"
                : "Review access"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
export function WorkspaceAccounts(props: Props) {
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [operation, setOperation] = useState<{
    kind: "invite" | "remove";
    account: Account;
  } | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (operation) dialog.current?.showModal();
    else dialog.current?.close();
  }, [operation]);
  const close = () => {
    setOperation(null);
    setError("");
    setConfirmation("");
  };
  return (
    <section className="panel padded">
      <div className="inline spread">
        <div>
          <h2>Workspace accounts</h2>
          <p className="muted">
            Manage other members. Every role is explicit; project work and
            history are preserved.
          </p>
        </div>
        <button
          className="primary"
          disabled={props.busy}
          onClick={() => setEditing("new")}
        >
          <Plus size={17} />
          Add New Person
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Email</th>
              <th>Workspace roles</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {props.accounts.map((account) => {
              const control = accountControls(
                account,
                props.actorId,
                props.accounts,
              );
              return (
                <tr key={account.id}>
                  <td>
                    <strong>{account.name}</strong>
                    {control.self && <span className="helper"> · You</span>}
                  </td>
                  <td>{account.email}</td>
                  <td>{account.globalRoles.join(", ")}</td>
                  <td>
                    <span className="status neutral">{account.status}</span>
                    {account.inviteStatus && (
                      <small className="helper account-status">
                        Invitation: {account.inviteStatus}
                      </small>
                    )}
                  </td>
                  <td>
                    {control.self ? (
                      <span className="helper">
                        Your own account is not editable here.
                      </span>
                    ) : (
                      <div className="account-actions">
                        <button
                          disabled={props.busy || !control.canEdit}
                          onClick={() => setEditing(account)}
                        >
                          <Pencil size={15} />
                          Edit
                        </button>
                        {account.status === "pending" && (
                          <button
                            disabled={
                              props.busy ||
                              !props.invitationEnabled ||
                              [
                                "queued",
                                "sending",
                                "sent",
                                "uncertain",
                              ].includes(account.inviteStatus || "")
                            }
                            title={
                              !props.invitationEnabled
                                ? props.invitationReason ||
                                  "Invitation email configuration needs verification."
                                : undefined
                            }
                            onClick={() => {
                              setOperation({ kind: "invite", account });
                              setError("");
                            }}
                          >
                            <Send size={15} />
                            Invite
                          </button>
                        )}
                        <button
                          disabled={props.busy || !control.canRemove}
                          onClick={() => {
                            setOperation({ kind: "remove", account });
                            setError("");
                          }}
                        >
                          <UserMinus size={15} />
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!props.invitationEnabled && (
        <p className="inline-note">
          <span>
            {props.invitationReason ||
              "Email invitations are not enabled yet. The secure return link and email template must be verified before sending. Registration alone does not send email."}
          </span>
        </p>
      )}
      <p className="helper">
        At least one active Admin must remain. Removing a member revokes
        workspace access and preserves their project records; it does not erase
        their Auth identity or history.
      </p>
      {editing && (
        <PersonDialog
          {...props}
          account={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <dialog
        ref={dialog}
        className="person-dialog"
        aria-labelledby="account-operation-title"
        onCancel={(event) => {
          if (props.busy) event.preventDefault();
          else close();
        }}
      >
        {operation && (
          <>
            <h2 id="account-operation-title">
              {operation.kind === "invite"
                ? "Send invitation?"
                : "Remove this member?"}
            </h2>
            <p>
              <strong>{operation.account.name}</strong>
              <br />
              {operation.account.email}
            </p>
            <p>
              {operation.kind === "invite"
                ? "Supabase will send this person an email to verify their identity and set their own password. No password is created or displayed here."
                : "This revokes the person’s workspace access. Project history and authored work will be retained. Existing assignments are not silently transferred."}
            </p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                const result = await props.action(
                  operation.kind === "invite"
                    ? "inviteRegisteredAccount"
                    : "removeAccount",
                  {
                    accountId: operation.account.id,
                    confirmedEmail: operation.account.email,
                  },
                );
                if (result) {
                  close();
                } else
                  setError(
                    "The result was not confirmed. Check the workspace message and saved result before retrying. No automatic resend will occur.",
                  );
              }}
            >
              <label>
                Type the email to confirm
                <input
                  required
                  type="email"
                  value={confirmation}
                  autoComplete="off"
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
              {error && (
                <p role="alert" className="inline-note">
                  {props.errorMessage || error}
                </p>
              )}
              <div className="modal-actions">
                <button type="button" disabled={props.busy} onClick={close}>
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={
                    props.busy ||
                    confirmation.trim().toLowerCase() !==
                      operation.account.email.toLowerCase()
                  }
                >
                  {props.busy
                    ? "Working…"
                    : operation.kind === "invite"
                      ? "Send invitation"
                      : "Remove member"}
                </button>
              </div>
            </form>
          </>
        )}
      </dialog>
    </section>
  );
}
