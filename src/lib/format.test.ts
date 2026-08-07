import { formatDateTime, isOverdueDate } from "@/lib/format";

describe("formatDateTime", () => {
  it("formats database timestamps without exposing the ISO representation", () => {
    expect(formatDateTime("2026-08-05T09:15:00")).toBe("2026/08/05 09:15");
    expect(formatDateTime("invalid")).toBe("-");
  });
});

describe("isOverdueDate", () => {
  it("treats only dates before today as overdue", () => {
    expect(isOverdueDate("2026-08-05", "2026-08-06")).toBe(true);
    expect(isOverdueDate("2026-08-06", "2026-08-06")).toBe(false);
    expect(isOverdueDate("2026-08-07", "2026-08-06")).toBe(false);
    expect(isOverdueDate("-", "2026-08-06")).toBe(false);
  });
});
