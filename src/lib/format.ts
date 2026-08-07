export function getLocalDateString(date = new Date()) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 10);
}

export function formatDate(date: string) {
  if (!date || date === "-") return "-";
  const [year, month, day] = date.split("-");
  return `${year}/${month}/${day}`;
}

export function formatDateTime(value: string) {
  if (!value || value === "-") return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function isOverdueDate(
  date: string,
  today = getLocalDateString(),
): boolean {
  return date !== "-" && date < today;
}

export function formatSalary(min: number, max?: number) {
  return max ? `${min}〜${max}万円` : `${min}万円`;
}
