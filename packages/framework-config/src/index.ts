/**
 * 환경 변수 값을 조회하고 타입 안전하게 접근하는 설정 서비스입니다.
 */
export * from "./ConfigService";

/**
 * 기본 preset을 조합한 공용 env 객체와 관련 API입니다.
 */
export * from "./core";

/**
 * 설정 클래스를 스키마와 연결하는 데코레이터입니다.
 */
export * from "./decorators/ConfigSchema";

/**
 * 설정 검증 과정에서 사용하는 Problem 하위 타입들입니다.
 */
export * from "./libs/problems/ConfigProblems";

/**
 * 애플리케이션 공통 환경 변수 preset입니다.
 */
export * from "./presets/app";

/**
 * 데이터베이스 환경 변수 preset입니다.
 */
export * from "./presets/database";

/**
 * Redis 환경 변수 preset입니다.
 */
export * from "./presets/redis";

/**
 * 스토리지 환경 변수 preset입니다.
 */
export * from "./presets/storage";

/**
 * Zod 스키마로 환경 변수를 검증하는 유틸리티입니다.
 */
export * from "./validateConfig";
