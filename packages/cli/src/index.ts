export { detect } from "./libs/workspace";
export {
  normalize,
  validate,
  pluralize,
  toPascalCase,
  toKebabCase,
  toCamelCase,
} from "./libs/naming";
export { write as writeFile } from "./libs/fileWriter";
export type { WriteResult, WriteStatus, WriteOptions } from "./libs/fileWriter";
export { confirmOverwrite, selectMode, textInput, NoTtyError } from "./libs/prompts";
export type { PromptResult } from "./libs/prompts";
export { codegen } from "./commands/codegen";
export { codegenOpenapi } from "./commands/codegenOpenapi";
export { codegenRpc } from "./commands/codegenRpc";
export {
  architecturePolicy,
  architecturePolicyCheck,
  parseArchitecturePolicyCheckArgs,
  runArchitecturePolicyCheck,
} from "./commands/architecturePolicy";
export { contracts } from "./commands/contracts";
export { contractsCheck, runContractsCheck } from "./commands/contractsCheck";
export { create } from "./commands/create";
export { createDomain } from "./commands/createDomain";
export { createPage } from "./commands/createPage";
export { di } from "./commands/di";
export { diCheck, parseDiCheckArgs, runDiCheck } from "./commands/diCheck";
export { diGraph, parseDiGraphArgs, runDiGraph } from "./commands/diGraph";
export { doctor, formatDoctorReport, getDoctorExitCode, runDoctor } from "./commands/doctor";
export { generate } from "./commands/generate";
export { generateScaffold } from "./commands/generateScaffold";
export {
  generateUsageDashboard,
  runGenerateUsageDashboard,
} from "./commands/generateUsageDashboard";
export {
  formatJobDetails,
  formatJobLogs,
  formatJobsListReport,
  getJobExitCode,
  getJobsListExitCode,
  jobs,
  runJobsCancel,
  runJobsList,
  runJobsLogs,
  runJobsReplay,
  runJobsShow,
} from "./commands/jobs";
export { make } from "./commands/make";
export { makeController } from "./commands/makeController";
export { makeEntity } from "./commands/makeEntity";
export { makeEvent } from "./commands/makeEvent";
export { makeListener } from "./commands/makeListener";
export { makeRepository } from "./commands/makeRepository";
export { migrate, runMigrateCommand } from "./commands/migrate";
export { formatUpgradeReport, runUpgrade, upgrade } from "./commands/upgrade";
export {
  formatOpsStatusReport,
  getOpsStatusExitCode,
  ops,
  opsCheck,
  opsStatus,
  runOpsCheck,
  runOpsStatus,
} from "./commands/ops";
export {
  parseRuntimePolicyCheckArgs,
  runRuntimePolicyCheck,
  runtimePolicy,
  runtimePolicyCheck,
} from "./commands/runtimePolicy";
export { GLOBAL_OPTIONS } from "./commands/options";
export { createCrocoCommand, runCroco } from "./commands/root";

export type { DiCheckDiagnostic, DiCheckIo, DiCheckReport } from "./commands/diCheck";
export type {
  DiGraphFrameworkContextLoader,
  DiGraphIo,
  DiGraphModuleLoader,
} from "./commands/diGraph";
export type { ArchitecturePolicyCheckIo } from "./commands/architecturePolicy";
export type { CrocoRunResult } from "./commands/root";
export type { CrocoCommandDependencies } from "./libs/cliRuntime";

export type {
  DoctorCheckResult,
  DoctorCheckStatus,
  DoctorDiagnostic,
  DoctorLocation,
  DoctorPackage,
  DoctorReport,
  DoctorSeverity,
  DoctorSummary,
  RunDoctorOptions,
} from "./commands/doctor";

export type {
  JobDetails,
  JobFailurePolicy,
  JobListReport,
  JobLogEntry,
  JobsCommandClient,
  JobsListFilters,
  JobsStatusFetch,
  JobSummary,
  RunJobsOptions,
} from "./commands/jobs";

export type {
  OpsEndpointName,
  OpsEndpointSnapshot,
  OpsStatusFetch,
  OpsStatusReport,
  OpsStatusSummary,
  RunOpsStatusOptions,
} from "./commands/ops";

export type { RuntimePolicyCheckIo } from "./commands/runtimePolicy";
export type {
  MigrateCommand,
  MigrateCommandResult,
  MigrationRunnerSpawn,
  RunMigrateCommandOptions,
} from "./commands/migrate";
export type {
  UpgradeDirent,
  UpgradeFinding,
  UpgradeFindingAction,
  UpgradeFindingConfidence,
  UpgradeIo,
  UpgradeReport,
  UpgradeReportMode,
  UpgradeSourceLocation,
} from "./commands/upgrade";
