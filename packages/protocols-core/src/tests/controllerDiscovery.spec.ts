import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  discoverControllerConstructors,
  isControllerConstructor,
} from "../libs/controllerDiscovery";
import { Controller } from "./helpers/test-decorators";

describe("controller discovery", () => {
  it("selects only exported controller constructors from a module namespace", () => {
    @Controller("/users")
    class UsersController {}

    class ExportedHelper {}

    const moduleExports = {
      UsersController,
      ExportedHelper,
      default: UsersController,
      value: "not-a-constructor",
    };

    expect(isControllerConstructor(UsersController)).toBe(true);
    expect(isControllerConstructor(ExportedHelper)).toBe(false);
    expect(discoverControllerConstructors(moduleExports)).toEqual([UsersController]);
  });
});
