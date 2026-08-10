import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EnvironmentBadge } from "@/components/common/environment-badge";

describe("EnvironmentBadge", () => {
  it("ステージング環境では明示する", () => {
    render(<EnvironmentBadge environmentName="staging" />);

    expect(screen.getByLabelText("ステージング環境")).toHaveTextContent(
      "STAGING",
    );
  });

  it("本番環境では表示しない", () => {
    const { container } = render(
      <EnvironmentBadge environmentName="production" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
