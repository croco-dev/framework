import "reflect-metadata";
import { Container, MetadataStorage } from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getSearchableMetadata,
  isSearchable,
  SEARCHABLE_METADATA,
  Searchable,
} from "../libs/decorators/Searchable";
import {
  compileSearchableMetadataRegistry,
  findSearchableSourceLocation,
} from "../libs/decorators/SearchableMetadataRegistry";
import { SearchableIndexConflictProblem } from "../libs/problems/SearchProblems";

import type { SearchableIndexDeclaration } from "../libs/decorators/Searchable";

describe("@Searchable decorator", () => {
  beforeEach(() => {
    Container.reset();
  });

  describe("basic usage", () => {
    it("should store metadata on class", () => {
      @Searchable()
      class TestEntity {}

      const metadata = getSearchableMetadata(TestEntity);

      expect(metadata).not.toBeUndefined();
      expect(metadata?.index).toBe("testentity");
    });

    it("should use default index as lowercase class name", () => {
      @Searchable()
      class ProductEntity {}

      const metadata = getSearchableMetadata(ProductEntity);

      expect(metadata?.index).toBe("productentity");
    });

    it("should use default autoSync false", () => {
      @Searchable()
      class TestEntity {}

      const metadata = getSearchableMetadata(TestEntity);

      expect(metadata?.autoSync).toBe(false);
    });
  });

  describe("with options", () => {
    it("should store custom index", () => {
      @Searchable({ index: "custom_index" })
      class TestEntity {}

      const metadata = getSearchableMetadata(TestEntity);

      expect(metadata?.index).toBe("custom_index");
    });

    it("should store autoSync true", () => {
      @Searchable({ autoSync: true })
      class TestEntity {}

      const metadata = getSearchableMetadata(TestEntity);

      expect(metadata?.autoSync).toBe(true);
    });

    it("should store all options", () => {
      @Searchable({
        index: "products",
        autoSync: true,
      })
      class ProductEntity {}

      const metadata = getSearchableMetadata(ProductEntity);

      expect(metadata).toEqual({
        index: "products",
        autoSync: true,
        target: ProductEntity,
        sourceLocation: expect.objectContaining({
          path: expect.stringContaining("Searchable.spec.ts"),
          line: expect.any(Number),
          column: expect.any(Number),
        }),
      });
    });
  });

  describe("isSearchable", () => {
    it("should return true for decorated class", () => {
      @Searchable()
      class DecoratedClass {}

      expect(isSearchable(DecoratedClass)).toBe(true);
    });

    it("should return false for undecorated class", () => {
      class PlainClass {}

      expect(isSearchable(PlainClass)).toBe(false);
    });
  });

  describe("getSearchableMetadata", () => {
    it("should return undefined for undecorated class", () => {
      class PlainClass {}

      const metadata = getSearchableMetadata(PlainClass);

      expect(metadata).toBeUndefined();
    });
  });

  describe("metadata key", () => {
    it("should use unique symbol key", () => {
      expect(typeof SEARCHABLE_METADATA).toBe("symbol");
    });
  });

  describe("multiple classes", () => {
    it("should store independent metadata for each class", () => {
      @Searchable({ index: "products", autoSync: true })
      class ProductEntity {}

      @Searchable({ index: "orders", autoSync: false })
      class OrderEntity {}

      const productMetadata = getSearchableMetadata(ProductEntity);
      const orderMetadata = getSearchableMetadata(OrderEntity);

      expect(productMetadata?.index).toBe("products");
      expect(productMetadata?.autoSync).toBe(true);
      expect(orderMetadata?.index).toBe("orders");
      expect(orderMetadata?.autoSync).toBe(false);
    });

    it("should reject equivalent duplicate index declarations independently of registration order", () => {
      class AlphaEntity {}
      class ZetaEntity {}

      const registerAlpha = (): void => {
        Searchable({ index: "shared" })(AlphaEntity);
      };
      const registerZeta = (): void => {
        Searchable({ index: "shared" })(ZetaEntity);
      };
      const registerInOrder = (registrations: readonly (() => void)[]): unknown => {
        MetadataStorage.clear();
        try {
          registrations.forEach((register) => register());
          return undefined;
        } catch (error) {
          return error;
        }
      };

      const alphaFirst = registerInOrder([registerAlpha, registerZeta]);
      const zetaFirst = registerInOrder([registerZeta, registerAlpha]);

      expect(alphaFirst).toMatchObject({
        code: "search-core/searchable-index-conflict",
        extensions: {
          indexName: "shared",
          declarations: [
            {
              targetName: "AlphaEntity",
              sourceLocation: expect.objectContaining({
                path: expect.stringContaining("Searchable.spec.ts"),
              }),
            },
            {
              targetName: "ZetaEntity",
              sourceLocation: expect.objectContaining({
                path: expect.stringContaining("Searchable.spec.ts"),
              }),
            },
          ],
        },
      });
      expect(zetaFirst).toEqual(alphaFirst);
    });

    it("should capture each application location when reusing a decorator", () => {
      const decorate = Searchable({ index: "shared" });
      class AlphaEntity {}
      class ZetaEntity {}

      decorate(AlphaEntity);

      let conflict: SearchableIndexConflictProblem | undefined;
      try {
        decorate(ZetaEntity);
      } catch (error) {
        if (!(error instanceof SearchableIndexConflictProblem)) throw error;
        conflict = error;
      }

      expect(conflict).toBeDefined();
      const declarations = conflict?.extensions?.declarations as
        | readonly SearchableIndexDeclaration[]
        | undefined;
      expect(declarations?.map((declaration) => declaration.targetName)).toEqual([
        "AlphaEntity",
        "ZetaEntity",
      ]);
      expect(
        new Set(declarations?.map((declaration) => declaration.sourceLocation?.line)).size,
      ).toBe(2);
    });

    it("should select the first conflicting index by code-unit order", () => {
      for (const [index, target] of [
        ["ä", class UmlautOne {}],
        ["z", class ZetaOne {}],
        ["ä", class UmlautTwo {}],
        ["z", class ZetaTwo {}],
      ] as const) {
        MetadataStorage.define(SEARCHABLE_METADATA, target, {
          index,
          autoSync: false,
          target,
        });
      }

      expect(compileSearchableMetadataRegistry).toThrowError(
        expect.objectContaining({
          code: "search-core/searchable-index-conflict",
          extensions: expect.objectContaining({ indexName: "z" }),
        }),
      );
    });
  });

  describe("source locations", () => {
    it.each([
      ["Unix", "at applyDecorator (/app/models/User.ts:12:34)", "/app/models/User.ts"],
      ["file URL", "at applyDecorator (file:///app/models/User.ts:12:34)", "/app/models/User.ts"],
      ["Windows", "at applyDecorator (C:\\app\\models\\User.ts:12:34)", "C:\\app\\models\\User.ts"],
    ])("should parse %s V8 stack frames", (_kind, frame, path) => {
      const stack = ["Error", "at SearchableMetadataRegistry (/internal.ts:1:1)", frame].join("\n");

      expect(findSearchableSourceLocation(stack)).toEqual({ path, line: 12, column: 34 });
    });
  });
});
