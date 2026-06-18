import { AuthGuard } from "@croco/auth-core";
import { Container } from "@croco/framework-context";
import { Meter, Metered } from "@croco/metering-core";
import { Body, Controller, Get, Post, UseGuards } from "@croco/protocols-rest";
import { type CreateUserBody, UserService } from "../domain/UserService";

@Meter({ meterId: "api_user_create" })
@Controller("/api/users")
export class UserController {
  private readonly users: UserService;

  constructor() {
    this.users = Container.get(UserService);
  }

  @Get()
  @UseGuards(AuthGuard)
  list() {
    return this.users.list();
  }

  @Post()
  @UseGuards(AuthGuard)
  @Metered({ meterId: "api_user_create" })
  create(@Body() body: CreateUserBody) {
    return this.users.create(body);
  }
}
