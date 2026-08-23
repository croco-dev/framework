import "reflect-metadata";
import { Controller, Get, Param, Raw } from "@croco/protocols-rest";

type GeneratedRouteContext = {
  readonly req: {
    param(name: string): string | undefined;
  };
};

@Controller("/generated")
export class GeneratedCatchAllController {
  @Get("/assets/:...path")
  getAsset(@Raw() context: GeneratedRouteContext, @Param("path") _path: string): Response {
    return new Response(context.req.param("path"));
  }

  @Get("/items/:id")
  getItem(@Raw() context: GeneratedRouteContext, @Param("id") _id: string): Response {
    return new Response(context.req.param("id"));
  }
}

@Controller()
export class GeneratedRootCatchAllController {
  @Get("/:...path")
  getRootAsset(@Raw() context: GeneratedRouteContext, @Param("path") _path: string): Response {
    return new Response(context.req.param("path"));
  }
}
