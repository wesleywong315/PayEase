/**
 * Stable demo identifiers shared by seed and (later) tests.
 * Keep in sync with SPEC.md §10.
 */
export const DEMO = {
  communityId: "demo-community-hku-hall-football",
  communityName: "HKU Hall Football Team",
  cycleId: "demo-cycle-autumn-2026",
  cycleName: "Autumn 2026",
  users: {
    alex: { id: "user_alex", displayName: "Alex", email: "alex@demo.payease.local" },
    ben: { id: "user_ben", displayName: "Ben", email: "ben@demo.payease.local" },
    chloe: { id: "user_chloe", displayName: "Chloe", email: "chloe@demo.payease.local" },
    dana: { id: "user_dana", displayName: "Dana", email: "dana@demo.payease.local" },
  },
  memberships: {
    alex: "mem_alex",
    ben: "mem_ben",
    chloe: "mem_chloe",
    dana: "mem_dana",
  },
  ruleId: "rule_v1_autumn_2026",
  trainingExpenseId: "expense_season_training",
  transportExpenseId: "expense_friendly_transport",
  fundingId: "funding_received_80",
  cashHardshipId: "cash_hardship_receipt_1",
  capRequestId: "cap_dana_pending",
  auditSeedId: "audit_demo_seed",
  trainingBaselinesCents: {
    mem_alex: 42000,
    mem_ben: 34000,
    mem_chloe: 26000,
    mem_dana: 18000,
  },
  trainingTotalCents: 120000,
  trainingFixedCents: 40000,
  trainingVariableCents: 80000,
  hardshipReceivedCents: 8000,
  danaCapCents: 10000,
  transportFixedCents: 40000,
} as const;

/** Extra communities for multi-community inbox demos (documented Stage 1 seed). */
export const EXTRA_DEMO_COMMUNITIES = {
  volleyball: {
    id: "demo-community-hku-hall-volleyball",
    name: "HKU Hall Volleyball Team",
    cycleId: "demo-cycle-volleyball-2026",
    cycleName: "Autumn 2026",
    memberships: {
      alex: "mem_vb_alex",
      ben: "mem_vb_ben",
    },
  },
  swimming: {
    id: "demo-community-hku-hall-swimming",
    name: "HKU Hall Swimming Team",
    cycleId: "demo-cycle-swimming-2026",
    cycleName: "Autumn 2026",
    memberships: {
      alex: "mem_swim_alex",
      chloe: "mem_swim_chloe",
    },
  },
} as const;
