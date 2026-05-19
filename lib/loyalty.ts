export type LoyaltyTier = {
  name: "Aucun" | "Bronze" | "Argent" | "Or";
  color: "neutral" | "terracotta" | "sand" | "amber";
  threshold: number;
};

export function computeLoyaltyPoints(reservations: { total_amount_mad: number; status: string }[]): number {
  const totalSpent = reservations
    .filter((r) => r.status === "paid" || r.status === "completed")
    .reduce((sum, r) => sum + Number(r.total_amount_mad), 0);
  return Math.floor(totalSpent / 100);
}

export function getLoyaltyTier(points: number): LoyaltyTier {
  if (points >= 50) return { name: "Or", color: "amber", threshold: 50 };
  if (points >= 20) return { name: "Argent", color: "sand", threshold: 20 };
  if (points >= 5) return { name: "Bronze", color: "terracotta", threshold: 5 };
  return { name: "Aucun", color: "neutral", threshold: 0 };
}

export function getNextTier(points: number): { name: string; pointsNeeded: number } | null {
  if (points < 5) return { name: "Bronze", pointsNeeded: 5 - points };
  if (points < 20) return { name: "Argent", pointsNeeded: 20 - points };
  if (points < 50) return { name: "Or", pointsNeeded: 50 - points };
  return null;
}
