import "reflect-metadata";
import { Controller, Get, Post } from "@croco/protocols-rest";

@Controller("/api")
export class SampleController {
  @Get("/hello")
  hello(): Response {
    return new Response("hello");
  }

  @Post("/users")
  createUser(): Response {
    return new Response("created");
  }
}
