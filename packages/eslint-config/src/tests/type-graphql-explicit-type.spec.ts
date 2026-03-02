import * as tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../rules/type-graphql-explicit-type';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
});

ruleTester.run('type-graphql-explicit-type', rule, {
  valid: [
    { code: 'class A { @Field(() => String) name: string; }' },
    { code: 'class A { @Query(() => User) getUser(): User {} }' },
    { code: 'class A { @Mutation(() => Boolean) createUser(): boolean {} }' },
    { code: 'class A { @Field(() => Int, { nullable: true }) count: number; }' },
    { code: 'class A { @Field(() => [User]) users: User[]; }' },
    { code: 'class A { @Other() test: any; }' }, // other decorator
  ],
  invalid: [
    {
      code: 'class A { @Field() name: string; }',
      errors: [{ messageId: 'missingTypeArg', data: { decoratorName: '@Field' } }],
    },
    {
      code: 'class A { @Query() getUser(): User {} }',
      errors: [{ messageId: 'missingTypeArg', data: { decoratorName: '@Query' } }],
    },
    {
      code: 'class A { @Mutation() createUser(): User {} }',
      errors: [{ messageId: 'missingTypeArg', data: { decoratorName: '@Mutation' } }],
    },
    {
      code: 'class A { @Field({ nullable: true }) isActive: boolean; }',
      errors: [{ messageId: 'missingTypeArg', data: { decoratorName: '@Field' } }],
    },
    {
      code: 'class A { @Field() count: number; }',
      errors: [{ messageId: 'missingTypeArg', data: { decoratorName: '@Field' } }],
    },
  ],
});
