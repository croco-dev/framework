import "reflect-metadata";
import { Container } from "@croco/framework-context";
import {
  Body,
  Controller,
  Get,
  HttpMethod,
  Param,
  ParamType,
  Post,
  Query,
  REST_CONTROLLER_KEY,
  REST_PARAMS_KEY,
  REST_ROUTES_KEY,
  defineRouteContract,
} from "@croco/protocols-rest";
import { z } from "zod";

class UserResponse {
  id!: number;
  name!: string;
}

class CreateUserBody {
  name!: string;
}

const getUserContract = defineRouteContract({
  method: HttpMethod.GET,
  path: "/users/:id",
  params: z.object({ id: z.coerce.number() }),
  query: z.object({ view: z.enum(["compact", "full"]) }),
  response: z.object({ id: z.number(), name: z.string() }),
});

const createUserContract = defineRouteContract({
  method: HttpMethod.POST,
  path: "/users",
  body: z.object({ name: z.string() }),
  response: z.object({ id: z.number(), name: z.string() }),
});

@Controller("/users")
class PackedController {
  @Get(getUserContract)
  getUser(
    @Param(getUserContract, "id") id: number,
    @Query(getUserContract, "view") view: "compact" | "full",
  ): UserResponse {
    return { id, name: view };
  }

  @Post(createUserContract)
  async createUser(@Body(createUserContract) body: CreateUserBody): Promise<UserResponse> {
    return { id: 11, name: body.name };
  }
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const controllerMetadata = Reflect.getMetadata(REST_CONTROLLER_KEY, PackedController) as
  | { path: string; target: unknown }
  | undefined;
invariant(controllerMetadata?.path === "/users", "controller path metadata was not registered");
invariant(
  controllerMetadata.target === PackedController,
  "controller target metadata was not registered",
);

const routes = Reflect.getMetadata(REST_ROUTES_KEY, PackedController) as
  | Array<{ contract?: unknown; method: HttpMethod; methodName: string | symbol; path: string }>
  | undefined;
invariant(routes?.length === 2, "route metadata was not registered");
const getRoute = routes.find(({ methodName }) => methodName === "getUser");
const postRoute = routes.find(({ methodName }) => methodName === "createUser");
invariant(getRoute?.method === HttpMethod.GET, "GET method metadata was not preserved");
invariant(getRoute.path === "/:id", "GET contract path was not controller-relative");
invariant(getRoute.contract === getUserContract, "GET contract metadata was not preserved");
invariant(postRoute?.method === HttpMethod.POST, "POST method metadata was not preserved");
invariant(postRoute.path === "", "POST contract path was not controller-relative");
invariant(postRoute.contract === createUserContract, "POST contract metadata was not preserved");

const params = Reflect.getMetadata(REST_PARAMS_KEY, PackedController) as
  | Map<string | symbol, Array<{ index: number; name?: string; type: ParamType }>>
  | undefined;
const getParams = [...(params?.get("getUser") ?? [])].sort(
  (left, right) => left.index - right.index,
);
const postParams = params?.get("createUser") ?? [];
invariant(
  getParams[0]?.type === ParamType.PARAM && getParams[0].name === "id",
  "path parameter metadata was not preserved",
);
invariant(
  getParams[1]?.type === ParamType.QUERY && getParams[1].name === "view",
  "query parameter metadata was not preserved",
);
invariant(postParams[0]?.type === ParamType.BODY, "body parameter metadata was not preserved");

const getParamTypes = Reflect.getMetadata(
  "design:paramtypes",
  PackedController.prototype,
  "getUser",
) as unknown[] | undefined;
const postParamTypes = Reflect.getMetadata(
  "design:paramtypes",
  PackedController.prototype,
  "createUser",
) as unknown[] | undefined;
invariant(
  getParamTypes?.[0] === Number && getParamTypes[1] === String,
  "GET design:paramtypes regressed",
);
invariant(postParamTypes?.[0] === CreateUserBody, "POST design:paramtypes regressed");
invariant(
  Reflect.getMetadata("design:type", PackedController.prototype, "getUser") === Function,
  "GET design:type regressed",
);
invariant(
  Reflect.getMetadata("design:type", PackedController.prototype, "createUser") === Function,
  "POST design:type regressed",
);

async function verifyRuntime(): Promise<void> {
  const controller = Container.get(PackedController);
  const getResult = controller.getUser(7, "full");
  const postResult = await controller.createUser({ name: "packed" });
  invariant(
    getResult.id === 7 && getResult.name === "full",
    "registered GET controller invocation failed",
  );
  invariant(
    postResult.id === 11 && postResult.name === "packed",
    "registered POST controller invocation failed",
  );
}

void verifyRuntime().catch((error: unknown) => {
  setTimeout(() => {
    throw error;
  });
});
