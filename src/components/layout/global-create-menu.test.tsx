import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { GlobalCreateMenu } from "@/components/layout/global-create-menu";

describe("GlobalCreateMenu", () => {
  it("候補者・企業・求人の登録先を表示する", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GlobalCreateMenu />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: "新規登録" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("menu", { name: "新規登録メニュー" }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: /候補者を登録/ }),
    ).toHaveAttribute("href", "/candidates/new");
    expect(
      screen.getByRole("menuitem", { name: /企業を登録/ }),
    ).toHaveAttribute("href", "/companies/new");
    expect(
      screen.getByRole("menuitem", { name: /求人を登録/ }),
    ).toHaveAttribute("href", "/jobs/new");
  });

  it("Escapeキーでメニューを閉じる", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GlobalCreateMenu />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: "新規登録" });
    await user.click(button);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});
