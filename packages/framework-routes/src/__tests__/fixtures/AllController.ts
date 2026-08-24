import "reflect-metadata";
import { All, Controller } from "@croco/protocols-rest";

@Controller("/hooks")
export class AllController {
  @All()
  handle(): Response {
    return new Response("all route response");
  }
}
