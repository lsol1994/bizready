import { TAX_TABLE_2026 } from "./tax-table-2026";

export function getIncomeTax(salary: number, familyCount: number, childCount: number): number {
  if (TAX_TABLE_2026.length === 0) {
    return 0;
  }

  const row = TAX_TABLE_2026.find((r) => salary >= r[0] && salary < r[1]);
  if (!row) {
    return 0;
  }

  const dependents = Math.min(familyCount + childCount, row.length - 3);
  return row[2 + dependents] ?? 0;
}
