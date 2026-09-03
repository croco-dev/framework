import type { ExecutionStatus } from "@croco/execution-core";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ProblemResponses,
  Query,
  type RouteBody,
  type RouteParam,
  type RouteQueryParam,
  routeProblemResponses,
} from "@croco/protocols-rest";
import { getSaasRuntimeState } from "../saasDemo";
import {
  cancelJobRoute,
  jobLogsRoute,
  listJobsRoute,
  replayJobRoute,
  showJobRoute,
} from "./schemas";

const JOB_STATUSES = new Set<ExecutionStatus>([
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

async function parseOptionalJobStatus(
  value: string | undefined,
): Promise<ExecutionStatus | undefined> {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  if (!JOB_STATUSES.has(value as ExecutionStatus)) {
    return invalidJobsQuery("status", value);
  }

  return value as ExecutionStatus;
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
  @Get(listJobsRoute)
  @ProblemResponses(...routeProblemResponses(listJobsRoute))
  async list(
    @Query(listJobsRoute, "status") status?: RouteQueryParam<typeof listJobsRoute, "status">,
    @Query(listJobsRoute, "type") type?: RouteQueryParam<typeof listJobsRoute, "type">,
    @Query(listJobsRoute, "replayOf") replayOf?: RouteQueryParam<typeof listJobsRoute, "replayOf">,
    @Query(listJobsRoute, "limit") limit?: RouteQueryParam<typeof listJobsRoute, "limit">,
    @Query(listJobsRoute, "offset") offset?: RouteQueryParam<typeof listJobsRoute, "offset">,
  ) {
    return getSaasRuntimeState().current.jobs.list({
      status: await parseOptionalJobStatus(status),
      type: type && type.length > 0 ? type : undefined,
      replayOf: replayOf && replayOf.length > 0 ? replayOf : undefined,
      limit: await parseOptionalJobsInteger("limit", limit),
      offset: await parseOptionalJobsInteger("offset", offset),
    });
  }

  @Get(showJobRoute)
  @ProblemResponses(...routeProblemResponses(showJobRoute))
  async show(@Param(showJobRoute, "id") id: RouteParam<typeof showJobRoute, "id">) {
    return getSaasRuntimeState().current.jobs.show(id);
  }

  @Get(jobLogsRoute)
  @ProblemResponses(...routeProblemResponses(jobLogsRoute))
  async logs(@Param(jobLogsRoute, "id") id: RouteParam<typeof jobLogsRoute, "id">) {
    return getSaasRuntimeState().current.jobs.logs(id);
  }

  @Post(cancelJobRoute)
  @ProblemResponses(...routeProblemResponses(cancelJobRoute))
  async cancel(
    @Param(cancelJobRoute, "id") id: RouteParam<typeof cancelJobRoute, "id">,
    @Body(cancelJobRoute) body: RouteBody<typeof cancelJobRoute>,
  ) {
    return getSaasRuntimeState().current.jobs.cancel(id, { reason: body.reason });
  }

  @Post(replayJobRoute)
  @ProblemResponses(...routeProblemResponses(replayJobRoute))
  async replay(
    @Param(replayJobRoute, "id") id: RouteParam<typeof replayJobRoute, "id">,
    @Body(replayJobRoute) body: RouteBody<typeof replayJobRoute>,
  ) {
    return getSaasRuntimeState().current.jobs.replay(id, { reason: body.reason });
  }
}
