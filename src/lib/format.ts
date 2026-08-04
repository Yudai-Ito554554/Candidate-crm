export const mockToday = "2026-08-03";

export function formatDate(date: string) {
  if (!date || date === "-") return "-";
  const [year, month, day] = date.split("-");
  return `${year}/${month}/${day}`;
}

export function formatSalary(min: number, max?: number) {
  return max ? `${min}〜${max}万円` : `${min}万円`;
}

export function isOverdue(date: string, completed = false) {
  return !completed && date < mockToday;
}
