import { Component } from "@croco/framework-context";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  ProblemResponses,
  Put,
  type RouteBody,
  type RouteParam,
  type RouteResponse,
  routeProblemResponses,
} from "@croco/protocols-rest";
import {
  createUserRoute,
  deleteUserRoute,
  getUserRoute,
  listUsersRoute,
  updateUserRoute,
} from "./userSchemas";
import { getUserService } from "../users";

@Component()
@Controller("/users")
export class UserController {
  @Get(listUsersRoute)
  async list(): Promise<RouteResponse<typeof listUsersRoute>> {
    return [...(await getUserService().list())];
  }

  @Get(getUserRoute)
  @ProblemResponses(...routeProblemResponses(getUserRoute))
  async getById(
    @Param(getUserRoute, "id") id: RouteParam<typeof getUserRoute, "id">,
  ): Promise<RouteResponse<typeof getUserRoute>> {
    return await getUserService().getById(id);
  }

  @Post(createUserRoute)
  async create(
    @Body(createUserRoute) input: RouteBody<typeof createUserRoute>,
  ): Promise<RouteResponse<typeof createUserRoute>> {
    return await getUserService().create(input);
  }

  @Put(updateUserRoute)
  @ProblemResponses(...routeProblemResponses(updateUserRoute))
  async update(
    @Param(updateUserRoute, "id") id: RouteParam<typeof updateUserRoute, "id">,
    @Body(updateUserRoute) input: RouteBody<typeof updateUserRoute>,
  ): Promise<RouteResponse<typeof updateUserRoute>> {
    return await getUserService().update(id, input);
  }

  @Delete(deleteUserRoute)
  @ProblemResponses(...routeProblemResponses(deleteUserRoute))
  async delete(
    @Param(deleteUserRoute, "id") id: RouteParam<typeof deleteUserRoute, "id">,
  ): Promise<RouteResponse<typeof deleteUserRoute>> {
    return await getUserService().delete(id);
  }
}
