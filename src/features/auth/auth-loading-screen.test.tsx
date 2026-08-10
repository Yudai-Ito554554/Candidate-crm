import { render, screen } from "@testing-library/react";

import { AuthLoadingScreen } from "@/features/auth/auth-loading-screen";

describe("AuthLoadingScreen", () => {
  it("stagingではSTAGINGバッジを表示する", () => {
    render(<AuthLoadingScreen environmentName="staging" />);

    expect(screen.getByText("STAGING")).toBeVisible();
  });

  it("productionではSTAGINGバッジを表示しない", () => {
    render(<AuthLoadingScreen environmentName="production" />);

    expect(screen.queryByText("STAGING")).not.toBeInTheDocument();
  });
});
