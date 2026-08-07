import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";

import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";

function Editor() {
  const [dirty, setDirty] = useState(false);
  const bypassRef = useRef(false);
  return (
    <div>
      <UnsavedChangesGuard bypassRef={bypassRef} when={dirty} />
      <label>
        企業名
        <input onChange={() => setDirty(true)} />
      </label>
      <Link to="/done">一覧へ戻る</Link>
    </div>
  );
}

function renderGuard() {
  const router = createMemoryRouter(
    [
      { path: "/edit", element: <Editor /> },
      { path: "/done", element: <h1>移動先</h1> },
    ],
    { initialEntries: ["/edit"] },
  );
  render(<RouterProvider router={router} />);
}

describe("UnsavedChangesGuard", () => {
  it("未保存の変更がある場合は画面遷移前に確認する", async () => {
    const user = userEvent.setup();
    renderGuard();

    await user.type(screen.getByRole("textbox", { name: "企業名" }), "医療");
    await user.click(screen.getByRole("link", { name: "一覧へ戻る" }));

    expect(
      screen.getByRole("dialog", { name: "入力途中の内容があります" }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "移動先" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "編集を続ける" }));
    expect(screen.getByRole("textbox", { name: "企業名" })).toHaveValue("医療");

    await user.click(screen.getByRole("link", { name: "一覧へ戻る" }));
    await user.click(screen.getByRole("button", { name: "保存せず移動" }));
    expect(
      await screen.findByRole("heading", { name: "移動先" }),
    ).toBeVisible();
  });
});
