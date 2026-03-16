/**
 * 컨트롤러 메타데이터를 저장할 때 사용하는 Reflect 메타데이터 키입니다.
 *
 * @example
 * ```typescript
 * const metadata = Reflect.getMetadata(REST_CONTROLLER_KEY, UserController);
 * ```
 */
/**
 * 라우트 메타데이터 목록을 저장할 때 사용하는 Reflect 메타데이터 키입니다.
 *
 * @example
 * ```typescript
 * const routes = Reflect.getMetadata(REST_ROUTES_KEY, UserController);
 * ```
 */
/**
 * 파라미터 바인딩 메타데이터를 저장할 때 사용하는 Reflect 메타데이터 키입니다.
 *
 * @example
 * ```typescript
 * const params = Reflect.getMetadata(REST_PARAMS_KEY, UserController);
 * ```
 */
/**
 * Guard 메타데이터를 저장할 때 사용하는 Reflect 메타데이터 키입니다.
 *
 * @example
 * ```typescript
 * const guards = Reflect.getMetadata(REST_GUARDS_KEY, UserController);
 * ```
 */
/**
 * Pipe 메타데이터를 저장할 때 사용하는 Reflect 메타데이터 키입니다.
 *
 * @example
 * ```typescript
 * const pipes = Reflect.getMetadata(REST_PIPES_KEY, UserController);
 * ```
 */
/**
 * Interceptor 메타데이터를 저장할 때 사용하는 Reflect 메타데이터 키입니다.
 *
 * @example
 * ```typescript
 * const interceptors = Reflect.getMetadata(REST_INTERCEPTORS_KEY, UserController);
 * ```
 */
/**
 * Exception Filter 메타데이터를 저장할 때 사용하는 Reflect 메타데이터 키입니다.
 *
 * @example
 * ```typescript
 * const filters = Reflect.getMetadata(REST_FILTERS_KEY, UserController);
 * ```
 */
/**
 * 역할 기반 접근 제어 메타데이터를 저장할 때 사용하는 Reflect 메타데이터 키입니다.
 *
 * @example
 * ```typescript
 * const roles = Reflect.getMetadata(REST_ROLES_KEY, UserController, 'deleteUser');
 * ```
 */
/**
 * REST 라우트에서 지원하는 HTTP 메서드 집합입니다.
 *
 * @example
 * ```typescript
 * const method: HttpMethod = HttpMethod.GET;
 * ```
 */
/**
 * 컨트롤러 메서드 파라미터를 어떤 요청 소스에서 읽을지 나타내는 분류입니다.
 *
 * @example
 * ```typescript
 * const type: ParamType = ParamType.QUERY;
 * ```
 */
export {
  HttpMethod,
  ParamType,
  REST_CONTROLLER_KEY,
  REST_FILTERS_KEY,
  REST_GUARDS_KEY,
  REST_INTERCEPTORS_KEY,
  REST_PARAMS_KEY,
  REST_PIPES_KEY,
  REST_ROLES_KEY,
  REST_ROUTES_KEY,
} from './libs/constants';

/**
 * 클래스에 REST 컨트롤러 기본 경로 메타데이터를 등록합니다.
 *
 * @param path - 컨트롤러의 기본 경로입니다.
 * @returns 클래스 데코레이터입니다.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {}
 * ```
 */
export { Controller } from './libs/decorators/Controller';
/**
 * 메서드를 GET 라우트로 등록합니다.
 *
 * @param path - 핸들러에 매핑할 상대 경로입니다.
 * @returns 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Get('/:id')
 *   async getUser() {}
 * }
 * ```
 */
/**
 * 메서드를 POST 라우트로 등록합니다.
 *
 * @param path - 핸들러에 매핑할 상대 경로입니다.
 * @returns 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Post('/')
 *   async createUser() {}
 * }
 * ```
 */
/**
 * 메서드를 PUT 라우트로 등록합니다.
 *
 * @param path - 핸들러에 매핑할 상대 경로입니다.
 * @returns 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Put('/:id')
 *   async replaceUser() {}
 * }
 * ```
 */
/**
 * 메서드를 PATCH 라우트로 등록합니다.
 *
 * @param path - 핸들러에 매핑할 상대 경로입니다.
 * @returns 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Patch('/:id')
 *   async updateUser() {}
 * }
 * ```
 */
/**
 * 메서드를 DELETE 라우트로 등록합니다.
 *
 * @param path - 핸들러에 매핑할 상대 경로입니다.
 * @returns 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Delete('/:id')
 *   async deleteUser() {}
 * }
 * ```
 */
/**
 * 메서드를 OPTIONS 라우트로 등록합니다.
 *
 * @param path - 핸들러에 매핑할 상대 경로입니다.
 * @returns 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Options('/')
 *   async options() {}
 * }
 * ```
 */
/**
 * 메서드를 HEAD 라우트로 등록합니다.
 *
 * @param path - 핸들러에 매핑할 상대 경로입니다.
 * @returns 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Head('/:id')
 *   async headUser() {}
 * }
 * ```
 */
/**
 * 메서드를 모든 HTTP 메서드에 응답하는 라우트로 등록합니다.
 *
 * @param path - 핸들러에 매핑할 상대 경로입니다.
 * @returns 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class HealthController {
 *   @All('/health')
 *   async health() {}
 * }
 * ```
 */
export { All, Delete, Get, Head, Options, Patch, Post, Put } from './libs/decorators/HttpMethod';
/**
 * 클래스 또는 메서드에 Guard 목록을 적용합니다.
 *
 * @param guards - 요청 전 검증에 사용할 Guard 생성자 목록입니다.
 * @returns 클래스 또는 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * @UseGuards(RolesGuard)
 * class AdminController {}
 * ```
 */
/**
 * 클래스 또는 메서드에 Pipe 목록을 적용합니다.
 *
 * @param pipes - 파라미터 변환에 사용할 Pipe 생성자 목록입니다.
 * @returns 클래스 또는 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class TrimPipe implements PipeTransform<string, string> {
 *   transform(value: string) {
 *     return value.trim();
 *   }
 * }
 *
 * class UserController {
 *   @UsePipes(TrimPipe)
 *   async search() {}
 * }
 * ```
 */
/**
 * 클래스 또는 메서드에 Interceptor 목록을 적용합니다.
 *
 * @param interceptors - 요청/응답 흐름을 감싸는 Interceptor 생성자 목록입니다.
 * @returns 클래스 또는 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * @UseInterceptors(LoggingInterceptor)
 * class UserController {}
 * ```
 */
/**
 * 클래스 또는 메서드에 Exception Filter 목록을 적용합니다.
 *
 * @param filters - 예외를 HTTP 응답으로 변환할 Filter 생성자 목록입니다.
 * @returns 클래스 또는 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * @UseFilters(HttpExceptionFilter)
 * class UserController {}
 * ```
 */
export { UseFilters, UseGuards, UseInterceptors, UsePipes } from './libs/decorators/Lifecycle';
/**
 * 경로 파라미터를 메서드 인자에 바인딩합니다.
 *
 * @param name - 읽어올 경로 파라미터 이름입니다.
 * @returns 파라미터 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   async getUser(@Param('id') id: string) {
 *     return id;
 *   }
 * }
 * ```
 */
/**
 * 쿼리스트링 값을 메서드 인자에 바인딩합니다.
 *
 * @param name - 읽어올 쿼리 파라미터 이름입니다.
 * @returns 파라미터 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   async search(@Query('keyword') keyword: string) {
 *     return keyword;
 *   }
 * }
 * ```
 */
/**
 * 요청 헤더 값을 메서드 인자에 바인딩합니다.
 *
 * @param name - 읽어올 헤더 이름입니다.
 * @returns 파라미터 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   async me(@Header('authorization') token: string) {
 *     return token;
 *   }
 * }
 * ```
 */
/**
 * 요청 본문 전체를 메서드 인자에 바인딩합니다.
 *
 * @returns 파라미터 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   async createUser(@Body() body: { name: string }) {
 *     return body;
 *   }
 * }
 * ```
 */
/**
 * 추상화된 HTTP 컨텍스트를 메서드 인자에 바인딩합니다.
 *
 * @returns 파라미터 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   async getContext(@Ctx() context: HttpContext) {
 *     return context.getPath();
 *   }
 * }
 * ```
 */
/**
 * 원본 요청 객체를 메서드 인자에 바인딩합니다.
 *
 * @returns 파라미터 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   async getRaw(@Raw() request: Request) {
 *     return request.url;
 *   }
 * }
 * ```
 */
export { Body, Ctx, Header, Param, Query, Raw } from './libs/decorators/Params';

/**
 * 메서드에 필요한 역할 목록을 등록합니다.
 *
 * @param roles - 접근 허용에 필요한 역할 이름 목록입니다.
 * @returns 메서드 데코레이터입니다.
 *
 * @example
 * ```typescript
 * class AdminController {
 *   @Roles('admin')
 *   async deleteUser() {}
 * }
 * ```
 */
export { Roles } from './libs/decorators/Roles';
/**
 * Problem Details 호환 예외가 제공해야 하는 최소 인터페이스입니다.
 *
 * @property status - HTTP 상태 코드입니다.
 * @property toJSON - Problem Details 응답 본문을 생성하는 메서드입니다.
 *
 * @example
 * ```typescript
 * const problem: ProblemLike = {
 *   status: 404,
 *   toJSON: () => ({ title: 'Not Found', status: 404 }),
 * };
 * ```
 */
/**
 * HttpExceptionFilter가 반환하는 표준 HTTP 응답 형태입니다.
 *
 * @property status - 응답 상태 코드입니다.
 * @property headers - 응답 헤더입니다.
 * @property body - 직렬화된 응답 본문입니다.
 *
 * @example
 * ```typescript
 * const response: HttpExceptionFilterResponse = {
 *   status: 500,
 *   headers: { 'Content-Type': 'application/problem+json' },
 *   body: { title: 'Internal Server Error', status: 500 },
 * };
 * ```
 */
export type { HttpExceptionFilterResponse, ProblemLike } from './libs/filters/HttpExceptionFilter';

/**
 * 예외를 RFC 7807 형태의 HTTP 응답으로 변환하는 기본 Exception Filter입니다.
 *
 * @example
 * ```typescript
 * const filter = new HttpExceptionFilter();
 * const response = filter.catch(new Error('boom'), {} as ExecutionContext);
 * ```
 */
export { HttpExceptionFilter } from './libs/filters/HttpExceptionFilter';
/**
 * 토큰 문자열을 검증하고 사용자 정보를 반환하는 검증 함수 타입입니다.
 *
 * @param token - Authorization 헤더에서 추출한 토큰 문자열입니다.
 * @returns 검증에 성공한 사용자 정보 또는 페이로드입니다.
 *
 * @example
 * ```typescript
 * const verifier: TokenVerifier = async (token) => ({ sub: token });
 * ```
 */
/**
 * AuthGuard 인스턴스를 구성하는 옵션입니다.
 *
 * @property verifier - 토큰 검증 함수입니다.
 * @property [headerName] - 인증 정보를 읽을 헤더 이름입니다.
 * @property [scheme] - 기대하는 Authorization 스킴 이름입니다.
 *
 * @example
 * ```typescript
 * const options: AuthGuardOptions = {
 *   verifier: async (token) => ({ sub: token }),
 *   headerName: 'authorization',
 *   scheme: 'Bearer',
 * };
 * ```
 */
export type { AuthGuardOptions, TokenVerifier } from './libs/guards/AuthGuard';

/**
 * Authorization 헤더를 검증하고 검증된 사용자 정보를 요청 객체에 주입하는 Guard입니다.
 *
 * @example
 * ```typescript
 * const guard = new AuthGuard({
 *   verifier: async (token) => ({ sub: token }),
 * });
 * ```
 */
export { AuthGuard } from './libs/guards/AuthGuard';

/**
 * 역할 정보를 포함한 요청 사용자 객체의 최소 형태입니다.
 *
 * @property [roles] - 사용자에게 부여된 역할 목록입니다.
 *
 * @example
 * ```typescript
 * const user: UserWithRoles = { roles: ['admin'] };
 * ```
 */
export type { UserWithRoles } from './libs/guards/RolesGuard';

/**
 * @Roles 메타데이터와 요청 사용자 역할을 비교해 접근 여부를 결정하는 Guard입니다.
 *
 * @example
 * ```typescript
 * const guard = new RolesGuard();
 * ```
 */
export { RolesGuard } from './libs/guards/RolesGuard';

/**
 * 요청 처리 시간을 기록하는 기본 Interceptor입니다.
 *
 * @example
 * ```typescript
 * const interceptor = new LoggingInterceptor();
 * ```
 */
export { LoggingInterceptor } from './libs/interceptors/LoggingInterceptor';

/**
 * 다음 핸들러 체인을 실행하는 인터페이스입니다.
 *
 * @returns 다음 핸들러의 비동기 실행 결과입니다.
 *
 * @example
 * ```typescript
 * const next: CallHandler<string> = {
 *   async handle() {
 *     return 'ok';
 *   },
 * };
 * ```
 */
export type { CallHandler } from './libs/interfaces/CallHandler';

/**
 * 예외를 프레임워크 응답으로 변환하는 Exception Filter 계약입니다.
 *
 * @param exception - 처리할 예외 값입니다.
 * @param context - 현재 실행 컨텍스트입니다.
 * @returns 프레임워크가 사용할 변환 결과입니다.
 *
 * @example
 * ```typescript
 * const filter: ExceptionFilter<Error, ExecutionContext> = {
 *   catch(exception) {
 *     return { message: exception.message };
 *   },
 * };
 * ```
 */
export type { ExceptionFilter } from './libs/interfaces/ExceptionFilter';

/**
 * Guard, Interceptor, Filter가 공유하는 요청 실행 컨텍스트 계약입니다.
 *
 * @example
 * ```typescript
 * const context: ExecutionContext = {
 *   getRequest: () => new Request('https://example.com/users'),
 *   getClass: () => class UserController {},
 *   getHandler: () => 'getUser',
 *   getPath: () => '/users',
 *   getMethod: () => 'GET',
 * };
 * ```
 */
export type { ExecutionContext } from './libs/interfaces/ExecutionContext';

/**
 * Guard는 @croco/framework-context에서 제공하는 인터페이스입니다.
 *
 * @example
 * ```typescript
 * import type { Guard } from '@croco/framework-context';
 *
 * const guard: Guard<ExecutionContext> = {
 *   canActivate(context) {
 *     return true;
 *   },
 * };
 * ```
 */
// Guard는 framework-context에서 import하세요

/**
 * 요청 전후 로직을 감싸는 Interceptor 계약입니다.
 *
 * @param context - 현재 실행 컨텍스트입니다.
 * @param next - 다음 핸들러 체인입니다.
 * @returns 다음 핸들러를 감싼 비동기 실행 결과입니다.
 *
 * @example
 * ```typescript
 * const interceptor: Interceptor<ExecutionContext> = {
 *   async intercept(_context, next) {
 *     return next.handle();
 *   },
 * };
 * ```
 */
export type { Interceptor } from './libs/interfaces/Interceptor';
/**
 * 파라미터 변환에 필요한 메타데이터입니다.
 *
 * @property type - 파라미터 소스 종류입니다.
 * @property [name] - 파라미터 이름입니다.
 * @property [metatype] - 런타임 타입 정보입니다.
 *
 * @example
 * ```typescript
 * const metadata: ArgumentMetadata = {
 *   type: 'query',
 *   name: 'page',
 * };
 * ```
 */
/**
 * 입력 값을 원하는 형태로 변환하는 Pipe 계약입니다.
 *
 * @param value - 변환할 원본 값입니다.
 * @param metadata - 값의 출처와 타입 정보입니다.
 * @returns 변환된 값입니다.
 *
 * @example
 * ```typescript
 * const pipe: PipeTransform<string, string> = {
 *   transform(value) {
 *     return value.trim();
 *   },
 * };
 * ```
 */
export type { ArgumentMetadata, PipeTransform } from './libs/interfaces/PipeTransform';
/**
 * 클래스에 등록된 컨트롤러 메타데이터를 읽습니다.
 *
 * @param target - 메타데이터를 조회할 컨트롤러 클래스입니다.
 * @returns 등록된 컨트롤러 메타데이터입니다.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {}
 *
 * const metadata = getControllerMeta(UserController);
 * ```
 */
/**
 * 클래스에 등록된 라우트 메타데이터 목록을 읽습니다.
 *
 * @param target - 메타데이터를 조회할 컨트롤러 클래스입니다.
 * @returns 등록된 라우트 메타데이터 배열입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   @Get('/:id')
 *   async getUser() {}
 * }
 *
 * const routes = getRouteMeta(UserController);
 * ```
 */
/**
 * 메서드에 등록된 파라미터 메타데이터 목록을 읽습니다.
 *
 * @param target - 메타데이터를 조회할 컨트롤러 클래스입니다.
 * @param methodName - 메타데이터를 조회할 메서드 이름입니다.
 * @returns 등록된 파라미터 메타데이터 배열입니다.
 *
 * @example
 * ```typescript
 * class UserController {
 *   async getUser(@Param('id') _id: string) {}
 * }
 *
 * const params = getParamsMeta(UserController, 'getUser');
 * ```
 */
/**
 * 클래스 또는 메서드에 등록된 Guard 목록을 읽습니다.
 *
 * @param target - 메타데이터를 조회할 클래스입니다.
 * @param methodName - 메서드 단위 메타데이터를 합쳐 읽을 메서드 이름입니다.
 * @returns 등록된 Guard 생성자 배열입니다.
 *
 * @example
 * ```typescript
 * @UseGuards(RolesGuard)
 * class UserController {}
 *
 * const guards = getGuards(UserController);
 * ```
 */
/**
 * 클래스 또는 메서드에 등록된 Pipe 목록을 읽습니다.
 *
 * @param target - 메타데이터를 조회할 클래스입니다.
 * @param methodName - 메서드 단위 메타데이터를 합쳐 읽을 메서드 이름입니다.
 * @returns 등록된 Pipe 생성자 배열입니다.
 *
 * @example
 * ```typescript
 * class TrimPipe implements PipeTransform<string, string> {
 *   transform(value: string) {
 *     return value.trim();
 *   }
 * }
 *
 * @UsePipes(TrimPipe)
 * class UserController {}
 *
 * const pipes = getPipes(UserController);
 * ```
 */
/**
 * 클래스 또는 메서드에 등록된 Interceptor 목록을 읽습니다.
 *
 * @param target - 메타데이터를 조회할 클래스입니다.
 * @param methodName - 메서드 단위 메타데이터를 합쳐 읽을 메서드 이름입니다.
 * @returns 등록된 Interceptor 생성자 배열입니다.
 *
 * @example
 * ```typescript
 * @UseInterceptors(LoggingInterceptor)
 * class UserController {}
 *
 * const interceptors = getInterceptors(UserController);
 * ```
 */
/**
 * 클래스 또는 메서드에 등록된 Exception Filter 목록을 읽습니다.
 *
 * @param target - 메타데이터를 조회할 클래스입니다.
 * @param methodName - 메서드 단위 메타데이터를 합쳐 읽을 메서드 이름입니다.
 * @returns 등록된 Exception Filter 생성자 배열입니다.
 *
 * @example
 * ```typescript
 * @UseFilters(HttpExceptionFilter)
 * class UserController {}
 *
 * const filters = getFilters(UserController);
 * ```
 */
/**
 * 대상 클래스가 REST 컨트롤러인지 판별합니다.
 *
 * @param target - 판별할 클래스입니다.
 * @returns 컨트롤러 메타데이터가 있으면 true를 반환합니다.
 *
 * @example
 * ```typescript
 * @Controller('/users')
 * class UserController {}
 *
 * const result = isController(UserController);
 * ```
 */
export {
  getControllerMeta,
  getFilters,
  getGuards,
  getInterceptors,
  getParamsMeta,
  getPipes,
  getRouteMeta,
  isController,
} from './libs/metadata/MetadataReader';
/**
 * 임의의 클래스 생성자 시그니처를 표현하는 제네릭 타입입니다.
 *
 * @typeParam T - 생성되는 인스턴스 타입입니다.
 * @param args - 생성자에 전달할 인자 목록입니다.
 * @returns 생성된 인스턴스입니다.
 *
 * @example
 * ```typescript
 * const UserCtor: Constructor<{ id: string }> = class {
 *   id = 'user-1';
 * };
 * ```
 */
/**
 * 컨트롤러에 저장되는 클래스 단위 메타데이터입니다.
 *
 * @property path - 정규화된 기본 경로입니다.
 * @property target - 메타데이터가 연결된 클래스입니다.
 *
 * @example
 * ```typescript
 * const metadata: ControllerMetadata = {
 *   path: '/users',
 *   target: class UserController {},
 * };
 * ```
 */
/**
 * ExceptionFilter 구현체를 생성하는 생성자 타입입니다.
 *
 * @param args - 필터 생성자에 전달할 인자 목록입니다.
 * @returns ExceptionFilter 구현체입니다.
 *
 * @example
 * ```typescript
 * const FilterCtor: ExceptionFilterConstructor = HttpExceptionFilter;
 * ```
 */
/**
 * Guard 구현체를 생성하는 생성자 타입입니다.
 *
 * @param args - Guard 생성자에 전달할 인자 목록입니다.
 * @returns Guard 구현체입니다.
 *
 * @example
 * ```typescript
 * const GuardCtor: GuardConstructor = RolesGuard;
 * ```
 */
/**
 * 전송 계층이 사용할 추상화된 HTTP 컨텍스트 계약입니다.
 *
 * @example
 * ```typescript
 * const context: HttpContext = {
 *   request: { method: 'GET', url: '/users', headers: {} },
 *   response: { status: 200, headers: {} },
 *   param: () => undefined,
 *   query: () => undefined,
 *   header: () => undefined,
 *   json: async () => ({ ok: true }),
 *   set: () => undefined,
 *   get: () => undefined,
 * };
 * ```
 */
/**
 * 전송 계층이 처리할 최소 HTTP 요청 형태입니다.
 *
 * @property method - 요청 메서드입니다.
 * @property url - 요청 URL입니다.
 * @property headers - 요청 헤더입니다.
 * @property [params] - 경로 파라미터 집합입니다.
 * @property [query] - 쿼리스트링 집합입니다.
 *
 * @example
 * ```typescript
 * const request: HttpRequestLike = {
 *   method: 'GET',
 *   url: 'https://example.com/users/1',
 *   headers: { authorization: 'Bearer token' },
 * };
 * ```
 */
/**
 * 전송 계층이 작성할 최소 HTTP 응답 형태입니다.
 *
 * @property status - 응답 상태 코드입니다.
 * @property headers - 응답 헤더입니다.
 *
 * @example
 * ```typescript
 * const response: HttpResponseLike = {
 *   status: 200,
 *   headers: { 'Content-Type': 'application/json' },
 * };
 * ```
 */
/**
 * Interceptor 구현체를 생성하는 생성자 타입입니다.
 *
 * @param args - Interceptor 생성자에 전달할 인자 목록입니다.
 * @returns Interceptor 구현체입니다.
 *
 * @example
 * ```typescript
 * const InterceptorCtor: InterceptorConstructor = LoggingInterceptor;
 * ```
 */
/**
 * 컨트롤러 메서드 파라미터 바인딩 정보를 표현하는 메타데이터입니다.
 *
 * @property type - 파라미터 소스 종류입니다.
 * @property index - 메서드 시그니처의 인자 위치입니다.
 * @property [name] - 요청에서 읽을 키 이름입니다.
 * @property [pipes] - 이 파라미터에 적용할 Pipe 생성자 목록입니다.
 *
 * @example
 * ```typescript
 * const metadata: ParamMetadata = {
 *   type: ParamType.PARAM,
 *   index: 0,
 *   name: 'id',
 * };
 * ```
 */
/**
 * PipeTransform 구현체를 생성하는 생성자 타입입니다.
 *
 * @param args - Pipe 생성자에 전달할 인자 목록입니다.
 * @returns PipeTransform 구현체입니다.
 *
 * @example
 * ```typescript
 * class TrimPipe implements PipeTransform<string, string> {
 *   transform(value: string) {
 *     return value.trim();
 *   }
 * }
 *
 * const PipeCtor: PipeTransformConstructor = TrimPipe;
 * ```
 */
/**
 * 컨트롤러 메서드에 등록되는 라우트 메타데이터입니다.
 *
 * @property method - 매핑된 HTTP 메서드입니다.
 * @property path - 정규화된 라우트 경로입니다.
 * @property methodName - 메타데이터가 연결된 메서드 이름입니다.
 * @property [statusCode] - 선택적 응답 상태 코드입니다.
 *
 * @example
 * ```typescript
 * const metadata: RouteMetadata = {
 *   method: HttpMethod.GET,
 *   path: '/:id',
 *   methodName: 'getUser',
 * };
 * ```
 */
export type {
  Constructor,
  ControllerMetadata,
  ExceptionFilterConstructor,
  GuardConstructor,
  HttpContext,
  HttpRequestLike,
  HttpResponseLike,
  InterceptorConstructor,
  ParamMetadata,
  PipeTransformConstructor,
  RouteMetadata,
} from './libs/types';
