import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { getSearchFieldsMetadata, SEARCH_FIELD_METADATA, SearchField } from '../libs/decorators/SearchField';

describe('@SearchField decorator', () => {
  describe('basic usage', () => {
    it('should store metadata on property', () => {
      class TestEntity {
        @SearchField()
        name!: string;
      }

      const fields = getSearchFieldsMetadata(TestEntity);

      expect(fields).toHaveLength(1);
      expect(fields[0].propertyKey).toBe('name');
    });

    it('should use default searchable true', () => {
      class TestEntity {
        @SearchField()
        name!: string;
      }

      const fields = getSearchFieldsMetadata(TestEntity);

      expect(fields[0].searchable).toBe(true);
    });

    it('should use default filterable false', () => {
      class TestEntity {
        @SearchField()
        name!: string;
      }

      const fields = getSearchFieldsMetadata(TestEntity);

      expect(fields[0].filterable).toBe(false);
    });

    it('should use default sortable false', () => {
      class TestEntity {
        @SearchField()
        name!: string;
      }

      const fields = getSearchFieldsMetadata(TestEntity);

      expect(fields[0].sortable).toBe(false);
    });

    it('should use default derived empty array', () => {
      class TestEntity {
        @SearchField()
        name!: string;
      }

      const fields = getSearchFieldsMetadata(TestEntity);

      expect(fields[0].derived).toEqual([]);
    });
  });

  describe('with options', () => {
    it('should store searchable false', () => {
      class TestEntity {
        @SearchField({ searchable: false })
        id!: string;
      }

      const fields = getSearchFieldsMetadata(TestEntity);

      expect(fields[0].searchable).toBe(false);
    });

    it('should store filterable true', () => {
      class TestEntity {
        @SearchField({ filterable: true })
        status!: string;
      }

      const fields = getSearchFieldsMetadata(TestEntity);

      expect(fields[0].filterable).toBe(true);
    });

    it('should store sortable true', () => {
      class TestEntity {
        @SearchField({ sortable: true })
        createdAt!: Date;
      }

      const fields = getSearchFieldsMetadata(TestEntity);

      expect(fields[0].sortable).toBe(true);
    });

    it('should store derived fields', () => {
      class TestEntity {
        @SearchField({
          derived: [
            { transformId: 'ngram', as: 'name_ngram' },
            { transformId: 'lowercase', as: 'name_lower' },
          ],
        })
        name!: string;
      }

      const fields = getSearchFieldsMetadata(TestEntity);

      expect(fields[0].derived).toEqual([
        { transformId: 'ngram', as: 'name_ngram' },
        { transformId: 'lowercase', as: 'name_lower' },
      ]);
    });

    it('should store all options', () => {
      class TestEntity {
        @SearchField({
          searchable: true,
          filterable: true,
          sortable: true,
          derived: [{ transformId: 'autocomplete', as: 'name_suggest' }],
        })
        name!: string;
      }

      const fields = getSearchFieldsMetadata(TestEntity);

      expect(fields[0]).toEqual({
        propertyKey: 'name',
        searchable: true,
        filterable: true,
        sortable: true,
        derived: [{ transformId: 'autocomplete', as: 'name_suggest' }],
      });
    });
  });

  describe('multiple fields', () => {
    it('should accumulate metadata for multiple fields', () => {
      class ProductEntity {
        @SearchField({ searchable: true, filterable: true })
        name!: string;

        @SearchField({ filterable: true })
        category!: string;

        @SearchField({ sortable: true })
        price!: number;
      }

      const fields = getSearchFieldsMetadata(ProductEntity);

      expect(fields).toHaveLength(3);

      const nameField = fields.find((f) => f.propertyKey === 'name');
      const categoryField = fields.find((f) => f.propertyKey === 'category');
      const priceField = fields.find((f) => f.propertyKey === 'price');

      expect(nameField).toEqual({
        propertyKey: 'name',
        searchable: true,
        filterable: true,
        sortable: false,
        derived: [],
      });

      expect(categoryField).toEqual({
        propertyKey: 'category',
        searchable: true,
        filterable: true,
        sortable: false,
        derived: [],
      });

      expect(priceField).toEqual({
        propertyKey: 'price',
        searchable: true,
        filterable: false,
        sortable: true,
        derived: [],
      });
    });
  });

  describe('getSearchFieldsMetadata', () => {
    it('should return empty array for undecorated class', () => {
      class PlainClass {}

      const fields = getSearchFieldsMetadata(PlainClass);

      expect(fields).toEqual([]);
    });
  });

  describe('metadata key', () => {
    it('should use unique symbol key', () => {
      expect(typeof SEARCH_FIELD_METADATA).toBe('symbol');
    });
  });
});
