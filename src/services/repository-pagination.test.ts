const repositoryMocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: repositoryMocks.getSupabaseClient,
}));

import { executePaginatedSelect } from "@/services/repository";

describe("executePaginatedSelect", () => {
  beforeEach(() => {
    repositoryMocks.getSupabaseClient.mockResolvedValue({});
  });

  it("requests consecutive ranges until the final partial page", async () => {
    const operation = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], error: null })
      .mockResolvedValueOnce({ data: [{ id: 3 }], error: null });

    const result = await executePaginatedSelect<{ id: number }>(operation, 2);

    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      error: null,
    });
    expect(operation).toHaveBeenNthCalledWith(1, {}, 0, 1);
    expect(operation).toHaveBeenNthCalledWith(2, {}, 2, 3);
  });
});
