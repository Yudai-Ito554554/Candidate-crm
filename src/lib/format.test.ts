import { isOverdueDate } from "@/lib/format";

describe("isOverdueDate", () => {
  it("treats only dates before today as overdue", () => {
    expect(isOverdueDate("2026-08-05", "2026-08-06")).toBe(true);
    expect(isOverdueDate("2026-08-06", "2026-08-06")).toBe(false);
    expect(isOverdueDate("2026-08-07", "2026-08-06")).toBe(false);
    expect(isOverdueDate("-", "2026-08-06")).toBe(false);
  });
});
