import * as React from "react";
export function AdminReviewPreviewActions() {
  const dialog = React.useRef<HTMLDialogElement>(null);
  const [reason, setReason] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const titleId = React.useId();
  return (
    <div className="admin-review-preview-actions">
      <div className="actions">
        <button type="button" onClick={() => dialog.current?.showModal()}>
          Request Changes
        </button>
        <button
          type="button"
          className="primary"
          onClick={() =>
            setNotice(
              "Approval preview only. No decision was saved and no notification was sent.",
            )
          }
        >
          Approve
        </button>
      </div>
      <p className="helper">
        Visual preview only. Decisions and notifications are not connected.
      </p>
      {notice && (
        <p role="status" className="helper">
          {notice}
        </p>
      )}
      <dialog
        className="astra-my-task-dialog"
        ref={dialog}
        aria-labelledby={titleId}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason.trim()) return;
            setNotice(
              "Changes-request preview only. No decision was saved and no notification was sent.",
            );
            dialog.current?.close();
          }}
        >
          <header className="my-task-dialog-heading">
            <h2 id={titleId}>Request Changes</h2>
            <button type="button" onClick={() => dialog.current?.close()}>
              Close
            </button>
          </header>
          <div className="my-task-dialog-body">
            <label>
              Changes requested / reason
              <textarea
                autoFocus
                rows={5}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain what needs to change and why…"
              />
            </label>
            <p className="helper">
              Preview only. Your note will not be sent or saved.
            </p>
          </div>
          <footer className="actions">
            <button type="button" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={!reason.trim()}>
              Preview Request Changes
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
