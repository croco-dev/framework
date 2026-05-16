import "reflect-metadata";
import { AUTH_PROVIDER_TOKEN, AuthGuard } from "@croco/auth-core";
import { Container } from "@croco/framework-context";
import { Meter, Metered, setMeteringService } from "@croco/metering-core";
import { Body, Controller, Get, Post, UseGuards } from "@croco/protocols-rest";
import { createApp } from "@croco/transports-http";
import { TestAuthProvider } from "./AuthProvider";
import { type CreateUserBody, UserService } from "./UserService";
import { createMeteringService } from "./storage";

@Controller("/api")
class HealthController {
  @Get("/health")
  health() {
    return { status: "ok" };
  }
}

@Meter({ meterId: "api_user_create" })
@Controller("/api/users")
class UserController {
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

setMeteringService(createMeteringService());
Container.set(AUTH_PROVIDER_TOKEN, new TestAuthProvider());
Container.set(AuthGuard, new AuthGuard());

const app = createApp({
  controllers: [HealthController, UserController],
  securityValidation: "off",
});

Container.set(UserController, new UserController());

export const handler = app.lambdaHandler();

if (process.env.NODE_ENV !== "production") {
  app.listen(3000).then(() => {
    console.log("SaaS demo API running at http://localhost:3000/api");
  });
}
