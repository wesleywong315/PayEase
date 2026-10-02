# PayEase — Product & Technical Specification

**Document status:** Implementation-ready MVP specification  
**Audience:** Hackathon contributors building from a shared contract  
**Currency:** HKD only (stored as integer cents)  
**Prototype notice (required in UI):** `Hackathon prototype — no real payments.`

> **Naming note:** This product is specified as **PayEase**. The current repository still uses the provisional name `TeamFair` in `package.json`, README, and the landing page. Rename during implementation phases; do not treat legacy branding as the product contract.

---

## Status legend

| Label | Meaning |
| --- | --- |
| **IMPLEMENTED** | Present in the repository as of this document and verified by inspection |
| **PLANNED** | Required for the MVP but not yet implemented |
| **MVP DECISION** | Ambiguous product choice resolved here; implement exactly as stated |

---

## 1. Product overview

### 1.1 Identity

| Field | Value |
| --- | --- |
| Product name | **PayEase** |
| Tagline | Fair shared spending for student teams. |
| Primary users | University sports teams, hall teams, and student societies |

### 1.2 Purpose

PayEase helps student teams **agree shared-spending rules before costs are committed**, then track:

- Expense allocations (fixed + usage-linked)
- Hardship / contribution-cap support from a funded pool
- Member departures without erasing committed obligations
- Manual reimbursement and settlement against a simulated treasurer ledger

### 1.3 Primary differentiator

An **explainable, pre-agreed rule** governing who pays and who retains responsibility when circumstances change.

PayEase is **not** merely an equal-split expense tracker.

### 1.4 Constraints

| Constraint | Rule |
| --- | --- |
| Timebox | 48-hour hackathon prototype |
| Currency | HKD only |
| Money representation | Integer **cents** everywhere (DB, API, engine) |
| Persistence | Local SQLite via Prisma |
| Auth | Simulated demo session (not production auth) |
| Payments | Manual confirmation only — **no real custody or money movement** |
| Integrations | No banks, no payment processors |
| Capacity inference | No AI inference of financial capacity |
| Hardship redistribution | No automatic compulsory redistribution onto other members |
| Supplier pricing | No discount-tier engine |
| Fulfillment | No partial-order fulfillment |

---

## 2. MVP scope and non-goals

### 2.1 In scope (MVP) — **PLANNED** unless noted

1. Community + membership + financial cycle management  
2. Rule propose / accept workflow with immutable accepted versions  
3. Draft → preview → commit expenses with allocation snapshots  
4. Funded-pool-only contribution caps and hardship awards  
5. Withdrawal (retain committed / release uncommitted)  
6. Manual cash ledger (contributions, funding receipts, reimbursements, refunds)  
7. Settlement views + coordinator/member reports + CSV / printable HTML  
8. Cycle close with read-only enforcement  
9. Demo seed matching §10  

### 2.2 Already implemented foundation — **IMPLEMENTED**

Verified by repository inspection (not assumed):

| Area | What exists |
| --- | --- |
| App shell | Next.js App Router under `src/app/` |
| Landing | Server-rendered page showing product name, tagline, seeded community name |
| Health API | `GET /api/health` with live DB probe |
| DB | Prisma + SQLite; single `Community` model; migration `init_community` |
| Seed | Idempotent demo community `HKU Hall Football Team` |
| Env validation | Zod schema for `DATABASE_URL` + Vitest coverage |
| Tooling | ESLint, TypeScript strict, Vitest, npm scripts |

**Not implemented** (empty placeholders only): bill splitting, rules, hardship, withdrawals, cash ledger, reports, auth/session, allocation engine, business APIs, UI routes beyond landing + health.

### 2.3 Non-goals (explicit)

- Real payments, wallets, or escrow  
- Bank / FPS / Stripe integrations  
- Income verification, credit scoring, or AI affordability inference  
- Automatically increasing other members’ bills to fund hardship  
- Editing / correcting committed expenses in-place (future adjustment workflow only)  
- Multi-currency, FX, or tax engines  
- Partial order fulfillment / inventory  
- Supplier discount tiers  
- Production-grade authentication (OAuth, SSO, MFA)  
- Anonymity guarantees for hardship recipients  

---

## 3. Architecture

### 3.1 Actual installed stack (from `package.json` / lockfile)

| Layer | Package | Installed version |
| --- | --- | --- |
| Runtime | Node.js | `>=20.19.0` required; verified on `v24.19.0` |
| Package manager | npm | `11.17.0` (do not mix pnpm/Yarn) |
| Framework | `next` | `15.5.27` (App Router) |
| UI | `react` / `react-dom` | `19.1.0` |
| Language | `typescript` | `5.9.3` (strict) |
| Styling | `tailwindcss` + `@tailwindcss/postcss` | `4.3.3` |
| ORM | `prisma` / `@prisma/client` | `7.10.0` |
| SQLite adapter | `@prisma/adapter-better-sqlite3` + `better-sqlite3` | `7.10.0` / `11.10.0` |
| Validation | `zod` | `4.6.5` |
| Tests | `vitest` | `3.2.4` |
| Seed runner | `tsx` | `4.20.5` |
| Config | `prisma.config.ts` + `DATABASE_URL=file:./prisma/dev.db` | **IMPLEMENTED** |

Backend surface: **Next.js Route Handlers** in the same application as the frontend.

### 3.2 Responsibility split

| Layer | Responsibility |
| --- | --- |
| **Frontend** | Demo login UI; forms; previews; “Why this amount?” presentation; loading/empty/error states; never treat client math as authoritative |
| **Backend (Route Handlers + services)** | AuthZ; Zod validation; transactions; persistence; audit events; authoritative financial mutations |
| **Database (Prisma/SQLite)** | Durable entities, constraints, transactional integrity |
| **Allocation engine (pure TS)** | Deterministic fixed/usage split + largest-remainder rounding; no I/O; reusable by API and unit tests |

### 3.3 Module layout (target)

```text
src/
  app/                 # routes + Route Handlers
  components/          # UI
  lib/
    allocation/        # PLANNED pure engine
    money.ts           # PLANNED cents helpers / formatting
    env.ts             # IMPLEMENTED
    db.ts              # IMPLEMENTED server-only Prisma client
  server/
    auth/              # PLANNED demo session
    services/          # PLANNED domain services
    permissions.ts     # PLANNED
  tests/               # unit + service tests
prisma/                # schema, migrations, seed
```

### 3.4 Authority model

- **MVP DECISION:** The backend is the only source of truth for balances, allocations, awards, and cash.  
- Client-side previews are UX aids. Confirming an action **revalidates** server state (revision token / cycle revision — see §9).  
- Never import `src/lib/db.ts` into Client Components.

---

## 4. Roles and privacy

### 4.1 Roles (community-specific via `Membership.role`)

| Role | Capabilities |
| --- | --- |
| **COORDINATOR** | Manage community/cycle; propose rules; create/commit expenses; record hardship funding; approve/reject caps; execute withdrawals; record cash txs; full reports; close cycle |
| **MEMBER** | View community; accept rules; view shared expenses; view **own** allocation explanations; submit **own** cap request; view **own** decision; preview **own** withdrawal impact; view **own** settlement |

### 4.2 Demo session — **PLANNED**

- Lightweight cookie/session after demo login (select seeded user).  
- **MVP DECISION:** Session stores `userId` server-side (signed httpOnly cookie or opaque session id).  
- **Do not** trust `userId` / `membershipId` in request bodies as authentication. Body IDs may identify resources but authorization uses the session.  
- Enforce permissions in services/handlers; hiding buttons is not security.

### 4.3 Privacy

| Data | Who may see |
| --- | --- |
| Contribution-cap amount, hardship explanation, request notes | Requesting member + coordinators of that community |
| Shared expense totals, aggregate hardship funding/support | All active members |
| Individual charges | Only the charged member (+ coordinators for full reports) |

**API rule:** Private fields must never appear in list/detail payloads unless the caller is authorized.

**Inference warning (product honesty):** In small groups, totals can still allow inference of who received support. PayEase does **not** promise anonymity.

**Do not collect:** bank statements, HKID copies, family income records, bank credentials.

---

## 5. Data model

All monetary fields are `Int` cents. Timestamps are UTC. Soft history is preferred over destructive deletes.

### 5.1 Enums

```text
MembershipRole:       COORDINATOR | MEMBER
MembershipStatus:     ACTIVE | LEFT
CycleStatus:          OPEN | CLOSED
RuleStatus:           DRAFT | PROPOSED | ACCEPTED
ExpenseStatus:        DRAFT | COMMITTED | CANCELLED
CapRequestStatus:     PENDING | APPROVED | REJECTED
HardshipFundingKind:  RECEIVED | PLEDGED
CashTxType:           MEMBER_CONTRIBUTION | HARDSHIP_FUNDING_RECEIPT | PAYER_REIMBURSEMENT | MEMBER_REFUND
AuditAction:          (string codes listed with workflows)
```

### 5.2 Entities

#### 1. User

| Field | Type | Notes |
| --- | --- | --- |
| id | String (cuid/stable seed) | PK |
| displayName | String | Demo display |
| email | String? | Optional demo |
| createdAt | DateTime | |

#### 2. Community

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK (seed: `demo-community-hku-hall-football` today — **IMPLEMENTED** name/id only) |
| name | String | e.g. HKU Hall Football Team |
| createdAt | DateTime | |

#### 3. Membership

Link between person and community. **Never hard-delete** when a member leaves.

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK — **stable seed IDs required for rounding ties** |
| communityId | String | FK |
| userId | String | FK |
| role | MembershipRole | |
| status | MembershipStatus | ACTIVE / LEFT |
| joinedAt | DateTime | |
| leftAt | DateTime? | Set on withdrawal |
| Unique | (communityId, userId) | |

#### 4. FinancialCycle

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| communityId | String | FK |
| name | String | e.g. Autumn 2026 |
| status | CycleStatus | OPEN / CLOSED |
| revision | Int | Starts at 1; increments on mutating financial events (**MVP DECISION** stale-preview token) |
| closedAt | DateTime? | |
| closeAcknowledgedOutstanding | Boolean | Required true if closing with unpaid balances |
| createdAt | DateTime | |

Closed cycles are **read-only** for ordinary writes.

#### 5. RuleVersion

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| communityId | String | FK |
| cycleId | String | FK |
| versionNumber | Int | Monotonic per cycle |
| status | RuleStatus | DRAFT / PROPOSED / ACCEPTED |
| title | String | |
| bodyMarkdown | String | Human-readable agreed policy text |
| equalShareFallbackWhenZeroUsage | Boolean | Default true |
| createdByMembershipId | String | FK |
| proposedAt | DateTime? | |
| acceptedAt | DateTime? | When all required acceptances complete |
| Immutable when | status = ACCEPTED | Material changes → new version |

#### 6. RuleAcceptance

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| ruleVersionId | String | FK |
| membershipId | String | FK — must be the accepting member (**no proxy**) |
| acceptedAt | DateTime | |
| Unique | (ruleVersionId, membershipId) | |

#### 7. Expense

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| communityId | String | FK |
| cycleId | String | FK |
| ruleVersionId | String? | Required when COMMITTED |
| status | ExpenseStatus | |
| title | String | |
| category | String | Free-text / small enum for demo |
| fixedCents | Int | ≥ 0 |
| variableCents | Int | ≥ 0 |
| totalCents | Int | Must equal fixed + variable; > 0 |
| usageLabel | String | e.g. Sessions attended |
| frontedByMembershipId | String? | Member who paid supplier externally |
| needsRevision | Boolean | Set if drafts left with 0 participants |
| committedAt | DateTime? | |
| cancelledAt | DateTime? | |
| createdByMembershipId | String | |
| createdAt / updatedAt | DateTime | |

#### 8. ExpenseParticipant

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| expenseId | String | FK |
| membershipId | String | FK |
| usageUnits | Int | ≥ 0 |
| Unique | (expenseId, membershipId) | |
| Constraint | Membership must belong to expense community; LEFT members cannot be **added** to new drafts | |

#### 9. Allocation (snapshot; created only on commit)

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| expenseId | String | FK |
| membershipId | String | FK |
| fixedShareCents | Int | |
| usageShareCents | Int | |
| baselineCents | Int | fixed + usage |
| hardshipAppliedCents | Int | Default 0; may increase via awards |
| finalChargeCents | Int | baseline − hardshipApplied; ≥ 0 |
| Unique | (expenseId, membershipId) | |

#### 10. ContributionCapRequest

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| cycleId | String | FK |
| membershipId | String | FK — requester |
| requestedCapCents | Int | ≥ 0 |
| explanation | String | Private |
| status | CapRequestStatus | |
| decidedByMembershipId | String? | Coordinator |
| decidedAt | DateTime? | |
| rejectionReason | String? | |
| createdAt | DateTime | |
| **MVP DECISION** | At most one **PENDING** request per (cycleId, membershipId) | |

#### 11. HardshipFunding

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| cycleId | String | FK |
| kind | HardshipFundingKind | RECEIVED (spendable) / PLEDGED (not spendable) |
| amountCents | Int | > 0 |
| note | String? | |
| recordedByMembershipId | String | |
| cashTransactionId | String? | Link when kind=RECEIVED |
| createdAt | DateTime | |

#### 12. HardshipAward

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| capRequestId | String | FK Unique — **one award per approved request** |
| cycleId | String | FK |
| membershipId | String | Recipient |
| amountCents | Int | > 0 |
| approvedByMembershipId | String | |
| createdAt | DateTime | |

Application rows (optional child table or JSON audit detail): expense allocation updates applied in chronological order.

#### 13. CashTransaction

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| cycleId | String | FK |
| type | CashTxType | |
| amountCents | Int | > 0 |
| membershipId | String? | Member party when applicable |
| expenseId | String? | Optional link |
| hardshipFundingId | String? | For funding receipts |
| idempotencyKey | String | Unique per cycle |
| note | String? | |
| manuallyConfirmed | Boolean | Always true in MVP |
| recordedByMembershipId | String | Coordinator |
| createdAt | DateTime | |

**MVP DECISION:** Hardship funding receipts create **exactly one** `CashTransaction` of type `HARDSHIP_FUNDING_RECEIPT` linked from `HardshipFunding` — never double-count.

#### 14. Withdrawal

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| cycleId | String | FK |
| membershipId | String | Departing member |
| executedByMembershipId | String | Coordinator |
| previewSnapshotJson | String | Stored copy of last executed preview inputs |
| executedAt | DateTime | |

#### 15. AuditEvent

| Field | Type | Notes |
| --- | --- | --- |
| id | String | PK |
| communityId | String | |
| cycleId | String? | |
| actorMembershipId | String? | |
| action | String | e.g. `EXPENSE_COMMITTED` |
| entityType | String | |
| entityId | String | |
| payloadJson | String | Non-secret structured detail |
| createdAt | DateTime | |

### 5.3 Relationship summary

```text
User 1—* Membership *—1 Community
Community 1—* FinancialCycle
FinancialCycle 1—* RuleVersion 1—* RuleAcceptance
FinancialCycle 1—* Expense 1—* ExpenseParticipant
Expense 1—* Allocation (on commit)
FinancialCycle 1—* ContributionCapRequest 0..1 HardshipAward
FinancialCycle 1—* HardshipFunding
FinancialCycle 1—* CashTransaction
FinancialCycle 1—* Withdrawal
```

---

## 6. Financial rules and invariants

### 6.1 Money conventions

- Store and compute only integer cents.  
- Display as `HK$X.YY` (divide by 100; always two decimals).  
- Reject non-integers / unsafe integers at Zod boundaries.

### 6.2 Allocation policy (pure engine) — **PLANNED**

For expense with fixed `F`, variable `V`, participants `N`, usage `u_i ≥ 0`:

```text
fixedShare_i  = F / N          (largest-remainder on F)
usageShare_i  = V × u_i / U    where U = sum(u)  (largest-remainder on V)
baseline_i    = fixedShare_i + usageShare_i
```

**Largest-remainder (Hamilton) — MVP DECISION:**

1. Compute exact quotas as rationals.  
2. Give each party `floor(quota)`.  
3. Distribute remaining cents one-by-one to parties with largest fractional remainders.  
4. **Tie-break:** ascending lexicographic `membershipId`.  
5. Allocate **fixed** and **variable** components **separately**, then sum.

**Zero usage:** If `U = 0` and `V > 0`:

- Apply equal-share fallback across `N` for the variable component (same rounding).  
- Surface warning `ZERO_USAGE_EQUAL_FALLBACK`.  
- Never divide by zero.

Usage labels are **expense-specific** (sessions, seats, meals, units). No universal participation score.

### 6.3 Validation (draft save + commit)

- `totalCents = fixedCents + variableCents`  
- All monetary fields nonnegative safe integers; `totalCents > 0`  
- ≥ 1 responsible participant  
- Usage units nonnegative integers  
- Every participant membership belongs to the community and is ACTIVE when **added**  
- Departed (`LEFT`) members cannot be added to new drafts  

### 6.4 Commit rules

- Expense must be DRAFT in an OPEN cycle  
- `ruleVersionId` must be ACCEPTED  
- **Every** responsible participant must have a `RuleAcceptance` for that version  
- Persist allocation snapshots; freeze F/V/participants/usage/rule  
- Single DB transaction + `EXPENSE_COMMITTED` audit  
- Increment `FinancialCycle.revision`  
- Draft previews **do not** create liabilities  

**Committed corrections:** Out of MVP. Future work requires an explicit adjustment workflow; do not silently edit snapshots.

### 6.5 Contribution caps & hardship

**Terminology:** A contribution cap is a **self-declared affordability request**. It is not verified income, a credit score, or a guaranteed debt limit. Caps are **cycle-level**.

```text
supportRequired = max(0, baselineCommittedCycleCharges − requestedCap − existingAwards)
```

- Baseline for need assessment = sum of committed baseline allocations for the member in the cycle.  
- **Payments already made do not reduce** the baseline used to assess need.  
- Policy: **FUNDED_POOL_ONLY** — never auto-increase other members’ bills.  

```text
availableSupportBudget = receivedHardshipFunding − approvedHardshipAwards
```

Pledged funding is **not** spendable.

**Approval — MVP DECISION:**

- Coordinator only; full amount only (no partial approval).  
- Require `supportRequired ≤ availableSupportBudget`.  
- Atomic transaction; reject duplicate approval (`capRequestId` unique on award).  
- Apply support to the member’s committed expenses in **committedAt ASC, expenseId ASC**, reducing `hardshipAppliedCents` / `finalChargeCents` until award exhausted.  
- Award does **not** create cash.  

If funding insufficient: return required / available / shortfall; apply nothing.

**Cap vs new commitments — MVP DECISION: `ACKNOWLEDGE_CAP_BREACH`**

- A pending/approved cap is **never** silently treated as guaranteed.  
- Before commit, server computes projected baseline cycle charges for each participant (existing committed baselines + this expense baselines) minus existing awards.  
- If any participant would exceed their latest PENDING or APPROVED requested cap, commit is rejected **unless** the coordinator sends `acknowledgeProjectedCapBreaches: true`.  
- UI must show exact projected breach amounts; audit logs the acknowledgement.  
- Resolving/funding the request is **not** required before commit (teams can still lock supplier costs), but acknowledgement is mandatory when a breach is projected.  
- New expenses can require additional support; prior approval does not guarantee future support.  

**Overpayment after support:** If applied hardship makes `contributionsReceived − refundsPaid > finalCharges`, show **refund due**. Do not auto-move money; allow manual `MEMBER_REFUND` subject to treasurer cash.

### 6.6 Withdrawal policy

**Policy name:** `RETAIN_COMMITTED_RELEASE_UNCOMMITTED`

| Item | Behavior |
| --- | --- |
| Committed participation / allocations | Retained |
| Uncommitted draft participation | Removed |
| Committed bill | Not redistributed |
| Automatic refund | Not assumed |
| Draft left with 0 participants | `needsRevision=true`; commitment prohibited until fixed |

Preview is read-only. Execution is coordinator-only, atomic, audited.

### 6.7 Manual cash ledger

Simulated centralized treasurer. Labels: **manually confirmed, not bank verified**.

**Per member**

```text
contributionBalance =
  sum(finalChargeCents)
  − sum(MEMBER_CONTRIBUTION)
  + sum(MEMBER_REFUND)

if contributionBalance > 0 → contribution outstanding
if contributionBalance < 0 → refund due

outstandingReimbursement =
  sum(totals of COMMITTED expenses fronted by member)
  − sum(PAYER_REIMBURSEMENT to member)
```

**Treasurer cash**

```text
treasurerCash =
  sum(HARDSHIP_FUNDING_RECEIPT)
  + sum(MEMBER_CONTRIBUTION)
  − sum(PAYER_REIMBURSEMENT)
  − sum(MEMBER_REFUND)
```

Fronted supplier payments are **not** treasurer outflows.

**MVP DECISION:** Do **not** auto-net a member’s contribution debt against reimbursement credit.

Cash validation:

- Positive integer cents; coordinator auth; unique `idempotencyKey` per cycle  
- Contribution ≤ outstanding contribution  
- Reimbursement ≤ outstanding reimbursement  
- Refund ≤ refund due  
- Reimbursement/refund ≤ available treasurer cash  
- Treasurer cash never negative after a permitted payout  

### 6.8 Invariants (must be tested)

1. Σ baseline allocations = expense total  
2. finalCharge = baseline − hardshipApplied  
3. finalCharge ≥ 0  
4. Σ finalCharges + Σ hardshipApplied on expense = expense total  
5. Σ hardship awards ≤ Σ received funding (cycle)  
6. Pledged funding excluded from spendable budget  
7. Preview endpoints mutate nothing  
8. Leaving does not erase committed obligations  
9. Identical idempotency keys do not duplicate cash txs  
10. Permitted payouts cannot drive treasurer cash negative  

---

## 7. Workflows and state transitions

State machines:

```text
RuleVersion:     DRAFT → PROPOSED → ACCEPTED   (ACCEPTED immutable)
Expense:         DRAFT → COMMITTED | CANCELLED
                 DRAFT with needsRevision cannot → COMMITTED until fixed
FinancialCycle:  OPEN → CLOSED (read-only)
Membership:      ACTIVE → LEFT
CapRequest:      PENDING → APPROVED | REJECTED
```

### 7.1 Create community and cycle

| Item | Detail |
| --- | --- |
| Actor | Authenticated user (becomes COORDINATOR) |
| Preconditions | Valid session |
| Inputs | Community name; cycle name |
| Backend | Create Community, Membership(COORDINATOR,ACTIVE), FinancialCycle(OPEN, revision=1); audit |
| Frontend | Create form → redirect dashboard |
| Errors | `UNAUTHORIZED`, `VALIDATION_ERROR` |
| Acceptance | Community + open cycle visible; actor is coordinator |

### 7.2 Propose and accept a rule

| Item | Detail |
| --- | --- |
| Actor | Coordinator proposes; each ACTIVE member accepts self |
| Preconditions | OPEN cycle |
| Inputs | Title, body, fallback flag; acceptance from session membership |
| Backend | DRAFT→PROPOSED; create acceptances; when all **ACTIVE** members at propose-time have accepted → ACCEPTED + `acceptedAt`. **MVP DECISION:** Required acceptors = ACTIVE memberships when status becomes PROPOSED (snapshot list stored on rule). Later joiners do not block; they need a new version for new commits. |
| Frontend | Rule page with accept CTA; progress of acceptances (names only, no private data) |
| Errors | `FORBIDDEN`, `RULE_NOT_PROPOSED`, `ALREADY_ACCEPTED`, `CYCLE_CLOSED` |
| Acceptance | No coordinator proxy acceptance; accepted rules immutable |

### 7.3 Create and preview a draft expense

| Item | Detail |
| --- | --- |
| Actor | Coordinator |
| Preconditions | OPEN cycle; ACTIVE participants |
| Inputs | Title, category, F, V, usageLabel, participants[], usageUnits |
| Backend | Upsert DRAFT; preview endpoint runs pure engine + returns warnings; **no allocations persisted** |
| Frontend | Live preview; amber zero-usage warning |
| Errors | Validation errors; `MEMBER_NOT_ACTIVE` |
| Acceptance | Preview sum equals total; DB allocations unchanged |

### 7.4 Commit an expense

| Item | Detail |
| --- | --- |
| Actor | Coordinator |
| Preconditions | DRAFT; not needsRevision; OPEN; rule ACCEPTED by all participants; revision token match |
| Inputs | expenseId; `cycleRevision`; optional `acknowledgeProjectedCapBreaches` |
| Backend | Revalidate; check acceptances; cap-breach policy; transaction: snapshots, status COMMITTED, audit, revision++ |
| Frontend | Confirm dialog; show cap warnings; stale → refresh |
| Errors | `MISSING_RULE_ACCEPTANCE`, `STALE_REVISION`, `CAP_BREACH_ACK_REQUIRED`, `EXPENSE_NEEDS_REVISION` |
| Acceptance | Allocations frozen; liabilities exist only after commit |

### 7.5 Record received hardship funding

| Item | Detail |
| --- | --- |
| Actor | Coordinator |
| Inputs | amountCents; kind RECEIVED or PLEDGED; note; idempotencyKey |
| Backend | If RECEIVED: create HardshipFunding + CashTransaction linked; if PLEDGED: funding row only; revision++ |
| Frontend | Funding form; show received vs pledged separately |
| Errors | `IDEMPOTENCY_CONFLICT`, validation |
| Acceptance | Only RECEIVED increases spendable budget and treasurer cash |

### 7.6 Submit and approve a contribution-cap request

| Item | Detail |
| --- | --- |
| Actor | Member submits; Coordinator decides |
| Inputs | requestedCapCents; explanation; decision |
| Backend | Create PENDING; on approve compute supportRequired vs budget; if short → `INSUFFICIENT_HARDSHIP_FUNDING` with details; else award + apply to allocations atomically; reject path sets REJECTED |
| Frontend | Private request UI; coordinator sees required/available/shortfall |
| Errors | `DUPLICATE_PENDING_REQUEST`, `INSUFFICIENT_HARDSHIP_FUNDING`, `ALREADY_DECIDED`, `FORBIDDEN` |
| Acceptance | No partial awards; private fields withheld from other members |

### 7.7 Preview and execute withdrawal

| Item | Detail |
| --- | --- |
| Actor | Member may preview own; Coordinator executes |
| Backend preview | Committed baseline, hardship, final liability, cash position, released draft estimates, remaining members’ revised draft estimates, warnings — **no writes** |
| Backend execute | Mark LEFT; remove from drafts; flag empty drafts; create Withdrawal + audit; revision++; atomic |
| Errors | `ALREADY_LEFT`, `FORBIDDEN`, `CYCLE_CLOSED` |
| Acceptance | Committed bills retained; drafts updated; no auto refund |

### 7.8 Record member contributions

| Item | Detail |
| --- | --- |
| Actor | Coordinator |
| Inputs | membershipId; amountCents; idempotencyKey |
| Backend | Cap to outstanding contribution; create MEMBER_CONTRIBUTION; revision++ |
| Errors | `EXCEEDS_OUTSTANDING_CONTRIBUTION`, `IDEMPOTENCY_CONFLICT` |
| Acceptance | Labeled manually confirmed |

### 7.9 Record payer reimbursement

| Item | Detail |
| --- | --- |
| Actor | Coordinator |
| Inputs | membershipId (payer); amountCents; idempotencyKey |
| Backend | ≤ outstanding reimbursement and ≤ treasurer cash; PAYER_REIMBURSEMENT |
| Errors | `EXCEEDS_OUTSTANDING_REIMBURSEMENT`, `INSUFFICIENT_TREASURER_CASH` |
| Acceptance | Does not auto-net vs contribution balance |

### 7.10 Record a member refund

| Item | Detail |
| --- | --- |
| Actor | Coordinator |
| Inputs | membershipId; amountCents; idempotencyKey |
| Backend | ≤ refund due and ≤ treasurer cash; MEMBER_REFUND |
| Errors | `EXCEEDS_REFUND_DUE`, `INSUFFICIENT_TREASURER_CASH` |
| Acceptance | Used after hardship overpayment scenarios |

### 7.11 View settlement and export report

| Item | Detail |
| --- | --- |
| Actor | Member: own statement; Coordinator: full report |
| Backend | Aggregations respecting privacy; CSV with escaping + formula injection protection (`'` prefix for cells starting with `=,+,-,@`) |
| Frontend | Settlement page; printable HTML; download CSV |
| Acceptance | Report reconciles to invariants in §6.8 |

### 7.12 Close a financial cycle

| Item | Detail |
| --- | --- |
| Actor | Coordinator |
| Preconditions | No DRAFT expenses; no PENDING cap requests; no PROPOSED rules awaiting acceptance (**MVP DECISION**) |
| Inputs | `acknowledgeOutstandingBalances: true` if any contribution/reimbursement/refund outstanding |
| Backend | Set CLOSED; audit; block ordinary writes thereafter |
| Errors | `DRAFTS_REMAIN`, `PENDING_DECISIONS_REMAIN`, `OUTSTANDING_ACK_REQUIRED` |
| Acceptance | Unpaid balances are **not** silently marked settled; reports remain readable |

---

## 8. Frontend routes and components

### 8.1 Global UI requirements

- Show banner: **Hackathon prototype — no real payments.**  
- Responsive; light background; navy text; teal primary; amber warnings; red errors  
- Accessible labels + keyboard controls  
- Money as `HK$` with two decimals  

### 8.2 Required interface states

Loading · Empty · Validation error · Authorization error · Insufficient funding · Stale preview · Success · Closed/read-only cycle

### 8.3 Routes — **PLANNED** (unless noted)

| Route | Purpose |
| --- | --- |
| `/` | Landing — **IMPLEMENTED** (still branded TeamFair; notice text differs slightly) |
| `/login` | Demo user picker → session |
| `/communities` | Community list |
| `/communities/[communityId]` | Dashboard |
| `/communities/[communityId]/rules` | Rule agreement |
| `/communities/[communityId]/expenses` | Expense list |
| `/communities/[communityId]/expenses/new` | Create draft |
| `/communities/[communityId]/expenses/[expenseId]` | Detail + preview/commit |
| `/communities/[communityId]/hardship` | Funding + requests |
| `/communities/[communityId]/withdrawals` | Withdrawal simulator |
| `/communities/[communityId]/settlement` | Settlement |
| `/communities/[communityId]/report` | Cycle report + export |

### 8.4 Dashboard widgets

Total committed expenses · Final member allocations (role-aware) · Hardship funding received · Hardship support applied · Outstanding contributions · Outstanding reimbursements · Treasurer cash · Pending rule acceptances

### 8.5 “Why this amount?” breakdown

Fixed share · Usage share · Baseline · Hardship support · Final charge · Contributions recorded · Outstanding contribution or refund due

### 8.6 Suggested components

`AppNoticeBanner`, `MoneyText`, `StatusBadge`, `CycleReadOnlyBanner`, `RuleAcceptanceList`, `ExpenseForm`, `AllocationPreviewTable`, `CapRequestForm`, `FundingForm`, `WithdrawalPreviewPanel`, `SettlementTable`, `ReportExportButtons`, `ErrorAlert`, `StalePreviewBanner`

---

## 9. API contracts

### 9.1 Conventions — **PLANNED**

- Base: `/api/...` Route Handlers  
- Auth: session cookie; 401 if missing  
- Validate bodies/queries with Zod  
- Standard error:

```json
{
  "error": {
    "code": "INSUFFICIENT_HARDSHIP_FUNDING",
    "message": "Available hardship funding is insufficient.",
    "details": {
      "requiredCents": 8000,
      "availableCents": 5000,
      "shortfallCents": 3000
    }
  }
}
```

- Never return stack traces, env values, or DB paths  
- Mutating financial endpoints accept `cycleRevision` and return updated `cycleRevision`  
- On mismatch → `409` / `STALE_REVISION`  

### 9.2 Existing endpoint — **IMPLEMENTED**

| Method | Route | Auth | Success | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | none | `{ status:"ok", database:"connected" }` | 503 on DB failure |

### 9.3 API table — **PLANNED**

| Method | Route | Role | Request (summary) | Success | Errors | Side effects |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/session` | public | `{ userId }` from demo allowlist | `{ user, memberships }` + Set-Cookie | `USER_NOT_FOUND` | Create session |
| DELETE | `/api/session` | any | — | `{ ok:true }` | — | Destroy session |
| GET | `/api/communities` | authed | — | Community list for user’s memberships | 401 | none |
| POST | `/api/communities` | authed | `{ name, cycleName }` | community+cycle | validation | Create community/cycle/membership |
| GET | `/api/communities/:id` | member | — | dashboard aggregates (privacy filtered) | 403 | none |
| POST | `/api/communities/:id/cycles` | coordinator | `{ name }` | cycle | 403, closed | Create OPEN cycle |
| POST | `/api/cycles/:cycleId/rules` | coordinator | rule fields + `cycleRevision` | rule DRAFT/PROPOSED | 403, STALE | Create/propose rule |
| POST | `/api/rules/:ruleId/propose` | coordinator | `cycleRevision` | PROPOSED + requiredAcceptors | — | Status change |
| POST | `/api/rules/:ruleId/acceptances` | member (self) | — | acceptance; maybe ACCEPTED | FORBIDDEN proxy | Acceptance row |
| GET | `/api/cycles/:cycleId/expenses` | member | — | expense list | — | none |
| POST | `/api/cycles/:cycleId/expenses` | coordinator | expense+participants+`cycleRevision` | DRAFT expense | validation | Persist draft |
| PATCH | `/api/expenses/:id` | coordinator | patch+`cycleRevision` | updated DRAFT | NOT_DRAFT | Update |
| POST | `/api/expenses/:id/preview` | member | optional body overrides | allocation preview + warnings | — | **none** |
| POST | `/api/expenses/:id/commit` | coordinator | `{ cycleRevision, acknowledgeProjectedCapBreaches? }` | committed+allocations | MISSING_RULE_ACCEPTANCE, CAP_BREACH_ACK_REQUIRED, STALE, NEEDS_REVISION | Snapshots+audit |
| POST | `/api/cycles/:cycleId/hardship-funding` | coordinator | `{ amountCents, kind, note, idempotencyKey, cycleRevision }` | funding[+cash] | IDEMPOTENCY_CONFLICT | Funding±cash |
| POST | `/api/cycles/:cycleId/cap-requests` | member self | `{ requestedCapCents, explanation }` | request (private) | DUPLICATE_PENDING | Create PENDING |
| POST | `/api/cap-requests/:id/decision` | coordinator | `{ decision:"APPROVE"|"REJECT", rejectionReason?, cycleRevision }` | award or rejection | INSUFFICIENT_HARDSHIP_FUNDING, ALREADY_DECIDED | Award+allocation updates |
| POST | `/api/memberships/:id/withdrawal/preview` | self or coordinator | — | preview DTO | — | **none** |
| POST | `/api/memberships/:id/withdrawal/execute` | coordinator | `{ cycleRevision }` | withdrawal result | ALREADY_LEFT | LEFT+draft cleanup |
| GET | `/api/cycles/:cycleId/settlement` | member/coordinator | — | balances (filtered) | — | none |
| POST | `/api/cycles/:cycleId/cash-transactions` | coordinator | `{ type, amountCents, membershipId?, idempotencyKey, cycleRevision }` | tx | EXCEEDS_*, INSUFFICIENT_TREASURER_CASH | Cash row |
| GET | `/api/cycles/:cycleId/report` | coordinator (full) / member (own) | `?format=json\|csv` | report | 403 | none |
| POST | `/api/cycles/:cycleId/close` | coordinator | `{ acknowledgeOutstandingBalances?, cycleRevision }` | CLOSED | DRAFTS_REMAIN, PENDING_DECISIONS_REMAIN, OUTSTANDING_ACK_REQUIRED | Close cycle |

---

## 10. Demo data

Seed must be **idempotent** with stable IDs.

### 10.1 Currently seeded — **IMPLEMENTED**

| Entity | Value |
| --- | --- |
| Community id | `demo-community-hku-hall-football` |
| Community name | `HKU Hall Football Team` |

### 10.2 Target demo seed — **PLANNED**

| Entity | Stable ID / value |
| --- | --- |
| Cycle | `demo-cycle-autumn-2026` — “Autumn 2026”, OPEN |
| Users | Alex, Ben, Chloe, Dana |
| Memberships | `mem_alex` (COORDINATOR), `mem_ben`, `mem_chloe`, `mem_dana` (MEMBER, ACTIVE) |
| Rule v1 | ACCEPTED by all four |
| Committed expense | “Season training package” — total **120000¢**; fixed **40000¢**; variable **80000¢**; usage Alex4 Ben3 Chloe2 Dana1; Alex fronted full amount |
| Expected baselines | Alex **42000**; Ben **34000**; Chloe **26000**; Dana **18000** |
| Hardship funding | RECEIVED **8000¢** |
| Cap request | Dana requests cap **10000¢** — initially **PENDING** in polished demo path; approval script/step documents post-approval state |
| Draft expense | “Upcoming friendly-match transport” — fixed **40000¢**; variable **0**; four participants; DRAFT |
| Cash | Initial contributions/reimbursements/refunds = **0** |

### 10.3 Post-approval expectations

After approving Dana’s request (support **8000¢**):

| Metric | Value |
| --- | --- |
| Dana final charge | **10000¢** |
| Others | unchanged |
| Σ final member charges | **112000¢** |
| Applied hardship | **8000¢** |
| Combined | **120000¢** |

### 10.4 Withdrawal rounding check

After support approval, Dana leaves:

- Retains **10000¢** committed charge  
- Releases **10000¢** draft transport estimate  
- Remaining draft equal shares of **40000¢** among `mem_alex`, `mem_ben`, `mem_chloe`  
- With ascending ID tie-break: **13334**, **13333**, **13333** cents → HK$133.34, HK$133.33, HK$133.33  

---

## 11. Testing and acceptance criteria

### 11.1 Current tests — **IMPLEMENTED**

- Env validation rejects empty/missing `DATABASE_URL` (`src/tests/env.test.ts`)

### 11.2 Required tests — **PLANNED**

**Unit (allocation engine)**

- Seed training-package baselines  
- Largest-remainder + membershipId tie-break  
- Zero usage fallback + warning  
- Invalid inputs rejected  

**Service / API**

- Missing rule acceptance blocks commit  
- Hardship shortfall details  
- Concurrent funding approval does not overspend (transaction / constraint)  
- Private fields absent for unauthorized callers  
- Withdrawal persistence + empty draft `needsRevision`  
- Preview non-mutation  
- Stale `cycleRevision` rejected  
- Payment idempotency  
- Payout limits / treasurer cash floor  
- Overpayment → refund due  
- Closed-cycle write rejection  
- Report reconciliation to invariants  

**E2E / demo script**

- Login → accept rules → commit training package → fund → approve Dana → settlement numbers → withdrawal preview/execute → report CSV  

### 11.3 Definition of demo-done

1. Notice banner visible  
2. Seed numbers match §10  
3. Coordinator can complete workflows 1–12 on OPEN cycle  
4. Member privacy respected in Network payloads  
5. `npm test`, lint, typecheck, build pass  

---

## 12. Implementation phases

### Phase 1 — Environment, DB, seed  
**Status:** Foundation **IMPLEMENTED**; full demo schema/seed **PLANNED**

| | |
| --- | --- |
| Deliverables | Expand Prisma models; migrations; idempotent full demo seed; keep health + landing |
| Dependencies | Current repo foundation |
| Acceptance | Seed creates §10 entities; migrate/seed idempotent |
| Ownership | Platform / fullstack |

### Phase 2 — Allocation engine and tests

| | |
| --- | --- |
| Deliverables | `src/lib/allocation/*` pure module + Vitest vectors including demo numbers |
| Dependencies | None (pure) |
| Acceptance | §10 baselines + transport remainder tests green |
| Ownership | Engine specialist |

### Phase 3 — Community, rules, expense workflow

| | |
| --- | --- |
| Deliverables | Session; communities; rules accept; expense CRUD/preview/commit APIs + UI |
| Dependencies | Phases 1–2 |
| Acceptance | Commit blocked without acceptances; snapshots persist |
| Ownership | Fullstack pair (API + UI) |

### Phase 4 — Funded hardship

| | |
| --- | --- |
| Deliverables | Funding receipts/pledges; cap requests; approve/reject; allocation application |
| Dependencies | Phase 3 |
| Acceptance | Shortfall errors; Dana post-approval totals |
| Ownership | Backend-heavy + privacy UI |

### Phase 5 — Withdrawal

| | |
| --- | --- |
| Deliverables | Preview + execute; draft cleanup; rounding checks |
| Dependencies | Phases 3–4 |
| Acceptance | Preview immutable; committed retained; draft shares §10.4 |
| Ownership | Fullstack |

### Phase 6 — Manual settlement and reporting

| | |
| --- | --- |
| Deliverables | Cash txs; settlement; report JSON/CSV/HTML print; cycle close |
| Dependencies | Phases 3–5 |
| Acceptance | Ledger invariants; close guards |
| Ownership | Fullstack |

### Phase 7 — Integration testing and demo polish

| | |
| --- | --- |
| Deliverables | E2E script; rename TeamFair→PayEase in UI/docs/package; notice text; demo checklist |
| Dependencies | Phases 1–6 |
| Acceptance | §11.3 |
| Ownership | Whole team |

### Optional (non-blocking)

- Multi-cycle history UX polish  
- Email-less invite codes  
- Richer audit timeline UI  
- Adjustment workflow for committed expenses  
- Netting contributions vs reimbursements  
- Partial hardship approval  

---

## 13. Limitations and future extensions

### 13.1 Known limitations

- Simulated auth and manual cash only  
- Single currency (HKD)  
- No committed-expense corrections in MVP  
- No anonymity guarantee for hardship  
- SQLite local prototype — not multi-tenant production hardened  
- Repository branding may lag product name until Phase 7  

### 13.2 Future extensions

- Real auth providers  
- Bank/FPS verification webhooks  
- Explicit adjustment / reversal documents  
- Multi-currency  
- Optional anonymous hardship aggregates with differential privacy research  
- Mobile-native clients  

---

## Appendix A — Discrepancies with current repository

| Topic | Spec (PayEase) | Repository today |
| --- | --- | --- |
| Product name | PayEase | `teamfair` / “TeamFair” in package, README, landing |
| Prototype notice | `Hackathon prototype — no real payments.` | `Prototype — no real payments.` |
| Data model | 15 entities | Only `Community` |
| Seed | Full §10 demo | Community name/id only |
| Auth / APIs | Session + domain routes | Only `GET /api/health` |
| Allocation engine | Required pure module | Absent |
| UI routes | Login, dashboard, expenses, etc. | Landing only |
| Tests | Broad financial suite | Env validation only |
| `src/components`, `src/server/services` | Domain code | Empty placeholders |

---

## Appendix B — Locked MVP decisions (quick index)

1. Product name: **PayEase**  
2. Stale preview token: **`FinancialCycle.revision`**  
3. Cap breach on commit: **`ACKNOWLEDGE_CAP_BREACH`** (coordinator flag required; cap never guaranteed)  
4. Hardship policy: **`FUNDED_POOL_ONLY`**; no partial approvals  
5. Withdrawal: **`RETAIN_COMMITTED_RELEASE_UNCOMMITTED`**  
6. Rounding ties: **ascending `membershipId`**  
7. No auto-netting of contribution vs reimbursement  
8. Hardship RECEIVED ↔ single linked cash receipt (no double count)  
9. Rule acceptors: ACTIVE members snapshot at propose time  
10. Cycle close requires ack if outstanding balances remain; drafts/pending decisions block close  

---

## 14. Personal community finance experience (product update)

**Status:** Incremental requirements layered on §§1–13. Financial invariants in §6 remain authoritative.

### 14.1 Current repository snapshot (inspection)

| Area | Status |
| --- | --- |
| Prisma domain models + SQLite seed (§10 football demo) | **IMPLEMENTED** |
| Pure allocation engine + Vitest | **IMPLEMENTED** |
| Read-only community UI shells | **IMPLEMENTED** (no mutations) |
| Demo session / protected routes | **MISSING** (login is preview-only) |
| Hardship / withdrawal / settlement / report **services** | **NOT IMPLEMENTED** (UI reads DB only) |
| Invitations, categories, payment submissions, notifications | **MISSING** |
| Package name still `teamfair` | Cosmetic lag |

### 14.2 Main journey

```text
Landing (/) → Login → Personal community inbox (/communities)
→ Selected community home → role-scoped features
```

The inbox **looks like** a messaging conversation list. It is **not** a chat system (no messages, unread chat counts, or sending).

Permissions are **community-scoped** via `Membership.role` for the selected community. A user may be COORDINATOR in one community and MEMBER in another.

### 14.3 Design system

| Token | Hex | Use |
| --- | --- | --- |
| `--color-ink` | `#103b2f` | Headings, primary text, navigation |
| `--color-primary` | `#1f5a45` | Primary actions, selected states |
| `--color-accent-mid` | `#3f8068` | Secondary accents, charts |
| `--color-canvas` | `#f3efe6` | Main background / light surfaces |
| `--color-warm` | `#b88a5a` | Warm accent, highlights, charts |
| `--color-landing` | `#2b5a43` | **Landing page background only** |

Typography:

- **Inter** — headings and UI/body.
- **JetBrains Mono** — financial tables and emphasized monetary data.
- Money display: `HK$1,200.00` (thousands separators); storage remains integer cents.

Semantic states (error/warning/success) must include **text + icon**, not color alone. Narrow scoped semantic colors allowed without replacing the brand palette.

### 14.4 Auth (demo)

- Signed httpOnly session cookie storing `userId` (HMAC). Not production security.
- Label demo auth clearly.
- After login → `/communities` (or safe `next` destination for invites).
- Signed-out access to protected routes → `/login?next=…`.
- Signed-in visitor on `/` sees “Open my communities” instead of forcing re-login.
- Logout clears session.

### 14.5 Personal inbox (`/communities`)

Show only communities where the user has an **ACTIVE** membership.

Each row: avatar/initials, name, role, financial summary chips, latest activity timestamp when available.

Personal header summary (do **not** net across communities):

- Contributions I still owe (sum of positive contribution balances).
- Reimbursements owed to me.
- Refunds due to me (separate).

Community row chips:

- “You owe HK$…”
- “Reimbursement due HK$…”
- “Refund due HK$…”
- Coordinator labelled as collection/contact coordinator where useful — **not** as personal owner of treasurer ledger debt.

`+` opens Create community / Join community (later stages). Profile shows name, communities/roles, logout, demo notice.

Empty: “You haven’t joined a community yet.” + Create/Join.

### 14.6 Create community / QR invitations / join

- Any authenticated user may create a community; creator membership = COORDINATOR (server-assigned).
- Optional description; required name validated server-side.
- Invitations: opaque token URL `/join/[token]`; coordinator create/revoke; default expiry **7 days**; reusable until expired/revoked; grants **MEMBER** only.
- Join confirmation before membership; no finances pre-join; login-preserving `next`; idempotent join; rejoin does not erase liabilities; no retroactive expense allocation.
- Camera QR scan: permission on demand; no frame upload; paste-link fallback.

### 14.7 Community home & role nav

Shared: name, avatar, role, back to inbox, cycle selector.

Coordinator nav: Overview, Expenses, Rules, Members/Invitations, Hardship, Withdrawals, Updates, Reports.

Member nav: Overview, My payments, Expenses (visibility rules), Rules, My hardship, My withdrawals.

### 14.8 Member payment ribbons & placeholder payments

- Due-soon window: **next 7 days + overdue**; order overdue → earliest due → stable id.
- Expense `dueAt` required for new payable expenses; legacy without date → “No due date set” (never invent overdue).
- Payment methods UI: Alipay / wallet placeholders “Coming soon”; **Demo / Simulate payment** only.
- `PaymentSubmission`: `PENDING_CONFIRMATION` | `CONFIRMED` | `REJECTED`.
- Member simulate → pending only (no cash, no debt reduction).
- Coordinator confirm → revalidate outstanding → one `MEMBER_CONTRIBUTION` cash tx atomically; reject double confirm; stale balance → explicit error.

### 14.9 Rules, categories, report chart, updates, privacy

- Coordinator-editable feature toggles via **new rule versions** (never silent rewrite of committed history).
- Distinguish **member contribution cap** (private, funded hardship) vs **cycle budget cap** (optional max committed spend; drafts excluded; blocks over-cap commits).
- Community reusable categories + one-time labels; archive don’t delete; chart aggregates one-time as “One-time expenses”.
- Report pie/donut from committed expense totals; accessible table; coordinator full report / member privacy-safe statement.
- Coordinator Updates: payment submitted/confirmed/rejected notifications with read state.
- Hardship/withdrawal private fields: requester + community coordinators only.

### 14.10 Implementation stages (this update)

1. Theme/typography, landing, demo session, personal inbox, profile.  
2. Create community + invitations + join confirmation.  
3. Role-scoped community home + member payment ribbons + due dates.  
4. Payment submissions + coordinator updates.  
5. Rules feature settings + cycle budget cap.  
6. Categories + report chart.  
7. Privacy hardening + regression suite.

Preserve §6 allocation / hardship / withdrawal / ledger invariants when those services are implemented. Do not replace DB-backed pages with static mocks. Ask before destructive migrations.

### 14.11 Locked decisions (additions)

11. Inbox is conversation-list **UI metaphor only** — not messaging.  
12. Invitation default expiry: **7 days**; role granted: **MEMBER** only.  
13. Due-soon window: **7 days + overdue**.  
14. Simulated member payment creates **PENDING_CONFIRMATION** only until coordinator confirms.  
15. Money display uses thousands separators (`HK$1,200.00`).  
16. Landing background `#2b5a43` is the sole full-page palette exception.  

---

*End of specification. Implement against this document; do not invent conflicting financial rules or API contracts.*
