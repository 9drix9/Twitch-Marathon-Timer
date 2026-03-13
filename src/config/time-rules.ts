import { redis, keys } from "@/lib/db";

export interface TimeRules {
  tier1_sub_ms: number;
  tier2_sub_ms: number;
  tier3_sub_ms: number;
  gifted_sub_ms: number;
  bits_per_100_ms: number;
  donation_per_dollar_ms: number;
  follow_ms: number;
  follow_enabled: boolean;
  raid_ms: number;
  raid_enabled: boolean;
  custom_rewards: Record<string, number>;
}

export const DEFAULT_RULES: TimeRules = {
  tier1_sub_ms: 5 * 60_000,
  tier2_sub_ms: 10 * 60_000,
  tier3_sub_ms: 20 * 60_000,
  gifted_sub_ms: 5 * 60_000,
  bits_per_100_ms: 2 * 60_000,
  donation_per_dollar_ms: 1 * 60_000,
  follow_ms: 1 * 60_000,
  follow_enabled: false,
  raid_ms: 5 * 60_000,
  raid_enabled: false,
  custom_rewards: {},
};

export async function getRules(id: string): Promise<TimeRules> {
  const data = await redis().get<TimeRules>(keys(id).settings);
  if (data) return { ...DEFAULT_RULES, ...data };
  return { ...DEFAULT_RULES };
}

export async function saveRules(id: string, rules: Partial<TimeRules>): Promise<TimeRules> {
  const current = await getRules(id);
  const merged = { ...current, ...rules };
  await redis().set(keys(id).settings, merged);
  return merged;
}

export function computeTimeForEvent(
  type: string,
  rules: TimeRules,
  meta: Record<string, unknown> = {}
): number {
  switch (type) {
    case "sub_tier1":
      return rules.tier1_sub_ms;
    case "sub_tier2":
      return rules.tier2_sub_ms;
    case "sub_tier3":
      return rules.tier3_sub_ms;
    case "gifted_sub": {
      const count = (meta.count as number) || 1;
      return rules.gifted_sub_ms * count;
    }
    case "bits": {
      const bits = (meta.bits as number) || 0;
      return Math.floor(bits / 100) * rules.bits_per_100_ms;
    }
    case "donation": {
      const amount = (meta.amount as number) || 0;
      return Math.floor(amount) * rules.donation_per_dollar_ms;
    }
    case "follow":
      return rules.follow_enabled ? rules.follow_ms : 0;
    case "raid":
      return rules.raid_enabled ? rules.raid_ms : 0;
    case "custom_reward": {
      const rewardId = meta.reward_id as string;
      return rules.custom_rewards[rewardId] || 0;
    }
    default:
      return 0;
  }
}
