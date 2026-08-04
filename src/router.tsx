import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { AuthGate } from "@/components/auth/auth-gate";
import { CandidatesPage } from "@/pages/candidates-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { JobsPage } from "@/pages/jobs-page";
import { LoginPage } from "@/pages/login-page";
import { PipelinePage } from "@/pages/pipeline-page";

const routeLoadingElement = (
  <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
    画面を読み込んでいます…
  </main>
);

export const appRoutes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <AuthGate />,
    hydrateFallbackElement: routeLoadingElement,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "candidates", element: <CandidatesPage /> },
      {
        path: "candidates/:candidateId",
        lazy: async () => ({
          Component: (await import("@/pages/candidate-detail-page"))
            .CandidateDetailPage,
        }),
      },
      { path: "jobs", element: <JobsPage /> },
      {
        path: "jobs/:jobId",
        lazy: async () => ({
          Component: (await import("@/pages/job-detail-page")).JobDetailPage,
        }),
      },
      {
        path: "inbox",
        lazy: async () => ({
          Component: (await import("@/pages/inbox-page")).InboxPage,
        }),
      },
      {
        path: "today",
        lazy: async () => ({
          Component: (await import("@/pages/today-page")).TodayPage,
        }),
      },
      {
        path: "reports",
        lazy: async () => ({
          Component: (await import("@/pages/reports-page")).ReportsPage,
        }),
      },
      // Phase 2 compatibility alias. The pipeline is now switched from /candidates.
      { path: "pipeline", element: <PipelinePage /> },
      {
        path: "tasks",
        lazy: async () => ({
          Component: (await import("@/pages/tasks-page")).TasksPage,
        }),
      },
      {
        path: "settings",
        lazy: async () => ({
          Component: (await import("@/pages/settings-page")).SettingsPage,
        }),
      },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
