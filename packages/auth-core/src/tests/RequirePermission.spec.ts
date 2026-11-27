import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { AUTH_PERMISSIONS_KEY } from "../libs/constants";
import { RequirePermission } from "../libs/decorators/RequirePermission";

describe("RequirePermission", () => {
  it("stores every distinct permission declared on a method", () => {
    class DocumentController {
      @RequirePermission("document:write", "document:read")
      @RequirePermission("document:read", "folder:read")
      update() {}
    }

    const permissions = Reflect.getMetadata(AUTH_PERMISSIONS_KEY, DocumentController, "update");
    expect(permissions).toHaveLength(3);
    expect(permissions).toEqual(
      expect.arrayContaining(["document:read", "document:write", "folder:read"]),
    );
  });

  it("keeps inherited permissions separate from an overriding declaration", () => {
    class BaseController {
      @RequirePermission("document:read", "folder:read")
      read() {}
    }

    class InheritingController extends BaseController {}

    class OverridingController extends BaseController {
      @RequirePermission("document:audit")
      override read() {}
    }

    expect(Reflect.getMetadata(AUTH_PERMISSIONS_KEY, InheritingController, "read")).toEqual([
      "document:read",
      "folder:read",
    ]);
    expect(Reflect.getMetadata(AUTH_PERMISSIONS_KEY, OverridingController, "read")).toEqual([
      "document:audit",
    ]);
  });
});
