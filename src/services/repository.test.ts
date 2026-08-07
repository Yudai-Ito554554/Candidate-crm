import { toRepositoryError } from "@/services/repository";

describe("toRepositoryError", () => {
  it.each([
    ["PGRST301", "authentication"],
    ["42501", "authorization"],
    ["23505", "conflict"],
    ["23503", "validation"],
    ["99999", "unknown"],
  ] as const)("maps %s to %s", (code, expectedKind) => {
    expect(
      toRepositoryError({ code, message: "sensitive database detail" }),
    ).toMatchObject({ kind: expectedKind, code });
  });

  it("does not expose raw database error details", () => {
    const error = toRepositoryError({
      code: "99999",
      message: "private row value",
    });

    expect(error.message).not.toContain("private row value");
    expect(error.message).toMatch(/データの取得に失敗/);
  });
});
