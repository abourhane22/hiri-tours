export type PnLData = {
  period: { start: string; end: string; label: string };
  revenue: number;
  reservationCount: number;
  directCosts: number;
  overheadCosts: number;
  totalCosts: number;
  grossMargin: number;
  netMargin: number;
  grossMarginRate: number;
  netMarginRate: number;
  expensesByCategory: { categoryId: string; categoryName: string; type: "direct" | "overhead"; amount: number }[];
};

export type CircuitProfitability = {
  circuitId: string;
  circuitTitle: string;
  revenue: number;
  reservationCount: number;
  directCosts: number;
  margin: number;
  marginRate: number;
};

export function computePnL(opts: {
  expenses: any[];
  reservations: any[];
  categories: any[];
  start: string;
  end: string;
  label: string;
}): PnLData {
  const { expenses, reservations, categories, start, end, label } = opts;

  const paidInPeriod = reservations.filter((r) =>
    (r.status === "paid" || r.status === "completed") &&
    r.departure_date >= start && r.departure_date <= end
  );
  const revenue = paidInPeriod.reduce((s, r) => s + Number(r.total_amount_mad || 0), 0);

  const periodExpenses = expenses.filter((e) => e.expense_date >= start && e.expense_date <= end);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  let directCosts = 0;
  let overheadCosts = 0;
  const byCategory: Record<string, { categoryId: string; categoryName: string; type: "direct" | "overhead"; amount: number }> = {};

  for (const e of periodExpenses) {
    const cat = categoryMap.get(e.category_id) as any;
    if (!cat) continue;
    const amt = Number(e.amount_mad);
    if (cat.type === "direct") directCosts += amt;
    else overheadCosts += amt;

    if (!byCategory[cat.id]) {
      byCategory[cat.id] = { categoryId: cat.id, categoryName: cat.name, type: cat.type, amount: 0 };
    }
    byCategory[cat.id].amount += amt;
  }

  const totalCosts = directCosts + overheadCosts;
  const grossMargin = revenue - directCosts;
  const netMargin = revenue - totalCosts;

  return {
    period: { start, end, label },
    revenue,
    reservationCount: paidInPeriod.length,
    directCosts,
    overheadCosts,
    totalCosts,
    grossMargin,
    netMargin,
    grossMarginRate: revenue > 0 ? (grossMargin / revenue) * 100 : 0,
    netMarginRate: revenue > 0 ? (netMargin / revenue) * 100 : 0,
    expensesByCategory: Object.values(byCategory).sort((a, b) => b.amount - a.amount),
  };
}

export function computeCircuitProfitability(opts: {
  reservations: any[];
  expenses: any[];
  circuits: any[];
  start?: string;
  end?: string;
}): CircuitProfitability[] {
  const { reservations, expenses, circuits, start, end } = opts;

  const inRange = (date: string) => (!start || date >= start) && (!end || date <= end);

  return circuits
    .map((c) => {
      const cReservations = reservations.filter((r) =>
        r.circuit_id === c.id &&
        (r.status === "paid" || r.status === "completed") &&
        inRange(r.departure_date)
      );
      const revenue = cReservations.reduce((s, r) => s + Number(r.total_amount_mad || 0), 0);

      const reservationIds = cReservations.map((r) => r.id);
      const directCosts = expenses
        .filter((e) => (e.circuit_id === c.id || (e.reservation_id && reservationIds.includes(e.reservation_id))) && inRange(e.expense_date))
        .reduce((s, e) => s + Number(e.amount_mad), 0);

      const margin = revenue - directCosts;
      const marginRate = revenue > 0 ? (margin / revenue) * 100 : 0;

      return {
        circuitId: c.id,
        circuitTitle: c.title,
        revenue,
        reservationCount: cReservations.length,
        directCosts,
        margin,
        marginRate,
      };
    })
    .filter((c) => c.revenue > 0 || c.directCosts > 0)
    .sort((a, b) => b.margin - a.margin);
}

export function getMonthRange(monthStr?: string): { start: string; end: string; label: string } {
  const now = new Date();
  const [y, m] = monthStr ? monthStr.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    label: `${months[m - 1]} ${y}`,
  };
}
