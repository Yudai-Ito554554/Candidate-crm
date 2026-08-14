import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { AppLayout } from "@/components/layout/app-layout";
import { EditorRoute } from "@/features/access/editor-route";
import { ProtectedRoute } from "@/features/auth/protected-route";
import { LoginPage } from "@/pages/login-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { RouteErrorPage } from "@/pages/route-error-page";

const routeLoadingElement = (
  <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
    画面を読み込んでいます…
  </main>
);

export const appRoutes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/forgot-password",
    lazy: async () => ({
      Component: (await import("@/pages/forgot-password-page"))
        .ForgotPasswordPage,
    }),
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: routeLoadingElement,
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: routeLoadingElement,
    children: [
      {
        path: "/set-password",
        lazy: async () => ({
          Component: (await import("@/pages/set-password-page"))
            .SetPasswordPage,
        }),
      },
      {
        path: "/",
        element: <AppLayout />,
        errorElement: <RouteErrorPage />,
        hydrateFallbackElement: routeLoadingElement,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import("@/pages/dashboard-page")).DashboardPage,
            }),
          },
          {
            path: "candidates",
            lazy: async () => ({
              Component: (await import("@/pages/candidates-page"))
                .CandidatesPage,
            }),
          },
          {
            path: "candidates/:candidateId",
            lazy: async () => ({
              Component: (await import("@/pages/candidate-detail-page"))
                .CandidateDetailPage,
            }),
          },
          {
            path: "jobs",
            lazy: async () => ({
              Component: (await import("@/pages/jobs-page")).JobsPage,
            }),
          },
          {
            path: "jobs/:jobId",
            lazy: async () => ({
              Component: (await import("@/pages/job-detail-page"))
                .JobDetailPage,
            }),
          },
          {
            path: "companies",
            lazy: async () => ({
              Component: (await import("@/pages/companies-page")).CompaniesPage,
            }),
          },
          {
            path: "companies/:companyId",
            lazy: async () => ({
              Component: (await import("@/pages/company-detail-page"))
                .CompanyDetailPage,
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
          {
            path: "pipeline",
            lazy: async () => ({
              Component: (await import("@/pages/pipeline-page")).PipelinePage,
            }),
          },
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
          {
            element: <EditorRoute />,
            children: [
              {
                path: "candidates/new",
                lazy: async () => ({
                  Component: (await import("@/pages/candidate-form-page"))
                    .CandidateFormPage,
                }),
              },
              {
                path: "candidates/import",
                lazy: async () => ({
                  Component: (await import("@/pages/candidate-import-page"))
                    .CandidateImportPage,
                }),
              },
              {
                path: "candidates/:candidateId/edit",
                lazy: async () => ({
                  Component: (await import("@/pages/candidate-form-page"))
                    .CandidateFormPage,
                }),
              },
              {
                path: "jobs/new",
                lazy: async () => ({
                  Component: (await import("@/pages/job-form-page"))
                    .JobFormPage,
                }),
              },
              {
                path: "jobs/:jobId/edit",
                lazy: async () => ({
                  Component: (await import("@/pages/job-form-page"))
                    .JobFormPage,
                }),
              },
              {
                path: "companies/new",
                lazy: async () => ({
                  Component: (await import("@/pages/company-form-page"))
                    .CompanyFormPage,
                }),
              },
              {
                path: "companies/:companyId/edit",
                lazy: async () => ({
                  Component: (await import("@/pages/company-form-page"))
                    .CompanyFormPage,
                }),
              },
            ],
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
