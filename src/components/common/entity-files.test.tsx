import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { FileRow } from "@/types/database";

const mocks = vi.hoisted(() => ({
  archiveMutate: vi.fn(),
  uploadMutateAsync: vi.fn().mockResolvedValue(undefined),
}));

const sampleFile: FileRow = {
  id: "file-1",
  owner_id: "11111111-1111-4111-8111-111111111111",
  candidate_id: "candidate-1",
  company_id: null,
  job_id: null,
  application_id: null,
  file_name: "resume.pdf",
  storage_path: "candidate-1/resume.pdf",
  mime_type: "application/pdf",
  file_size: 1024,
  category: "resume",
  archived_at: null,
  created_at: "2026-08-08T00:00:00.000Z",
  updated_at: "2026-08-08T00:00:00.000Z",
};

vi.mock("@/features/auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "11111111-1111-4111-8111-111111111111" },
  }),
}));

vi.mock("@/features/access/editor-only", () => ({
  EditorOnly: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/features/files/file-queries", () => ({
  useEntityFilesQuery: () => ({
    data: [sampleFile],
    isPending: false,
    isError: false,
    error: null,
  }),
  useUploadFileMutation: () => ({
    isPending: false,
    mutateAsync: mocks.uploadMutateAsync,
  }),
  useArchiveFileMutation: () => ({
    isPending: false,
    mutate: mocks.archiveMutate,
  }),
}));

import { EntityFiles } from "@/components/common/entity-files";

describe("EntityFiles archive confirmation", () => {
  beforeEach(() => {
    mocks.archiveMutate.mockClear();
    mocks.uploadMutateAsync.mockClear();
  });

  function renderComponent() {
    return render(<EntityFiles target={{ candidateId: "candidate-1" }} />);
  }

  it("opens a confirmation dialog with an accessible name when archive is clicked", async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(
      screen.getByRole("button", { name: "resume.pdfをアーカイブ" }),
    );

    const dialog = screen.getByRole("dialog", { name: "ファイルの除外確認" });
    expect(dialog).toBeVisible();
  });

  it("does not call the mutation when cancelled", async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(
      screen.getByRole("button", { name: "resume.pdfをアーカイブ" }),
    );
    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(mocks.archiveMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls the mutation once with the target file id when confirmed", async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(
      screen.getByRole("button", { name: "resume.pdfをアーカイブ" }),
    );
    await user.click(screen.getByRole("button", { name: "除外する" }));

    expect(mocks.archiveMutate).toHaveBeenCalledTimes(1);
    expect(mocks.archiveMutate).toHaveBeenCalledWith(
      "file-1",
      expect.anything(),
    );
  });

  it("closes the dialog when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(
      screen.getByRole("button", { name: "resume.pdfをアーカイブ" }),
    );
    expect(screen.getByRole("dialog")).toBeVisible();

    await user.keyboard("{Escape}");

    expect(mocks.archiveMutate).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("focuses the cancel button when the dialog opens", async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(
      screen.getByRole("button", { name: "resume.pdfをアーカイブ" }),
    );

    expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus();
  });
});
