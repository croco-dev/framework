---
editUrl: false
next: false
prev: false
title: "FeatureManager"
---

Feature flag manager abstract class.

## Description

Provides an interface for feature flag management with support for:

- Boolean feature flags (enabled/disabled)
- Multivariate feature flags (A/B testing, staged rollouts)
- Context-aware flag evaluation (userId, tenantId, etc.)

Concrete implementations should integrate with feature flag services like LaunchDarkly,
Flagsmith, or custom configuration sources.

## Examples

```typescript
import { Container } from "@croco/framework-context";
import { FeatureManager } from "@croco/features-core";

// Register your implementation
class CustomFeatureManager extends FeatureManager {
  async isEnabled(key: string, context?: Record<string, unknown>): Promise<boolean> {
    // Check database, API, or configuration
    return config.features[key]?.enabled ?? false;
  }

  async getVariant(
    key: string,
    context?: Record<string, unknown>,
  ): Promise<string | boolean | number | object> {
    return config.features[key]?.variant ?? "default";
  }
}

Container.register(CustomFeatureManager, { scope: "singleton" });

// Use in services
@Service()
class UserService {
  constructor(private readonly features: FeatureManager) {}

  async createProfile(dto: CreateProfileDto) {
    if (await this.features.isEnabled("new-profile-flow", { userId: dto.userId })) {
      return this.createNewProfile(dto);
    }
    return this.createLegacyProfile(dto);
  }
}
```

```typescript
// Multivariate flag usage
@Service()
class RecommendationService {
  constructor(private readonly features: FeatureManager) {}

  async getRecommendations(userId: string) {
    const algorithm = await this.features.getVariant("recommendation-alg", { userId });

    switch (algorithm) {
      case "collaborative-filtering":
        return this.collaborativeFiltering(userId);
      case "content-based":
        return this.contentBased(userId);
      default:
        return this.defaultAlgorithm(userId);
    }
  }
}
```

## Extended by

- [`PostHogFeatureManager`](/api/features-posthog/src/classes/posthogfeaturemanager/)

## Constructors

### Constructor

> **new FeatureManager**(): `FeatureManager`

#### Returns

`FeatureManager`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`FeatureManager`\>

## Methods

### getVariant()

> `abstract` **getVariant**(`key`, `context?`): `Promise`\<`string` \| `number` \| `boolean` \| `object`\>

Get the value of a feature flag.
Useful for multivariate flags or JSON configuration.

#### Parameters

##### key

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`string` \| `number` \| `boolean` \| `object`\>

---

### isEnabled()

> `abstract` **isEnabled**(`key`, `context?`): `Promise`\<`boolean`\>

Check if a feature flag is enabled.
Context (userId, tenantId) will be automatically injected by the implementation if available,
but can be overridden by the `context` parameter.

#### Parameters

##### key

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`boolean`\>
