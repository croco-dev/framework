import type {
  CheckRequest,
  CheckResult,
  GrantRequest,
  ListRequest,
  RelationTuple,
  RevokeRequest,
} from "../types.js";

export interface AccessProvider {
  check(request: CheckRequest): Promise<CheckResult>;
  grant(request: GrantRequest): Promise<void>;
  revoke(request: RevokeRequest): Promise<void>;
  list(request: ListRequest): Promise<RelationTuple[]>;
}
