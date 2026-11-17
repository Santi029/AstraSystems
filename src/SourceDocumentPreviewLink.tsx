import { recordedInstant } from "./admin-view-model";
export function SourceDocumentPreviewLink({ title }: { title: string }) {
  return (
    <span className="source-document-reference">
      <strong>{title}</strong>
      <small>Source reference · opening unavailable</small>
    </span>
  );
}

export function SourceSubmissionDate({
  project,
  documentId,
  version,
}: {
  project: { [key: string]: unknown; deliveries?: unknown };
  documentId: string;
  version: unknown;
}) {
  const deliveries = Array.isArray(project.deliveries)
    ? project.deliveries
    : [];
  const dates = deliveries
    .filter(
      (delivery) =>
        Array.isArray(delivery.documentVersions) &&
        delivery.documentVersions.some(
          (source: { documentId?: unknown; version?: unknown }) =>
            source.documentId === documentId && source.version === version,
        ),
    )
    .map((delivery) => recordedInstant(delivery.submittedAt))
    .filter((date) => date.epoch !== null)
    .sort((a, b) => (b.epoch ?? 0) - (a.epoch ?? 0));
  const date = dates[0];
  return (
    <span className="source-submission-date">
      Submitted:{" "}
      {date ? (
        <time dateTime={date.iso ?? undefined}>
          {new Date(date.iso!).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}
        </time>
      ) : (
        "Not recorded"
      )}
    </span>
  );
}
