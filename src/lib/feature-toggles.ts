export type FeatureToggles = {
  hardshipEnabled: boolean;
  withdrawalsEnabled: boolean;
  contributionsEnabled: boolean;
};

export const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  hardshipEnabled: true,
  withdrawalsEnabled: true,
  contributionsEnabled: true,
};

export function parseFeatureToggles(json: string): FeatureToggles {
  try {
    const parsed = JSON.parse(json) as Partial<FeatureToggles>;
    return {
      hardshipEnabled: parsed.hardshipEnabled ?? true,
      withdrawalsEnabled: parsed.withdrawalsEnabled ?? true,
      contributionsEnabled: parsed.contributionsEnabled ?? true,
    };
  } catch {
    return { ...DEFAULT_FEATURE_TOGGLES };
  }
}
