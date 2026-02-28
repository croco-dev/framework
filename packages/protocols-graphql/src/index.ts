/**
 * GraphQL Resolver 메타데이터를 저장/조회할 때 사용하는 Reflect 메타데이터 키입니다.
 */
export { RESOLVER_KEY, RESOLVERS_KEY } from './libs/constants';

/**
 * `@GraphQLResolver` 데코레이터 옵션과 Subscription용 PubSub 계약 타입입니다.
 */
export type { GraphQLResolverOptions, PubSub } from './libs/decorators';

/**
 * TypeGraphQL 기반의 스키마/리졸버 정의 데코레이터와 스칼라 헬퍼를 제공합니다.
 */
export {
  Arg,
  Args,
  ArgsType,
  Authorized,
  Ctx,
  Field,
  FieldResolver,
  Float,
  GraphQLResolver,
  ID,
  Info,
  InputType,
  Int,
  InterfaceType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  Subscription,
} from './libs/decorators';

/**
 * Resolver 메타데이터를 조회하고 등록된 Resolver 목록을 읽기 위한 유틸리티입니다.
 */
export {
  getAllResolvers,
  getResolverMetadata,
  isResolver,
} from './libs/metadata/MetadataReader';

/**
 * GraphQL Resolver 작성 시 사용하는 공통 타입 집합입니다.
 */
export type {
  ClassType,
  GraphQLContext,
  GraphQLResolverMetadata,
  MiddlewareFn,
  ResolverData,
  ResolverMetadata,
} from './libs/types';
