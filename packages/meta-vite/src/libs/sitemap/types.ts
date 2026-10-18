export type SitemapEntry = {
  readonly resourceId: string;
  readonly tenantId: string;
  readonly url: string;
  readonly canonical: string | null;
  readonly publication: "public" | "private" | "draft" | "deleted" | "redirect" | "unknown";
  readonly indexable: boolean | null;
  /** Significant source-content modification only; never a build timestamp. */
  readonly contentModifiedAt?: string;
  readonly locale?: string;
  readonly localeGroup?: string;
};

/** The repository must retain this immutable snapshot throughout cursor iteration. */
export interface SitemapSource {
  open(): Promise<{ revision: string; tenantId: string }>;
  read(input: { revision: string; cursor: string | null; limit: number }): Promise<{
    revision: string;
    entries: readonly SitemapEntry[];
    nextCursor: string | null;
    /** True only on a successfully exhausted snapshot, including a genuine empty source. */
    complete: boolean;
  }>;
}

export type SitemapPolicy = {
  readonly tenantId: string;
  readonly origin: string;
  /** Trusted application mapping, including approved public paths and tenant ownership. */
  readonly approveUrl: (url: URL) => boolean;
  /** Meaningful query values are explicit; unknown keys/values are rejected, never stripped. */
  readonly queryValues?: Readonly<Record<string, readonly string[]>>;
  readonly pageSize?: number;
  readonly maxPages?: number;
  readonly maxEntries?: number;
  readonly maxUrlsPerFile?: number;
  readonly maxBytesPerFile?: number;
};

export type SitemapExclusionReason =
  | "publication"
  | "indexability"
  | "tenant"
  | "url"
  | "canonical"
  | "duplicate"
  | "canonical-conflict"
  | "locale";

export type SitemapReport = {
  readonly revision: string;
  readonly sourceComplete: boolean;
  readonly scanned: number;
  readonly included: number;
  readonly excluded: Readonly<Record<SitemapExclusionReason, number>>;
  readonly lastmodUnknown: number;
  readonly files: readonly { name: string; bytes: number; urls: number }[];
};

export type SitemapGeneration = {
  readonly id: string;
  readonly tenantId: string;
  readonly origin: string;
  readonly revision: string;
  readonly files: readonly { name: string; xml: string }[];
  readonly index: string;
  readonly report: SitemapReport;
};

export type SitemapPublication = {
  readonly generationId: string;
  readonly revision: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly report: SitemapReport;
  readonly index: string;
};

export interface SitemapPublisher {
  current(): Promise<SitemapPublication | null>;
  publish(
    generation: SitemapGeneration,
    command: {
      actorId: string;
      idempotencyKey: string;
      expectedGenerationId: string | null;
    },
  ): Promise<SitemapPublication>;
  /** Read only complete, immutable generation objects. */
  read(generationId: string, name: string): Promise<string | null>;
}
