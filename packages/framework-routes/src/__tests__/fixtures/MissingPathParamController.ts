import "reflect-metadata";
import { Controller, Get } from "@croco/protocols-rest";

@Controller("/api")
export class MissingPathParamController {
  @Get("/users/:id")
  getUser(): Response {
    return new Response("user");
  }
}
