import { createHash, randomUUID } from "node:crypto";
import { parseDescriptor, WarehouseContractError } from "@croco/warehouse-core";
import type { FactDescriptor } from "@croco/warehouse-core";
import type {
  CatalogStore,
  WarehouseAccess,
  WarehouseAudit,
  WarehouseCandidate,
  WarehouseCreateCandidateRequest,
  WarehouseDataset,
  WarehouseExpireRequest,
  WarehouseFailRequest,
  WarehousePermissionEpochRequest,
  WarehouseRemovePublicationRequest,
  WarehousePublishRequest,
  WarehouseSealRequest,
  WarehouseSnapshot,
  WarehouseSnapshotRequest,
  WarehouseSuppressRequest,
} from "@croco/warehouse-core/runtime";
import { factColumnName, factTableName, quoteIdentifier, scopeKey } from "./schema";
import type { WarehousePostgresConnection, WarehousePostgresPool } from "./client";

type Head = {
  snapshot_id: string | null;
  revision: string | number;
  permission_epoch: string | number;
  privacy_epoch: string | number;
};

export class PostgresWarehouseCatalog implements CatalogStore {
  constructor(
    private readonly pool: WarehousePostgresPool,
    private readonly descriptor: FactDescriptor,
    private readonly resolveAccess: () => WarehouseAccess,
    private readonly publicationParticipant?: (
      connection: WarehousePostgresConnection,
      snapshot: WarehouseSnapshot,
    ) => Promise<void>,
  ) {}

  private access(role: WarehouseAccess["roles"][number]): WarehouseAccess {
    const access = this.resolveAccess();
    if (
      !access.actor ||
      !access.roles.includes(role) ||
      !access.scope.application ||
      !access.scope.environment ||
      (this.descriptor.scope === "tenant" && !access.scope.tenant)
    )
      throw new WarehouseContractError("WAREHOUSE_ACCESS_DENIED");
    if (
      ![access.permissionEpoch, access.privacyEpoch].every(
        (value) => Number.isSafeInteger(value) && value >= 0,
      )
    )
      throw new WarehouseContractError("WAREHOUSE_INVALID_EPOCH");
    return access;
  }

  private async transaction<T>(run: (db: WarehousePostgresConnection) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    let committing = false;
    let indeterminate = false;
    try {
      await db.query("BEGIN");
      const result = await run(db);
      committing = true;
      await db.query("COMMIT");
      return result;
    } catch (error) {
      if (committing) {
        indeterminate = true;
        throw new WarehouseContractError("WAREHOUSE_COMMIT_INDETERMINATE");
      }
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release(indeterminate || undefined);
    }
  }

  private async head(
    db: WarehousePostgresConnection,
    access: WarehouseAccess,
    checkEpoch = true,
  ): Promise<Head> {
    await parseDescriptor(JSON.stringify(this.descriptor));
    await db.query(
      "INSERT INTO warehouse_heads(scope_key,model_version,permission_epoch,privacy_epoch) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [
        scopeKey(access.scope),
        this.descriptor.semanticHash,
        access.permissionEpoch,
        access.privacyEpoch,
      ],
    );
    const result = await db.query<Head>(
      "SELECT * FROM warehouse_heads WHERE scope_key=$1 AND model_version=$2 FOR UPDATE",
      [scopeKey(access.scope), this.descriptor.semanticHash],
    );
    const head = result.rows[0];
    if (
      !head ||
      (checkEpoch &&
        (Number(head.permission_epoch) !== access.permissionEpoch ||
          Number(head.privacy_epoch) !== access.privacyEpoch))
    )
      throw new WarehouseContractError("WAREHOUSE_EPOCH_CHANGED");
    return head;
  }

  private async mutation<T>(
    access: WarehouseAccess,
    action: string,
    audit: WarehouseAudit,
    input: unknown,
    run: (db: WarehousePostgresConnection, head: Head) => Promise<T>,
  ): Promise<T> {
    if (
      !audit.reason.trim() ||
      !audit.idempotencyKey.trim() ||
      !Number.isSafeInteger(audit.expectedRevision) ||
      audit.expectedRevision < 0
    )
      throw new WarehouseContractError("WAREHOUSE_AUDIT_REQUIRED");
    const fingerprint = createHash("sha256")
      .update(JSON.stringify([access.actor, audit, input]))
      .digest("hex");
    return this.transaction(async (db) => {
      const head = await this.head(db, access, false);
      const params = [
        scopeKey(access.scope),
        this.descriptor.semanticHash,
        action,
        audit.idempotencyKey,
      ];
      const prior = await db.query<{ outcome: { fingerprint: string; result: T } }>(
        "SELECT outcome FROM warehouse_mutations WHERE scope_key=$1 AND model_version=$2 AND action=$3 AND idempotency_key=$4",
        params,
      );
      if (prior.rows[0]) {
        if (prior.rows[0].outcome.fingerprint !== fingerprint)
          throw new WarehouseContractError("WAREHOUSE_IDEMPOTENCY_CONFLICT");
        return prior.rows[0].outcome.result;
      }
      if (
        Number(head.permission_epoch) !== access.permissionEpoch ||
        Number(head.privacy_epoch) !== access.privacyEpoch
      )
        throw new WarehouseContractError("WAREHOUSE_EPOCH_CHANGED");
      if (Number(head.revision) !== audit.expectedRevision)
        throw new WarehouseContractError("WAREHOUSE_REVISION_CONFLICT");
      const result = await run(db, head);
      await db.query(
        "INSERT INTO warehouse_mutations(scope_key,model_version,action,idempotency_key,actor,reason,expected_revision,outcome) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [...params, access.actor, audit.reason, audit.expectedRevision, { fingerprint, result }],
      );
      return result;
    });
  }

  private async candidate(
    db: WarehousePostgresConnection,
    access: WarehouseAccess,
    id: string,
    fence?: number,
  ): Promise<WarehouseCandidate> {
    const rows = await db.query<{ data: WarehouseCandidate }>(
      "SELECT data FROM warehouse_candidates WHERE id=$1 AND scope_key=$2 AND model_version=$3 FOR UPDATE",
      [id, scopeKey(access.scope), this.descriptor.semanticHash],
    );
    const candidate = rows.rows[0]?.data;
    if (!candidate || (fence !== undefined && candidate.fence !== fence))
      throw new WarehouseContractError("WAREHOUSE_CANDIDATE_FENCE");
    if (
      candidate.permissionEpoch !== access.permissionEpoch ||
      candidate.privacyEpoch !== access.privacyEpoch
    )
      throw new WarehouseContractError("WAREHOUSE_EPOCH_CHANGED");
    return candidate;
  }

  async createCandidate(request: WarehouseCreateCandidateRequest): Promise<WarehouseCandidate> {
    const access = this.access("import");
    const { access: _access, audit, ...input } = request;
    return this.mutation(access, "create", audit, input, async (db, head) => {
      if (
        !request.id ||
        !request.transformHash ||
        !request.sourceRefs.length ||
        new Set(request.sourceRefs).size !== request.sourceRefs.length ||
        request.sourceRefs.some((ref) => !ref)
      )
        throw new WarehouseContractError("WAREHOUSE_CANDIDATE_INVALID");
      if (request.expectedHead !== head.snapshot_id)
        throw new WarehouseContractError("WAREHOUSE_HEAD_CONFLICT");
      const range = request.partitionSelection;
      if (this.descriptor.kind === "aggregate") {
        if (
          !range ||
          !/^\d{4}-\d{2}-\d{2}$/.test(range.from) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(range.through) ||
          range.from > range.through ||
          JSON.stringify(Object.keys(range.series).sort()) !==
            JSON.stringify([...this.descriptor.aggregate.series].sort())
        )
          throw new WarehouseContractError("WAREHOUSE_PARTITION_INVALID");
      } else if (range) throw new WarehouseContractError("WAREHOUSE_PARTITION_INVALID");
      const candidate: WarehouseCandidate = {
        id: request.id,
        scope: access.scope,
        modelVersion: this.descriptor.semanticHash,
        transformHash: request.transformHash,
        sourceRefs: request.sourceRefs,
        expectedHead: request.expectedHead,
        fence: Number(head.revision) + 1,
        state: "open",
        quality: null,
        partitionSelection: range,
        permissionEpoch: access.permissionEpoch,
        privacyEpoch: access.privacyEpoch,
      };
      await db.query(
        "INSERT INTO warehouse_candidates(id,scope_key,model_version,fence,state,data) VALUES($1,$2,$3,$4,$5,$6)",
        [
          candidate.id,
          scopeKey(access.scope),
          candidate.modelVersion,
          candidate.fence,
          candidate.state,
          candidate,
        ],
      );
      return candidate;
    });
  }

  async getCandidate(request: {
    access: WarehouseAccess;
    candidateId: string;
  }): Promise<WarehouseCandidate> {
    const access = this.access("read");
    return this.transaction(async (db) => {
      await this.head(db, access);
      return this.candidate(db, access, request.candidateId);
    });
  }

  async sealCandidate(request: WarehouseSealRequest): Promise<WarehouseCandidate> {
    const access = this.access("import");
    const { access: _access, audit, ...input } = request;
    return this.mutation(access, "seal", audit, input, async (db) => {
      const candidate = await this.candidate(db, access, request.candidateId, request.fence);
      if (candidate.state !== "open")
        throw new WarehouseContractError("WAREHOUSE_CANDIDATE_CLOSED");
      const quality = request.quality;
      if (
        quality.validity !== "valid" ||
        quality.temporalCompleteness !== "complete" ||
        quality.populationCoverage !== "complete" ||
        quality.reproducibility !== "reproducible" ||
        quality.sourceCoverage.length !== candidate.sourceRefs.length ||
        new Set(quality.sourceCoverage.map((item) => item.sourceRef)).size !==
          candidate.sourceRefs.length ||
        !Number.isFinite(Date.parse(quality.freshness.observedAt)) ||
        (quality.freshness.newestEventAt !== null &&
          !Number.isFinite(Date.parse(quality.freshness.newestEventAt)))
      )
        throw new WarehouseContractError("WAREHOUSE_QUALITY_REJECTED");
      for (const ref of candidate.sourceRefs) {
        const coverage = quality.sourceCoverage.find((item) => item.sourceRef === ref);
        if (
          !coverage ||
          !["complete", "empty"].includes(coverage.state) ||
          coverage.gaps.length ||
          coverage.late ||
          !Number.isFinite(Date.parse(coverage.from)) ||
          !Number.isFinite(Date.parse(coverage.through)) ||
          coverage.from > coverage.through ||
          (candidate.partitionSelection &&
            (coverage.from > candidate.partitionSelection.from ||
              coverage.through < candidate.partitionSelection.through))
        )
          throw new WarehouseContractError("WAREHOUSE_COVERAGE_INCOMPLETE");
      }
      const receipts = await db.query<{ batch_id: string; receipt: { state: string } }>(
        "SELECT batch_id,receipt FROM warehouse_receipts WHERE candidate_id=$1",
        [candidate.id],
      );
      if (
        new Set(request.expectedBatchIds).size !== request.expectedBatchIds.length ||
        receipts.rows.length !== request.expectedBatchIds.length ||
        receipts.rows.some(
          (row) =>
            row.receipt.state !== "durable" || !request.expectedBatchIds.includes(row.batch_id),
        )
      )
        throw new WarehouseContractError("WAREHOUSE_RECEIPTS_INCOMPLETE");
      const sealed: WarehouseCandidate = { ...candidate, state: "sealed", quality };
      await db.query("UPDATE warehouse_candidates SET state=$2,data=$3 WHERE id=$1", [
        candidate.id,
        sealed.state,
        sealed,
      ]);
      return sealed;
    });
  }

  async failCandidate(request: WarehouseFailRequest): Promise<WarehouseCandidate> {
    const access = this.access("import");
    const { access: _access, audit, ...input } = request;
    return this.mutation(access, "fail-candidate", audit, input, async (db) => {
      const candidate = await this.candidate(db, access, request.candidateId, request.fence);
      if (candidate.state !== "open" && candidate.state !== "sealed")
        throw new WarehouseContractError("WAREHOUSE_CANDIDATE_CLOSED");
      const failed: WarehouseCandidate = { ...candidate, state: "failed" };
      await db.query("UPDATE warehouse_candidates SET state=$2,data=$3 WHERE id=$1", [
        candidate.id,
        failed.state,
        failed,
      ]);
      return failed;
    });
  }

  async publishCandidate(request: WarehousePublishRequest): Promise<WarehouseSnapshot> {
    const access = this.access("publish");
    const { access: _access, audit, ...input } = request;
    return this.mutation(access, "publish", audit, input, async (db, head) => {
      const candidate = await this.candidate(db, access, request.candidateId, request.fence);
      if (candidate.state !== "sealed" || !candidate.quality)
        throw new WarehouseContractError("WAREHOUSE_CANDIDATE_NOT_SEALED");
      if (
        candidate.expectedHead !== head.snapshot_id ||
        candidate.fence !== Number(head.revision) + 1
      )
        throw new WarehouseContractError("WAREHOUSE_HEAD_CONFLICT");
      const revision = Number(head.revision) + 1;
      const table = quoteIdentifier(factTableName(this.descriptor));
      const scope = scopeKey(access.scope);
      if (this.descriptor.kind === "aggregate") {
        const range = candidate.partitionSelection;
        if (!range) throw new WarehouseContractError("WAREHOUSE_PARTITION_INVALID");
        const params: unknown[] = [scope, revision, range.from, range.through];
        const predicates = Object.entries(range.series).map(([key, value]) => {
          params.push(value);
          return `${quoteIdentifier(factColumnName(this.descriptor, key))}=$${params.length}`;
        });
        await db.query(
          `UPDATE ${table} SET _visible_to=$2 WHERE _scope=$1 AND _visible_from IS NOT NULL AND _visible_to IS NULL AND ${quoteIdentifier(factColumnName(this.descriptor, this.descriptor.aggregate.date))} BETWEEN $3 AND $4${predicates.length ? ` AND ${predicates.join(" AND ")}` : ""}`,
          params,
        );
      } else {
        const conflicts = await db.query(
          `SELECT staged._identity FROM ${table} AS staged JOIN ${table} AS live ON live._scope=staged._scope AND live._identity=staged._identity WHERE staged._scope=$1 AND staged._candidate=$2 AND live._visible_from IS NOT NULL AND live._visible_to IS NULL AND live._payload<>staged._payload LIMIT 1`,
          [scope, candidate.id],
        );
        if (conflicts.rows.length) throw new WarehouseContractError("WAREHOUSE_FACT_CONFLICT");
        await db.query(
          `DELETE FROM ${table} AS staged USING ${table} AS live WHERE staged._scope=$1 AND staged._candidate=$2 AND live._scope=staged._scope AND live._identity=staged._identity AND live._visible_from IS NOT NULL AND live._visible_to IS NULL`,
          [scope, candidate.id],
        );
      }
      await db.query(`UPDATE ${table} SET _visible_from=$3 WHERE _scope=$1 AND _candidate=$2`, [
        scope,
        candidate.id,
        revision,
      ]);
      const snapshot: WarehouseSnapshot = {
        id: randomUUID(),
        revision,
        modelVersion: candidate.modelVersion,
        segmentRefs: [factTableName(this.descriptor)],
        partitionSelection: candidate.partitionSelection ? [candidate.partitionSelection] : [],
        quality: candidate.quality,
        createdAt: new Date().toISOString(),
        permissionEpoch: access.permissionEpoch,
        privacyEpoch: access.privacyEpoch,
      };
      await db.query(
        "INSERT INTO warehouse_snapshots(id,scope_key,model_version,data) VALUES($1,$2,$3,$4)",
        [snapshot.id, scope, candidate.modelVersion, snapshot],
      );
      await db.query(
        "UPDATE warehouse_heads SET snapshot_id=$3,revision=$4 WHERE scope_key=$1 AND model_version=$2",
        [scope, candidate.modelVersion, snapshot.id, revision],
      );
      await db.query("UPDATE warehouse_candidates SET state=$2,data=$3 WHERE id=$1", [
        candidate.id,
        "published",
        { ...candidate, state: "published" },
      ]);
      await this.publicationParticipant?.(db, snapshot);
      return snapshot;
    });
  }

  private async snapshot(
    db: WarehousePostgresConnection,
    access: WarehouseAccess,
    id: string,
  ): Promise<WarehouseSnapshot> {
    const result = await db.query<{ data: WarehouseSnapshot }>(
      "SELECT data FROM warehouse_snapshots WHERE id=$1 AND scope_key=$2 AND model_version=$3 AND (expires_at IS NULL OR expires_at>now())",
      [id, scopeKey(access.scope), this.descriptor.semanticHash],
    );
    const snapshot = result.rows[0]?.data;
    if (!snapshot) throw new WarehouseContractError("WAREHOUSE_SNAPSHOT_UNAVAILABLE");
    if (
      snapshot.permissionEpoch !== access.permissionEpoch ||
      snapshot.privacyEpoch !== access.privacyEpoch
    )
      throw new WarehouseContractError("WAREHOUSE_EPOCH_CHANGED");
    return snapshot;
  }

  async pinSnapshot(request: WarehouseSnapshotRequest): Promise<WarehouseSnapshot> {
    const access = this.access("read");
    return this.transaction(async (db) => {
      const head = await this.head(db, access);
      const id = request.snapshotId ?? head.snapshot_id;
      if (!id) throw new WarehouseContractError("WAREHOUSE_SNAPSHOT_UNAVAILABLE");
      return this.snapshot(db, access, id);
    });
  }

  async describeDataset(_request: { access: WarehouseAccess }): Promise<WarehouseDataset> {
    const access = this.access("read");
    return this.transaction(async (db) => {
      const head = await this.head(db, access);
      const candidates = await db.query<{ data: WarehouseCandidate }>(
        "SELECT data FROM warehouse_candidates WHERE scope_key=$1 AND model_version=$2 ORDER BY id",
        [scopeKey(access.scope), this.descriptor.semanticHash],
      );
      return {
        descriptor: this.descriptor,
        head: head.snapshot_id ? await this.snapshot(db, access, head.snapshot_id) : null,
        candidates: candidates.rows.map((row) => row.data),
        revision: Number(head.revision),
        permissionEpoch: access.permissionEpoch,
        privacyEpoch: access.privacyEpoch,
      };
    });
  }

  async suppress(request: WarehouseSuppressRequest): Promise<{ privacyEpoch: number }> {
    const access = this.access("drop");
    return this.mutation(
      access,
      "suppress",
      request.audit,
      request.identities,
      async (db, head) => {
        if (!request.identities.length || request.identities.some((identity) => !identity))
          throw new WarehouseContractError("WAREHOUSE_IDENTITY_REQUIRED");
        const scope = scopeKey(access.scope);
        for (const identity of request.identities)
          await db.query(
            "INSERT INTO warehouse_suppressions(scope_key,model_version,identity) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
            [scope, this.descriptor.semanticHash, identity],
          );
        await db.query(
          `DELETE FROM ${quoteIdentifier(factTableName(this.descriptor))} WHERE _scope=$1 AND _identity=ANY($2::text[])`,
          [scope, request.identities],
        );
        const privacyEpoch = Number(head.privacy_epoch) + 1;
        await db.query(
          "UPDATE warehouse_heads SET privacy_epoch=$3,revision=revision+1 WHERE scope_key=$1 AND model_version=$2",
          [scope, this.descriptor.semanticHash, privacyEpoch],
        );
        return { privacyEpoch };
      },
    );
  }

  async expireSnapshots(request: WarehouseExpireRequest): Promise<{ expired: number }> {
    const access = this.access("drop");
    return this.mutation(access, "expire", request.audit, request.before, async (db, head) => {
      if (!Number.isFinite(Date.parse(request.before)) || Date.parse(request.before) > Date.now())
        throw new WarehouseContractError("WAREHOUSE_RETENTION_INVALID");
      const result = await db.query(
        "UPDATE warehouse_snapshots SET expires_at=now() WHERE scope_key=$1 AND model_version=$2 AND (data->>'createdAt')::timestamptz<$3::timestamptz AND id IS DISTINCT FROM $4 AND expires_at IS NULL RETURNING id",
        [scopeKey(access.scope), this.descriptor.semanticHash, request.before, head.snapshot_id],
      );
      const scope = scopeKey(access.scope);
      const model = this.descriptor.semanticHash;
      const table = quoteIdentifier(factTableName(this.descriptor));
      await db.query(
        "UPDATE warehouse_candidates SET state='failed',data=jsonb_set(data,'{state}','\"failed\"') WHERE scope_key=$1 AND model_version=$2 AND state IN ('open','sealed') AND created_at<$3::timestamptz",
        [scope, model, request.before],
      );
      await db.query(
        `DELETE FROM ${table} f USING warehouse_candidates c WHERE f._candidate=c.id AND c.scope_key=$1 AND c.model_version=$2 AND c.state='failed' AND c.created_at<$3::timestamptz`,
        [scope, model, request.before],
      );
      await db.query(
        `DELETE FROM ${table} WHERE _scope=$1 AND _visible_to IS NOT NULL AND _visible_to <= COALESCE((SELECT MIN((data->>'revision')::bigint) FROM warehouse_snapshots WHERE scope_key=$1 AND model_version=$2 AND (expires_at IS NULL OR expires_at>now())), $3)`,
        [scope, model, Number(head.revision) + 1],
      );
      await db.query(
        "DELETE FROM warehouse_receipts WHERE candidate_id IN (SELECT id FROM warehouse_candidates WHERE scope_key=$1 AND model_version=$2 AND created_at<$3::timestamptz AND state IN ('failed','published'))",
        [scope, model, request.before],
      );
      await db.query(
        `DELETE FROM warehouse_candidates c WHERE c.scope_key=$1 AND c.model_version=$2 AND c.created_at<$3::timestamptz AND c.state IN ('failed','published') AND NOT EXISTS (SELECT 1 FROM ${table} f WHERE f._candidate=c.id)`,
        [scope, model, request.before],
      );
      await db.query(
        "DELETE FROM warehouse_snapshots WHERE scope_key=$1 AND model_version=$2 AND id IS DISTINCT FROM $3 AND expires_at<=now()",
        [scope, model, head.snapshot_id],
      );
      await db.query(
        "DELETE FROM warehouse_mutations WHERE scope_key=$1 AND model_version=$2 AND created_at<$3::timestamptz",
        [scope, model, request.before],
      );
      return { expired: result.rows.length };
    });
  }

  async synchronizePermissionEpoch(
    request: WarehousePermissionEpochRequest,
  ): Promise<{ permissionEpoch: number }> {
    const current = this.resolveAccess();
    const access = this.access(current.roles.includes("publish") ? "publish" : "drop");
    const audit = request.audit;
    if (
      !audit.reason.trim() ||
      !audit.idempotencyKey.trim() ||
      !Number.isSafeInteger(audit.expectedRevision) ||
      audit.expectedRevision < 0
    )
      throw new WarehouseContractError("WAREHOUSE_AUDIT_REQUIRED");
    return this.transaction(async (db) => {
      const scope = scopeKey(access.scope);
      const model = this.descriptor.semanticHash;
      const headResult = await db.query<Head>(
        "SELECT * FROM warehouse_heads WHERE scope_key=$1 AND model_version=$2 FOR UPDATE",
        [scope, model],
      );
      const head = headResult.rows[0];
      if (!head || Number(head.privacy_epoch) !== access.privacyEpoch)
        throw new WarehouseContractError("WAREHOUSE_EPOCH_CHANGED");
      const fingerprint = createHash("sha256")
        .update(JSON.stringify([access.actor, audit, access.permissionEpoch]))
        .digest("hex");
      const previous = await db.query<{
        outcome: { fingerprint: string; result: { permissionEpoch: number } };
      }>(
        "SELECT outcome FROM warehouse_mutations WHERE scope_key=$1 AND model_version=$2 AND action='permission' AND idempotency_key=$3",
        [scope, model, audit.idempotencyKey],
      );
      if (previous.rows[0]) {
        if (previous.rows[0].outcome.fingerprint !== fingerprint)
          throw new WarehouseContractError("WAREHOUSE_IDEMPOTENCY_CONFLICT");
        return previous.rows[0].outcome.result;
      }
      if (
        Number(head.revision) !== audit.expectedRevision ||
        access.permissionEpoch <= Number(head.permission_epoch)
      )
        throw new WarehouseContractError("WAREHOUSE_REVISION_CONFLICT");
      const result = { permissionEpoch: access.permissionEpoch };
      await db.query(
        "UPDATE warehouse_heads SET permission_epoch=$3,revision=revision+1 WHERE scope_key=$1 AND model_version=$2",
        [scope, model, result.permissionEpoch],
      );
      await db.query(
        "INSERT INTO warehouse_mutations(scope_key,model_version,action,idempotency_key,actor,reason,expected_revision,outcome) VALUES($1,$2,'permission',$3,$4,$5,$6,$7)",
        [
          scope,
          model,
          audit.idempotencyKey,
          access.actor,
          audit.reason,
          audit.expectedRevision,
          { fingerprint, result },
        ],
      );
      return result;
    });
  }

  async removePublication(
    request: WarehouseRemovePublicationRequest,
  ): Promise<{ privacyEpoch: number }> {
    const access = this.access("drop");
    return this.mutation(
      access,
      "remove-publication",
      request.audit,
      request.snapshotId,
      async (db, head) => {
        if (!request.snapshotId || head.snapshot_id !== request.snapshotId)
          throw new WarehouseContractError("WAREHOUSE_HEAD_CONFLICT");
        await db.query(
          "UPDATE warehouse_snapshots SET expires_at=now() WHERE id=$1 AND scope_key=$2 AND model_version=$3",
          [request.snapshotId, scopeKey(access.scope), this.descriptor.semanticHash],
        );
        await db.query(
          `UPDATE ${quoteIdentifier(factTableName(this.descriptor))} SET _visible_to=$2 WHERE _scope=$1 AND _visible_from IS NOT NULL AND _visible_to IS NULL`,
          [scopeKey(access.scope), Number(head.revision) + 1],
        );
        const privacyEpoch = Number(head.privacy_epoch) + 1;
        await db.query(
          "UPDATE warehouse_heads SET snapshot_id=NULL,revision=revision+1,privacy_epoch=$3 WHERE scope_key=$1 AND model_version=$2",
          [scopeKey(access.scope), this.descriptor.semanticHash, privacyEpoch],
        );
        return { privacyEpoch };
      },
    );
  }
}
