import { Container } from "typedi";
import { beforeEach, describe, expect, it } from "vitest";
import { CrocoModule, defineCrocoModule, ModuleDuplicateNameProblem } from "../index";

describe("duplicate module names", () => {
  beforeEach(() => {
    CrocoModule.reset();
    Container.reset();
  });

  it("rejects distinct imported modules with the same name before lifecycle execution", () => {
    const calls: string[] = [];
    const firstSharedModule = defineCrocoModule({
      name: "shared",
      setup: () => {
        calls.push("first");
      },
    });
    const secondSharedModule = defineCrocoModule({
      name: "shared",
      setup: () => {
        calls.push("second");
      },
    });
    const rootModule = defineCrocoModule({
      name: "root",
      imports: [
        defineCrocoModule({ name: "left", imports: [firstSharedModule] }),
        defineCrocoModule({ name: "right", imports: [secondSharedModule] }),
      ],
    });

    let failure: unknown;
    try {
      CrocoModule.use(rootModule);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(ModuleDuplicateNameProblem);
    expect(failure).toMatchObject({
      code: "framework-module/duplicate-module-name",
      extensions: {
        moduleName: "shared",
        firstPath: ["root", "left", "shared"],
        conflictingPath: ["root", "right", "shared"],
      },
    });
    expect(calls).toEqual([]);
  });

  it("rejects either registration order instead of selecting a silent winner", () => {
    const firstModule = defineCrocoModule({ name: "shared", setup: () => undefined });
    const secondModule = defineCrocoModule({ name: "shared", start: () => undefined });

    CrocoModule.use(firstModule);
    expect(() => CrocoModule.use(secondModule)).toThrow(
      expect.objectContaining({
        extensions: {
          moduleName: "shared",
          firstPath: ["shared (previously registered)"],
          conflictingPath: ["shared (newly registered)"],
        },
      }),
    );

    CrocoModule.reset();

    CrocoModule.use(secondModule);
    expect(() => CrocoModule.use(firstModule)).toThrow(ModuleDuplicateNameProblem);
  });

  it("deduplicates repeated imports of the same module definition", async () => {
    const calls: string[] = [];
    const sharedModule = defineCrocoModule({
      name: "shared",
      setup: () => {
        calls.push("shared");
      },
    });
    const rootModule = defineCrocoModule({
      name: "root",
      imports: [
        defineCrocoModule({ name: "left", imports: [sharedModule] }),
        defineCrocoModule({ name: "right", imports: [sharedModule] }),
      ],
    });

    CrocoModule.use(rootModule);
    await CrocoModule.initialize();

    expect(calls).toEqual(["shared"]);
  });

  it("deduplicates repeated top-level registration of the same module definition", async () => {
    const calls: string[] = [];
    const sharedModule = defineCrocoModule({
      name: "shared",
      setup: () => {
        calls.push("shared");
      },
    });

    CrocoModule.use(sharedModule);
    CrocoModule.use(sharedModule);
    await CrocoModule.initialize();

    expect(calls).toEqual(["shared"]);
  });
});
