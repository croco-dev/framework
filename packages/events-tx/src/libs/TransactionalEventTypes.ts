export type OutboxMessageStatus =
  | "pending"
  | "publishing"
  | "published"
  | "retrying"
  | "poisoned"
  | "dead_lettered";

export type InboxMessageStatus = "processing" | "processed" | "failed";
