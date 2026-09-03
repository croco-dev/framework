import { createHash } from "node:crypto";

import { Problem, ProblemCategory } from "@croco/problems-core";

import type { EngagementSendCommand } from "./EngagementService";
import type { AnyMessage, MessageDataInput } from "./MessageContracts";

export type AudienceScope = "tenant" | "global";

export type AudienceContext = Readonly<{
  tenantId?: string;
}>;

export interface AudienceSource<TMember> {
  members(context: AudienceContext): AsyncIterable<TMember>;
  estimate?(context: AudienceContext): number | Promise<number>;
}

export type AudienceConstructor<TMember = unknown> = abstract new (
  ...arguments_: never[]
) => AudienceSource<TMember>;

export type AudienceDescriptor = Readonly<{
  id: string;
  scope: AudienceScope;
}>;

export type AudienceBinding<TMember = unknown> = Readonly<{
  audience: AudienceConstructor<TMember>;
  descriptor: AudienceDescriptor;
  instance: AudienceSource<TMember>;
}>;

export type AudienceOptions = Readonly<{
  scope: AudienceScope;
}>;

const AUDIENCE_METADATA = new WeakMap<Function, AudienceDescriptor>();

export function Audience(
  id: string,
  options: AudienceOptions = { scope: "tenant" },
): ClassDecorator {
  assertIdentifier("Audience", id);
  assertAudienceScope(options.scope);
  const descriptor = Object.freeze({ id, scope: options.scope });
  return (target: Function) => {
    AUDIENCE_METADATA.set(target, descriptor);
  };
}

export function getAudienceDescriptor(audience: Function): AudienceDescriptor | undefined {
  return AUDIENCE_METADATA.get(audience);
}

export class AudienceRegistry {
  private readonly bindingsById = new Map<string, AudienceBinding>();
  private readonly bindingsByConstructor = new Map<Function, AudienceBinding>();

  register<TMember>(
    audience: AudienceConstructor<TMember>,
    instance: AudienceSource<TMember>,
  ): void {
    const descriptor = getAudienceDescriptor(audience);
    if (descriptor === undefined) {
      throw new AudienceMetadataMissingProblem(constructorNameOf(audience));
    }
    const duplicate = this.bindingsById.get(descriptor.id);
    if (duplicate !== undefined) {
      throw new AudienceAlreadyRegisteredProblem(
        descriptor.id,
        constructorNameOf(duplicate.audience),
        constructorNameOf(audience),
      );
    }
    if (this.bindingsByConstructor.has(audience)) {
      throw new AudienceAlreadyRegisteredProblem(
        descriptor.id,
        constructorNameOf(audience),
        constructorNameOf(audience),
      );
    }

    const binding = Object.freeze({ audience, descriptor, instance });
    this.bindingsById.set(descriptor.id, binding);
    this.bindingsByConstructor.set(audience, binding);
  }

  resolve<TMember>(audience: AudienceConstructor<TMember>): AudienceSource<TMember> {
    const binding = this.bindingsByConstructor.get(audience);
    if (binding === undefined) {
      const descriptor = getAudienceDescriptor(audience);
      throw new AudienceNotRegisteredProblem(descriptor?.id, constructorNameOf(audience));
    }
    return binding.instance as AudienceSource<TMember>;
  }

  list(): readonly AudienceDescriptor[] {
    return Object.freeze(
      [...this.bindingsById.values()]
        .map((binding) => binding.descriptor)
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
  }

  async preview<TMember>(
    audience: AudienceConstructor<TMember>,
    context: AudienceContext,
    limit: number,
  ): Promise<readonly TMember[]> {
    assertPreviewLimit(limit);
    const descriptor = requireAudienceDescriptor(audience);
    assertAudienceContext(descriptor, context);
    const iterator = this.resolve(audience).members(context)[Symbol.asyncIterator]();
    const members: TMember[] = [];
    let completed = false;

    try {
      while (members.length < limit) {
        const next = await iterator.next();
        if (next.done) {
          completed = true;
          break;
        }
        members.push(next.value);
      }
    } finally {
      if (!completed) {
        await iterator.return?.();
      }
    }

    return Object.freeze(members);
  }
}

type AudienceMember<TAudience extends AudienceConstructor> =
  InstanceType<TAudience> extends AudienceSource<infer TMember> ? TMember : never;

type ExactCampaignCommand<
  TMessage extends AnyMessage,
  TCommand extends EngagementSendCommand<TMessage>,
> = TCommand &
  Record<Exclude<keyof TCommand, keyof EngagementSendCommand<TMessage>>, never> &
  Readonly<{
    data: TCommand["data"] &
      Record<Exclude<keyof TCommand["data"], keyof MessageDataInput<TMessage>>, never>;
  }>;

type NonEmptyStringLiteral<TValue extends string> = string extends TValue
  ? never
  : TValue extends ""
    ? never
    : TValue;

export type CampaignDefinitionInput<
  TId extends string,
  TVersion extends string,
  TAudience extends AudienceConstructor,
  TMessage extends AnyMessage,
> = Readonly<{
  id: TId;
  version: NonEmptyStringLiteral<TVersion>;
  audience: TAudience;
  message: TMessage;
  map: (member: AudienceMember<TAudience>) => EngagementSendCommand<TMessage>;
}>;

export type CampaignDescriptor<TVersion extends string = string> = Readonly<{
  id: string;
  audienceId: string;
  audienceScope: AudienceScope;
  messageId: string;
  version: TVersion;
  hash: `sha256:${string}`;
}>;

export type DefinedCampaign<
  TId extends string = string,
  TVersion extends string = string,
  TAudience extends AudienceConstructor = AudienceConstructor,
  TMessage extends AnyMessage = AnyMessage,
> = Readonly<{
  id: TId;
  version: TVersion;
  audience: TAudience;
  message: TMessage;
  map: (member: AudienceMember<TAudience>) => EngagementSendCommand<TMessage>;
  descriptor: CampaignDescriptor<TVersion>;
}>;

export type AnyCampaign = Readonly<{
  id: string;
  version: string;
  audience: abstract new (...arguments_: never[]) => object;
  message: AnyMessage;
  map: (member: never) => unknown;
  descriptor: CampaignDescriptor;
}>;

export function defineCampaign<
  const TId extends string,
  const TVersion extends string,
  TAudience extends AudienceConstructor,
  TMessage extends AnyMessage,
  TCommand extends EngagementSendCommand<TMessage>,
>(
  input: Omit<CampaignDefinitionInput<TId, TVersion, TAudience, TMessage>, "map"> &
    Readonly<{
      map: (member: AudienceMember<TAudience>) => ExactCampaignCommand<TMessage, TCommand>;
    }>,
): DefinedCampaign<TId, TVersion, TAudience, TMessage> {
  assertIdentifier("Campaign", input.id);
  assertCampaignVersion(input.version);
  const audience = requireAudienceDescriptor(input.audience);
  const descriptorIdentity = canonicalJson({
    audienceId: audience.id,
    audienceScope: audience.scope,
    campaignId: input.id,
    message: input.message.descriptor,
    version: input.version,
  });
  const descriptor = Object.freeze({
    id: input.id,
    audienceId: audience.id,
    audienceScope: audience.scope,
    messageId: input.message.id,
    version: input.version,
    hash: `sha256:${createHash("sha256").update(descriptorIdentity).digest("hex")}` as const,
  });

  return Object.freeze({
    id: input.id,
    version: input.version,
    audience: input.audience,
    message: input.message,
    map: input.map,
    descriptor,
  });
}

export class CampaignRegistry {
  private readonly campaigns = new Map<string, AnyCampaign>();

  register<TCampaign extends AnyCampaign>(campaign: TCampaign): void {
    if (this.campaigns.has(campaign.id)) {
      throw new CampaignAlreadyRegisteredProblem(campaign.id);
    }
    this.campaigns.set(campaign.id, campaign);
  }

  resolve<TCampaign extends AnyCampaign>(campaignId: TCampaign["id"]): TCampaign {
    const campaign = this.campaigns.get(campaignId);
    if (campaign === undefined) {
      throw new CampaignNotRegisteredProblem(campaignId);
    }
    return campaign as TCampaign;
  }

  list(): readonly CampaignDescriptor[] {
    return Object.freeze(
      [...this.campaigns.values()]
        .map((campaign) => campaign.descriptor)
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
  }
}

export class AudienceDefinitionInvalidProblem extends Problem {
  constructor(detail: string) {
    super("engagement-core/audience-definition-invalid", ProblemCategory.ValidationError, detail, {
      extensions: { retryable: false },
    });
  }
}

export class AudienceMetadataMissingProblem extends Problem {
  constructor(audienceName: string) {
    super(
      "engagement-core/audience-metadata-missing",
      ProblemCategory.ValidationError,
      `Audience ${audienceName} is not decorated with @Audience()`,
      { extensions: { audienceName, retryable: false } },
    );
  }
}

export class AudienceAlreadyRegisteredProblem extends Problem {
  constructor(audienceId: string, existingAudienceName: string, audienceName: string) {
    super(
      "engagement-core/audience-already-registered",
      ProblemCategory.Conflict,
      `Audience ${audienceId} is already registered by ${existingAudienceName}; cannot register ${audienceName}`,
      { extensions: { audienceId, existingAudienceName, audienceName, retryable: false } },
    );
  }
}

export class AudienceNotRegisteredProblem extends Problem {
  constructor(audienceId: string | undefined, audienceName: string) {
    super(
      "engagement-core/audience-not-registered",
      ProblemCategory.NotFound,
      audienceId === undefined
        ? `Audience ${audienceName} is not registered`
        : `Audience ${audienceId} (${audienceName}) is not registered`,
      {
        extensions: {
          ...(audienceId === undefined ? {} : { audienceId }),
          audienceName,
          retryable: false,
        },
      },
    );
  }
}

export class AudienceScopeInvalidProblem extends Problem {
  constructor(audienceId: string, detail: string) {
    super("engagement-core/audience-scope-invalid", ProblemCategory.ValidationError, detail, {
      extensions: { audienceId, retryable: false },
    });
  }
}

export class AudiencePreviewInvalidProblem extends Problem {
  constructor(limit: number) {
    super(
      "engagement-core/audience-preview-invalid",
      ProblemCategory.ValidationError,
      "Audience preview limit must be a positive integer",
      { extensions: { limit: String(limit), retryable: false } },
    );
  }
}

export class CampaignDefinitionInvalidProblem extends Problem {
  constructor(detail: string) {
    super("engagement-core/campaign-definition-invalid", ProblemCategory.ValidationError, detail, {
      extensions: { retryable: false },
    });
  }
}

export class CampaignAlreadyRegisteredProblem extends Problem {
  constructor(campaignId: string) {
    super(
      "engagement-core/campaign-already-registered",
      ProblemCategory.Conflict,
      `Campaign ${campaignId} is already registered`,
      { extensions: { campaignId, retryable: false } },
    );
  }
}

export class CampaignNotRegisteredProblem extends Problem {
  constructor(campaignId: string) {
    super(
      "engagement-core/campaign-not-registered",
      ProblemCategory.NotFound,
      `Campaign ${campaignId} is not registered`,
      { extensions: { campaignId, retryable: false } },
    );
  }
}

function requireAudienceDescriptor(audience: Function): AudienceDescriptor {
  const descriptor = getAudienceDescriptor(audience);
  if (descriptor === undefined) {
    throw new AudienceMetadataMissingProblem(constructorNameOf(audience));
  }
  return descriptor;
}

function assertIdentifier(kind: "Audience" | "Campaign", id: string): void {
  if (id.trim().length === 0) {
    if (kind === "Audience") {
      throw new AudienceDefinitionInvalidProblem("Audience id must not be empty");
    }
    throw new CampaignDefinitionInvalidProblem("Campaign id must not be empty");
  }
}

function assertAudienceScope(scope: AudienceScope): void {
  if (scope !== "tenant" && scope !== "global") {
    throw new AudienceDefinitionInvalidProblem(`Unsupported audience scope ${String(scope)}`);
  }
}

function assertCampaignVersion(version: string): void {
  if (version.trim().length === 0) {
    throw new CampaignDefinitionInvalidProblem("Campaign version must not be empty");
  }
}

function assertAudienceContext(descriptor: AudienceDescriptor, context: AudienceContext): void {
  if (
    descriptor.scope === "tenant" &&
    (context.tenantId === undefined || context.tenantId.trim().length === 0)
  ) {
    throw new AudienceScopeInvalidProblem(
      descriptor.id,
      `Tenant-scoped audience ${descriptor.id} requires a tenantId`,
    );
  }
}

function assertPreviewLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new AudiencePreviewInvalidProblem(limit);
  }
}

function constructorNameOf(constructor: Function): string {
  return constructor.name.length > 0 ? constructor.name : "<anonymous>";
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
