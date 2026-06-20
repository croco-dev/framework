import { Body, Controller, Get, Param, Post, Query, ResponseSchema } from "@croco/protocols-rest";
import type { JobStatus } from "../jobs";
import type { JobActionDto } from "./schemas";
import {
  JOB_ID_SCHEMA,
  OPTIONAL_JOBS_INTEGER_QUERY_SCHEMA,
  OPTIONAL_JOB_STATUS_QUERY_SCHEMA,
  OPTIONAL_JOB_TYPE_QUERY_SCHEMA,
  jobActionSchema,
  jobDetailsSchema,
  jobListReportSchema,
  jobLogEntrySchema,
} from "./schemas";

const JOB_STATUSES = new Set<JobStatus>([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "retrying",
  "timed_out",
]);

async function invalidJobsQuery(name: string, value: string): Promise<never> {
  const { InvalidJobsQueryProblem } = await import("../problems");
  throw new InvalidJobsQueryProblem(name, value);
}

async function parseOptionalJobStatus(value: string | undefined): Promise<JobStatus | undefined> {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  if (!JOB_STATUSES.has(value as JobStatus)) {
    return invalidJobsQuery("status", value);
  }

  return value as JobStatus;
}

async function parseOptionalJobsInteger(
  name: string,
  value: string | undefined,
): Promise<number | undefined> {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return invalidJobsQuery(name, value);
  }

  return parsed;
}

@Controller("/ops/jobs")
export class JobsController {
  @Get()
  @ResponseSchema(jobListReportSchema)
  async list(
    @Query("status", OPTIONAL_JOB_STATUS_QUERY_SCHEMA) status?: string,
    @Query("type", OPTIONAL_JOB_TYPE_QUERY_SCHEMA) type?: string,
    @Query("limit", OPTIONAL_JOBS_INTEGER_QUERY_SCHEMA) limit?: string,
    @Query("offset", OPTIONAL_JOBS_INTEGER_QUERY_SCHEMA) offset?: string,
  ) {
    const { defaultSaasRuntime } = await import("../saasDemo");

    return defaultSaasRuntime.jobs.list({
      status: await parseOptionalJobStatus(status),
      type: type && type.length > 0 ? type : undefined,
      limit: await parseOptionalJobsInteger("limit", limit),
      offset: await parseOptionalJobsInteger("offset", offset),
    });
  }

  @Get("/:id")
  @ResponseSchema(jobDetailsSchema)
  async show(@Param("id", JOB_ID_SCHEMA) id: string) {
    const { defaultSaasRuntime } = await import("../saasDemo");
    return defaultSaasRuntime.jobs.show(id);
  }

  @Get("/:id/logs")
  @ResponseSchema(jobLogEntrySchema.array())
  async logs(@Param("id", JOB_ID_SCHEMA) id: string) {
    const { defaultSaasRuntime } = await import("../saasDemo");
    return defaultSaasRuntime.jobs.logs(id);
  }

  @Post("/:id/cancel")
  @ResponseSchema(jobDetailsSchema)
  async cancel(@Param("id", JOB_ID_SCHEMA) id: string, @Body(jobActionSchema) body: JobActionDto) {
    const { defaultSaasRuntime } = await import("../saasDemo");
    return defaultSaasRuntime.jobs.cancel(id, { reason: body.reason });
  }

  @Post("/:id/replay")
  @ResponseSchema(jobDetailsSchema)
  async replay(@Param("id", JOB_ID_SCHEMA) id: string, @Body(jobActionSchema) body: JobActionDto) {
    const { defaultSaasRuntime } = await import("../saasDemo");
    return defaultSaasRuntime.jobs.replay(id, { reason: body.reason });
  }
}
