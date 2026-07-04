import { Component } from "@croco/framework-context";
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
  type RouteResponse,
  routeProblemResponses,
} from "@croco/protocols-rest";
import { getAdminConsoleService } from "../admin";
import {
  adminCreateUserRoute,
  adminGetUserRoute,
  adminListOperationsRoute,
  adminListUsersRoute,
  adminSnapshotRoute,
} from "./adminSchemas";

@Component()
@Controller("/admin")
export class AdminController {
  @Get(adminSnapshotRoute)
  async snapshot(
    @Query(adminSnapshotRoute, "tenantId")
    tenantId?: RouteQueryParam<typeof adminSnapshotRoute, "tenantId">,
  ): Promise<RouteResponse<typeof adminSnapshotRoute>> {
    return await getAdminConsoleService().snapshot(tenantId);
  }

  @Get(adminListUsersRoute)
  async listUsers(
    @Query(adminListUsersRoute, "tenantId")
    tenantId?: RouteQueryParam<typeof adminListUsersRoute, "tenantId">,
  ): Promise<RouteResponse<typeof adminListUsersRoute>> {
    return await getAdminConsoleService().listUsers(tenantId);
  }

  @Get(adminGetUserRoute)
  @ProblemResponses(...routeProblemResponses(adminGetUserRoute))
  async getUser(
    @Param(adminGetUserRoute, "id") id: RouteParam<typeof adminGetUserRoute, "id">,
    @Query(adminGetUserRoute, "tenantId")
    tenantId?: RouteQueryParam<typeof adminGetUserRoute, "tenantId">,
  ): Promise<RouteResponse<typeof adminGetUserRoute>> {
    return await getAdminConsoleService().getUser(id, tenantId);
  }

  @Post(adminCreateUserRoute)
  async createUser(
    @Body(adminCreateUserRoute) input: RouteBody<typeof adminCreateUserRoute>,
  ): Promise<RouteResponse<typeof adminCreateUserRoute>> {
    return await getAdminConsoleService().createUser(input);
  }

  @Get(adminListOperationsRoute)
  async listOperations(
    @Query(adminListOperationsRoute, "tenantId")
    tenantId?: RouteQueryParam<typeof adminListOperationsRoute, "tenantId">,
  ): Promise<RouteResponse<typeof adminListOperationsRoute>> {
    return await getAdminConsoleService().listOperations(tenantId);
  }
}
