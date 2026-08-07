import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  canWrite: true,
  archiveMutateAsync: vi.fn().mockResolvedValue(undefined),
  createMutateAsync: vi.fn().mockResolvedValue(undefined),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/access/use-access", () => ({
  useAccess: () => ({ canWrite: mocks.canWrite }),
}));

vi.mock("@/features/tags/entity-tag-queries", () => ({
  useSharedTagsQuery: () => ({
    data: [
      {
        id: "tag-1",
        name: "医療機器",
        color: null,
        archived_at: null,
        created_at: "2026-08-06T00:00:00.000Z",
        updated_at: "2026-08-06T00:00:00.000Z",
      },
    ],
    error: null,
    isPending: false,
  }),
  useCreateSharedTagMutation: () => ({
    isPending: false,
    mutateAsync: mocks.createMutateAsync,
  }),
  useArchiveSharedTagMutation: () => ({
    isPending: false,
    mutateAsync: mocks.archiveMutateAsync,
  }),
  useUpdateSharedTagMutation: () => ({
    isPending: false,
    mutateAsync: mocks.mutateAsync,
  }),
}));

import { TagManagementPanel } from "@/components/settings/tag-management-panel";

describe("TagManagementPanel", () => {
  beforeEach(() => {
    mocks.canWrite = true;
    mocks.archiveMutateAsync.mockClear();
    mocks.createMutateAsync.mockClear();
    mocks.mutateAsync.mockClear();
  });

  it("creates a reusable shared tag", async () => {
    const user = userEvent.setup();
    render(<TagManagementPanel />);

    await user.type(screen.getByLabelText("新しいタグ名"), "北海道");
    await user.click(screen.getByRole("button", { name: "タグを作成" }));

    expect(mocks.createMutateAsync).toHaveBeenCalledWith("北海道");
    expect(await screen.findByText("タグを作成しました。")).toBeVisible();
  });

  it("updates a shared tag name", async () => {
    const user = userEvent.setup();
    render(<TagManagementPanel />);

    await user.click(screen.getByRole("button", { name: "医療機器を編集" }));
    const input = screen.getByRole("textbox", {
      name: "医療機器の新しいタグ名",
    });
    await user.clear(input);
    await user.type(input, "循環器");
    await user.click(screen.getByRole("button", { name: "タグ名を保存" }));

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      tagId: "tag-1",
      name: "循環器",
    });
    expect(await screen.findByText("タグ名を更新しました。")).toBeVisible();
  });

  it("archives a tag only after in-page confirmation", async () => {
    const user = userEvent.setup();
    render(<TagManagementPanel />);

    await user.click(
      screen.getByRole("button", { name: "医療機器をアーカイブ" }),
    );
    expect(mocks.archiveMutateAsync).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "アーカイブする" }));

    expect(mocks.archiveMutateAsync).toHaveBeenCalledWith("tag-1");
    expect(
      await screen.findByText("未使用タグをアーカイブしました。"),
    ).toBeVisible();
  });

  it("does not show rename controls to a viewer", () => {
    mocks.canWrite = false;
    render(<TagManagementPanel />);

    expect(screen.getByText("医療機器")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "医療機器を編集" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "タグを作成" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "医療機器をアーカイブ" }),
    ).not.toBeInTheDocument();
  });
});
