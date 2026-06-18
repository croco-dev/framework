import "reflect-metadata";
import { Controller, Get, Post } from "@croco/protocols-rest";

@Controller("/api/users")
export class UsersController {
  @Get("/")
  listUsers(): Response {
    return new Response("users");
  }
}

@Controller("/api/posts")
export class PostsController {
  @Post("/")
  createPost(): Response {
    return new Response("created");
  }
}
