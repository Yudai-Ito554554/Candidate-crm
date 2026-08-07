import { tagNameSchema } from "@/features/tags/tag-management-model";

describe("tagNameSchema", () => {
  it("trims and accepts a practical tag name", () => {
    expect(tagNameSchema.parse("  医療機器  ")).toBe("医療機器");
  });

  it("rejects empty and overly long names", () => {
    expect(tagNameSchema.safeParse("  ").success).toBe(false);
    expect(tagNameSchema.safeParse("あ".repeat(41)).success).toBe(false);
  });
});
