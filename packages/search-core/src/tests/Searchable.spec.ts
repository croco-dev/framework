import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  getSearchableMetadata,
  isSearchable,
  SEARCHABLE_METADATA,
  Searchable,
} from "../libs/decorators/Searchable";

describe("@Searchable decorator", () => {
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
  });
});
