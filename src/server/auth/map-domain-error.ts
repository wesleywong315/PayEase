import { apiError } from "@/server/auth/permissions";
import { DomainError } from "@/server/services/communities";

const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  STALE_REVISION: 409,
  CONFLICT: 409,
  CYCLE_CLOSED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  ALREADY_LEFT: 409,
  ALREADY_ACCEPTED: 409,
  ALREADY_DECIDED: 409,
  DUPLICATE_PENDING_REQUEST: 409,
  BUDGET_CAP_EXCEEDED: 422,
  PRECONDITION_FAILED: 422,
  INSUFFICIENT_HARDSHIP_FUNDING: 422,
  CAP_BREACH_ACK_REQUIRED: 422,
  INSUFFICIENT_TREASURER_CASH: 422,
  DRAFTS_REMAIN: 422,
  PENDING_DECISIONS_REMAIN: 422,
  OUTSTANDING_ACK_REQUIRED: 422,
  FEATURE_DISABLED: 422,
  EXCEEDS_OUTSTANDING_REIMBURSEMENT: 422,
  EXCEEDS_OUTSTANDING_CONTRIBUTION: 422,
};

export function mapDomainError(err: unknown) {
  if (err instanceof DomainError) {
    return apiError(
      STATUS_BY_CODE[err.code] ?? 400,
      err.code,
      err.message,
      err.details,
    );
  }
  console.error(err);
  return apiError(500, "INTERNAL", "Unexpected server error.");
}
