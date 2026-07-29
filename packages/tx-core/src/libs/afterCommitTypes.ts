export type AfterCommitFailure = {
  phase: "hook" | "reporting";
  hookIndex: number;
  name: string;
  message: string;
  code?: string;
};
