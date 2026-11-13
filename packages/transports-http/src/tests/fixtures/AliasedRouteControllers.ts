import "reflect-metadata";
import { Controller, Get } from "@croco/protocols-rest";

@Controller("/export-names")
class DashController {
  @Get("/dash")
  read(): Response {
    return new Response("dash");
  }
}

@Controller("/export-names")
class SpaceController {
  @Get("/space")
  read(): Response {
    return new Response("space");
  }
}

@Controller("/export-names")
class UnicodeController {
  @Get("/unicode")
  read(): Response {
    return new Response("unicode");
  }
}

@Controller("/export-names")
export default class DefaultController {
  @Get("/default")
  read(): Response {
    return new Response("default");
  }
}

@Controller("/export-names")
export class NamedController {
  @Get("/named")
  read(): Response {
    return new Response("named");
  }
}

export {
  DashController as "odd-name",
  SpaceController as 'with "space"',
  UnicodeController as "🌱한글",
};
