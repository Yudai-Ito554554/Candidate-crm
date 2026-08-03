import { createBrowserRouter } from "react-router-dom";

import { SetupPage } from "@/pages/setup-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <SetupPage />,
  },
]);
