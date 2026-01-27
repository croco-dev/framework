import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ParamType } from '../libs/constants';
import { Controller } from '../libs/decorators/Controller';
import { Get } from '../libs/decorators/HttpMethod';
import { Body, Param, Query } from '../libs/decorators/Params';
import { getParamsMeta } from '../libs/metadata/MetadataReader';

describe('Param decorators', () => {
  it('should register param metadata', () => {
    @Controller('/users')
    class UserController {
      @Get('/:id')
      getUser(@Param('id') id: string, @Query('include') include: string) {
        return { id, include };
      }
    }

    const params = getParamsMeta(UserController, 'getUser');
    expect(params).toHaveLength(2);

    const idParam = params.find((p) => p.name === 'id');
    expect(idParam?.type).toBe(ParamType.PARAM);
    expect(idParam?.index).toBe(0);

    const includeParam = params.find((p) => p.name === 'include');
    expect(includeParam?.type).toBe(ParamType.QUERY);
    expect(includeParam?.index).toBe(1);
  });

  it('should register body without name', () => {
    @Controller('/users')
    class UserController {
      @Get()
      create(@Body() body: unknown) {
        return body;
      }
    }

    const params = getParamsMeta(UserController, 'create');
    expect(params).toHaveLength(1);
    expect(params[0].type).toBe(ParamType.BODY);
    expect(params[0].name).toBeUndefined();
  });
});
