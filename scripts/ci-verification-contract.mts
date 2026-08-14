export const SECURITY_OWNERSHIP = [
  { id: "advisory-production-audit", owner: "coverage-security", semantics: "advisory-report" },
  { id: "gitleaks-acceptance-smoke", owner: "coverage-security", semantics: "acceptance-smoke" },
  { id: "blocking-secret-scan", owner: "coverage-security", semantics: "blocking" },
  { id: "security-policy-summary", owner: "validate-synthesis", semantics: "report-only" },
  { id: "security-upload", owner: "producing-job", semantics: "report-transport" },
] as const;

export type SecurityResultId = (typeof SECURITY_OWNERSHIP)[number]["id"];
export type SecurityResultOwner = (typeof SECURITY_OWNERSHIP)[number]["owner"];
export type SecurityResultSemantics = (typeof SECURITY_OWNERSHIP)[number]["semantics"];
