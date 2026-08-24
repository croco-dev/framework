import "reflect-metadata";
import { ProblemFactory } from "@croco/problems-core";
import { All, Controller, Get } from "@croco/protocols-rest";

@Controller("/generated")
export class GeneratedRouteController {
  @All("/all")
  all(): Response {
    return new Response("all controller response");
  }

  @Get()
  get(): Response {
    return new Response("generated controller response");
  }

  @Get("/problem")
  problem(): never {
    throw ProblemFactory.validationError("generated-problem", "generated problem");
  }
}
