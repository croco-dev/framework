import { Meter, Metered } from "@croco/metering-core";
import { Body, Controller, Get, Post, UseGuards } from "@croco/protocols-rest";
import type { CreateUserBody, UserService } from "../domain/UserService";
import { ApiKeyGuard } from "../integrations/ApiKeyGuard";

@Meter({ meterId: "api_user_create" })
@Controller("/api/users")
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  @UseGuards(ApiKeyGuard)
  list() {
    return this.users.list();
  }

  @Post()
  @UseGuards(ApiKeyGuard)
  @Metered({ meterId: "api_user_create" })
  create(@Body() body: CreateUserBody) {
    return this.users.create(body);
  }
}
