# 🐊 Croco Framework Roadmap

> **"Node.js의 Spring"** — NestJS의 견고한 아키텍처 + Hono의 서버리스 성능

---

## Vision

Croco는 Node.js 진영에서 가장 신뢰받는 엔터프라이즈 프레임워크가 되는 것을 목표로 합니다. JVM의 Spring이 그렇듯, 대규모 시스템에서도 일관된 아키텍처, 높은 생산성, 검증된 패턴을 제공합니다.

### Why Croco?

NestJS가 Node.js 엔터프라이즈 시장을 선도하고 있지만, 다음과 같은 근본적 한계가 있습니다:

| 문제 | NestJS | Croco |
|------|--------|-------|
| **성능** | 콜드스타트 500ms~2000ms (런타임 리플렉션 스캔) | 목표: 50ms 미만 (Zero-Scan DI) |
| **설정** | Module, Controller, Service, Guard, Interceptor, Pipe... | Convention over Configuration |
| **코드** | 데코레이터 지옥, 과도한 보일러플레이트 | Functional-friendly, 최소한의 ceremony |
| **런타임** | Node.js 종속적 | Multi-runtime (Node, Bun, Deno, Edge) |

---

## Core Principles

### 1. Performance First
- 불필요한 추상화 제거
- Lambda 콜드스타트 최소화
- Zero-Scan DI (빌드타임 의존성 그래프 생성)

### 2. Convention over Configuration
- 90%는 컨벤션으로 자동 추론
- 명시적 설정은 10%만
- "설정보다 관례"가 기본, 예외만 선언

### 3. Simplicity
- Fewer concepts, 더 적은 보일러플레이트
- 함수형 스타일 권장, 클래스는 필요시만
- 러닝커브 최소화

### 4. Serverless Native
- AWS Lambda를 First-class Citizen으로
- API Gateway v2 최적화
- Cold start를 고려한 설계

### 5. End-to-End Type Safety
- 별도 스키마 없이 타입 공유
- tRPC 수준의 타입 안전성
- OpenAPI/GraphQL 자동 생성

### 6. Built-in Observability
- OpenTelemetry OTLP 기본 지원
- 분산 추적 (Distributed Tracing)
- 메트릭, 로그, 트레이스 통합

### 7. Developer Experience
- CLI 도구 (`create-croco-app`)
- 테스트 유틸리티 (`@croco/testing`)
- Hot Reload, DevTools

---

## Target Positioning

```
         복잡도 ↑
              │
   Spring ────┼──── NestJS
              │
   Croco ─────┼──── Hono
              │
         Fastify ── Express
              │
              └──────────────────→ 성능
```

Croco는 **Spring 수준의 구조화** + **Hono 수준의 성능**을 동시에 달성합니다.

---

## Current State (2026 Q1)

### 패키지 현황

총 **70개** 패키지로 구성된 모노레포입니다.

#### 완성도 높은 패키지 (테스트 10개 내외)
| 패키지 | 역할 | 테스트 |
|--------|------|-------|
| `auth-core` | 인증/인가 (RBAC, API Key, JWT) | 12 |
| `transports-http` | HTTP 실행 엔진 (Hono 기반) | 10 |
| `events-core` | 도메인 이벤트 발행/구독 | 9 |
| `metering-core` | 사용량 측정/할당량 관리 | 9 |
| `ratelimit-core` | Rate Limiting 전략 | 7 |
| `retry-core` | 재시도/Circuit Breaker | 8 |
| `framework-context` | DI 컨테이너/Lifecycle | 5 |

#### 개선 필요 패키지
| 패키지 | 문제점 | 우선순위 |
|--------|--------|---------|
| `*-drizzle` 계열 | 테스트 전무/부족 | **High** |
| `audit-drizzle` | 테스트 0개 | High |
| `onboarding-drizzle` | 테스트 0개 | High |
| `docs` | placeholder 상태 | Medium |
| `utils-node` | Deprecated | Cleanup |

### 아키텍처 계층

```
Level 0: problems-core (에러 처리)
Level 1: framework-context (DI/Lifecycle), telemetry-api
Level 2: events-core, tx-core (도메인 로직)
Level 3: auth-core, access-core, transports-http (애플리케이션)
Level 4: *-drizzle, *-qstash, *-upstash (어댑터)
```

### 실제 사용 현황

**프로덕션 사용 프로젝트:**
- darun (https://darun.kr)
- slackbase.org
- pedaling 조직 내 다수 서비스

**자주 사용되는 패키지:**
- `@croco/problems-core` (RFC 7807 에러 처리)
- `@croco/events-core` (도메인 이벤트)
- `@croco/utils-structure-react` (React 바인딩)

## Strategic Pillars

Node.js의 Spring이 되기 위한 4대 전략 pillar입니다.

### Pillar 1: Core Excellence (핵심 완성도)

NestJS를 능가하는 기술적 우위 확보.

**목표:**
- 콜드스타트 50ms 미만 (NestJS 대비 10x 개선)
- Zero-Scan DI 구현 (빌드타임 의존성 그래프)
- 테스트 커버리지 80% 이상

**핵심 과제:**
1. **DI 시스템 재설계** - 런타임 리플렉션 제거, 컴파일타임 그래프 생성
2. **성능 벤치마크** - NestJS, Hono, Fastify와의 공식 비교
3. **메모리 최적화** - Lambda 환경에서의 메모리 프로파일링

### Pillar 2: Ecosystem Expansion (생태계 확장)

Spring처럼 "이게 다 Croco로 만들어졌구나"를 느끼게 하는 통합 패키지.

**목표:**
- 100개+ 통합 패키지
- 주요 SaaS 20개 이상 공식 지원
- 커뮤니티 contributed 패키지 생태계

**핵심 과제:**
1. **DB Layer 완성** - Drizzle, Prisma, Kysely 어댑터
2. **Message Queue** - SQS, Kafka, RabbitMQ, Redis Streams
3. **Cache Layer** - Redis, Upstash, Memcached
4. **Storage Layer** - S3, R2, Cloudflare Images
5. **Search** - Elasticsearch, Meilisearch, OpenSearch
6. **Payment** - Stripe, Toss, Polar
7. **Communication** - Slack, Discord, Email (Resend/SendGrid)

### Pillar 3: Developer Experience (개발자 경험)

NestJS보다 빠른 개발, 더 적은 보일러플레이트.

**목표:**
- 새 프로젝트 생성: 30초 이내
- 첫 API 배포: 5분 이내
- 학습 곡선: 2시간 이내 핵심 습득

**핵심 과제:**
1. **CLI 도구** - `create-croco-app`, 코드 제너레이터
2. **테스트 유틸리티** - `@croco/testing` (DI 모킹, 통합 테스트)
3. **VS Code Extension** - 데코레이터 자동완성, 타입 힌트
4. **DevTools** - 런타임 디버깅, 이벤트 흐름 시각화
5. **Hot Reload** - 개발 환경에서의 즉시 반영

### Pillar 4: Built-in Observability (관측성)

엔터프라이즈 시스템의 필수 요소.

**목표:**
- OpenTelemetry OTLP 기본 지원
- 분산 추적 (Distributed Tracing)
- 메트릭, 로그, 트레이스 통합

**핵심 과제:**
1. **Telemetry API** - `@croco/telemetry-api` (@Trace 데코레이터)
2. **SDK 완성** - `@croco/telemetry-sdk-node` (Lambda 최적화)
3. **Exporters** - OTLP, X-Ray, Jaeger, Grafana Tempo
4. **Dashboard Template** - Grafana 대시보드 템플릿

### Pillar 5: Community & Trust (커뮤니티와 신뢰)

엔터프라이즈 채택을 위한 신뢰 구축.

**목표:**
- GitHub Stars 10,000+ (2027년)
- npm 주간 다운로드 100,000+
- 기업 사용 사례 50개+

**핵심 과제:**
1. **공식 문서** - 튜토리얼, 가이드, API 레퍼런스
2. **실제 사례** - 대규모 트래픽 서비스 벤치마크 공개
3. **컨퍼런스 발표** - NodeConf, React Summit 등
4. **기술 블로그** - 아키텍처, 성능 최적화 팁

## Timeline & Milestones

### Phase 1: Foundation (2026 Q2-Q3)
**목표: 핵심 완성도 확보**

| 마일스톤 | 내용 | 완료 기준 |
|-----------|------|-----------|
| M1.1 | DB 어댑터 테스트 보강 | *-drizzle 패키지 테스트 커버리지 70% |
| M1.2 | Zero-Scan DI PoC | 프로토타입 동작, 성능 벤치마크 |
| M1.3 | 레거시 마이그레이션 가이드 | utils-node → transports-http 전환 문서 |
| M1.4 | 공식 문서 사이트 런칭 | docs.croco.dev (Docusaurus/Mintlify) |

**🎯 마케팅/커뮤니티:**
- **Dogfooding**: darun, slackbase에 최신 패키지 적용
- **벤치마크 공개**: NestJS vs Croco 콜드스타트 비교
- **블로그**: "Why we built Croco instead of using NestJS"

### Phase 2: Ecosystem (2026 Q4 - 2027 Q1)
**목표: 생태계 확장**

| 마일스톤 | 내용 | 완료 기준 |
|-----------|------|-----------|
| M2.1 | Message Queue 통합 | SQS, QStash, Redis Streams 어댑터 |
| M2.2 | Cache Layer 완성 | Redis, Upstash 공식 지원 |
| M2.3 | CLI 도구 베타 | create-croco-app, 코드 제너레이터 |
| M2.4 | VS Code Extension | 데코레이터 자동완성, 타입 힌트 |

**🎯 마케팅/커뮤니티:**
- **GitHub 공개**: 1.0.0 릴리즈, Product Hunt 게시
- **튜토리얼 시리즈**: "Building a SaaS with Croco"
- **Discord 서버**: 커뮤니티 채널 개설

### Phase 3: Adoption (2027 Q2-Q3)
**목표: 커뮤니티 확보**

| 마일스톤 | 내용 | 완료 기준 |
|-----------|------|-----------|
| M3.1 | GitHub Stars 5,000+ | 커뮤니티 성장 |
| M3.2 | npm 주간 다운로드 50,000+ | 실제 사용 증가 |
| M3.3 | 기업 사용 사례 20개+ | 엔터프라이즈 채택 |
| M3.4 | 컨퍼런스 발표 3회+ | NodeConf, React Summit 등 |

**🎯 마케팅/커뮤니티:**
- **Early Adopter Case Studies**: 5개 이상 기업 인터뷰
- **컨퍼런스 발표**: NodeConf Korea, FEConf
- **YouTube**: 아키텍처 심화 강좌

### Phase 4: Maturity (2027 Q4+)
**목표: 엔터프라이즈 표준**

| 마일스톤 | 내용 | 완료 기준 |
|-----------|------|-----------|
| M4.1 | GitHub Stars 10,000+ | NestJS 대비 1/7 달성 |
| M4.2 | 공식 패키지 100개+ | Spring 수준 생태계 |
| M4.3 | Zero-Scan DI 정식 릴리즈 | 콜드스타트 50ms 미만 |
| M4.4 | 기업 사용 사례 50개+ | "우리 회사는 Croco 써요" |

**🎯 마케팅/커뮤니티:**
- **Enterprise Summit**: CTO/Architect 대상 세미나
- **Certification Program**: Croco Certified Developer
- **Books**: "Production-Ready Croco" 출판

## Competitive Landscape

### NestJS vs Croco

| 측면 | NestJS | Croco |
|------|--------|-------|
| **콜드스타트** | 500-2000ms | 목표: <50ms |
| **DI 방식** | 런타임 리플렉션 스캔 | Zero-Scan (컴파일타임) |
| **개념 수** | Module, Controller, Service, Guard, Interceptor, Pipe... | Framework, Protocol, Transport, Integration |
| **보일러플레이트** | 높음 (4-5개 파일/기능) | 낮음 (컨벤션 기반) |
| **생태계** | 44개 공식 패키지 | 70개 패키지 (지속 확장) |
| **GitHub Stars** | 75,000+ | 목표: 10,000+ (2027) |

### 타 프레임워크 포지셔닝

```
       구조화 ↑
              │
   Spring ────┼──── NestJS
              │         │
   Croco ─────┼──── MidwayJS
              │
         tRPC ─────── Hono
              │
              └──────────────────→ 성능
```

- **Spring/NestJS**: 높은 구조화, 낮은 성능
- **Hono/tRPC**: 낮은 구조화, 높은 성능
- **Croco**: 높은 구조화 + 높은 성능 (Best of both worlds)

---

## Risk Mitigation

### 기술적 리스크

| 리스크 | 영향도 | 대응 전략 |
|--------|--------|-----------|
| Zero-Scan DI 구현 복잡도 | High | PoC 먼저 진행, 실패 시 기존 DI 유지 |
| Multi-runtime 호환성 | Medium | Node.js 우선, Edge는 순차 지원 |
| 성능 목표 미달성 | High | 정기적 벤치마크, 점진적 개선 |

### 시장 리스크

| 리스크 | 영향도 | 대응 전략 |
|--------|--------|-----------|
| NestJS 생태계 격차 | High | 차별화 포인트 강조 (성능, DX) |
| 커뮤니티 성장 지연 | Medium | 초기부터 오픈소스, 기여 유도 |
| 엔터프라이즈 신뢰 부족 | High | 실제 사례 공개, 벤치마크 투명화 |
| Vendor Lock-in 인식 | Medium | Multi-runtime 지원 강조 (Node/Bun/Deno/Edge) |
| 높은 학습 곡선 (DDD, UoW) | Medium | 점진적 도입 가이드, 튜토리얼 제공 |

### 리스크 대응 전략 상세

**1. Vendor Lock-in 리스크**
- `transports-http`가 Hono 기반 → Node.js, Bun, Cloudflare Workers 어디서든 실행 가능
- AWS Lambda 최적화지만 플랫폼 종속 아님

**2. 엔터프라이즈 신뢰 구축**
- Phase 1에서 Dogfooding으로 실제 트래픽 검증
- darun, slackbase 등 프로덕션 사용 사례 투명 공개
- 정기적 성능 벤치마크 발표

**3. 학습 곡선 완화**
- "빠르게 시작하고(Hono-like), 필요할 때 확장하라(Spring-like)" 철학
- 가벼운 Controller 패턴 → 점진적으로 Aggregate Root, UoW 도입
- 단계별 튜토리얼 제공

---

## Success Metrics

### 정량 지표

| 지표 | 2026 Q4 | 2027 Q2 | 2027 Q4 |
|------|---------|---------|---------|
| GitHub Stars | 1,000+ | 5,000+ | 10,000+ |
| npm 주간 다운로드 | 10,000+ | 50,000+ | 100,000+ |
| 공식 패키지 수 | 80+ | 90+ | 100+ |
| 테스트 커버리지 | 70% | 80% | 85% |
| 기업 사용 사례 | 5+ | 20+ | 50+ |

### 정성 지표

- "Node.js 백엔드 뭘 써요?" → "Croco요" (2027)
- 엔터프라이즈 채용 JD에 Croco 경험 우대 등장
- 컨퍼런스에서 Croco 발표 채택

---

## Call to Action

### 지금 시작하기

```bash
# 새 프로젝트 생성 (향후 지원)
npx create-croco-app my-api

cd my-api
pnpm dev
```

### 기여하기

- **GitHub**: https://github.com/croco-dev/framework
- **Discord**: https://discord.gg/croco (향후 개설)
- **문서**: https://docs.croco.dev (향후 런칭)

---

## Appendix

### A. 패키지 카테고리

| 카테고리 | 패키지 예시 |
|----------|-------------|
| **Core** | framework-context, problems-core, telemetry-api |
| **Domain** | events-core, tx-core, gid-core |
| **Auth** | auth-core, access-core, membership-core |
| **Protocol** | protocols-rest, protocols-graphql |
| **Transport** | transports-http |
| **Storage** | storage-core, storage-r2, storage-cloudflare |
| **DB** | *-drizzle 계열 |
| **Queue** | tasks-core, tasks-qstash, batch-core |
| **Cache** | cache-core, ratelimit-core |
| **Search** | search-core, search-meilisearch |
| **Notification** | notifications-core, notifications-resend |
| **Analytics** | analytics-core, analytics-posthog |
| **Billing** | billing-core, billing-polar |
| **Integration** | integrations-posthog |

### B. 참고 자료

- [NestJS Architecture](https://docs.nestjs.com/)
- [Spring Framework](https://spring.io/)
- [Hono - Ultrafast Web Framework](https://hono.dev/)
- [tRPC - End-to-End Typesafe APIs](https://trpc.io/)

---

*Last updated: 2026-02-28*