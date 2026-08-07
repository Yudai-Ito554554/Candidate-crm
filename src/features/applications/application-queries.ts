import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveApplication,
  createApplication,
  listApplicationStatusHistory,
  listApplications,
  updateApplication,
} from "@/services/applications-repository";
import {
  archiveCompany,
  archiveCompanyContact,
  createCompany,
  createCompanyContact,
  listArchivedCompanies,
  listCompanies,
  listCompanyContacts,
  restoreCompany,
  updateCompany,
  updateCompanyContact,
} from "@/services/companies-repository";
import {
  archiveJob,
  createJob,
  listArchivedJobs,
  listJobs,
  restoreJob,
  updateJob,
} from "@/services/jobs-repository";
import type {
  ApplicationInsert,
  ApplicationRow,
  ApplicationStatusHistoryRow,
  ApplicationUpdate,
  CompanyContactInsert,
  CompanyContactRow,
  CompanyContactUpdate,
  CompanyInsert,
  CompanyRow,
  CompanyUpdate,
  JobInsert,
  JobRow,
  JobUpdate,
} from "@/types/database";

export const applicationQueryKeys = {
  all: ["applications"] as const,
  statusHistory: ["application-status-history"] as const,
  jobs: ["jobs"] as const,
  archivedJobs: ["jobs", "archived"] as const,
  companies: ["companies"] as const,
  archivedCompanies: ["companies", "archived"] as const,
  contacts: (companyId: string) =>
    ["companies", companyId, "contacts"] as const,
};

async function unwrap<T>(
  promise: Promise<
    { data: T; error: null } | { data: null; error: { message: string } }
  >,
): Promise<T> {
  const result = await promise;
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("データを確認できませんでした。");
  return result.data;
}

export function useApplicationsDataQuery() {
  return useQuery({
    queryKey: applicationQueryKeys.all,
    queryFn: () => unwrap<ApplicationRow[]>(listApplications()),
  });
}

export function useApplicationStatusHistoryQuery() {
  return useQuery({
    queryKey: applicationQueryKeys.statusHistory,
    queryFn: () =>
      unwrap<ApplicationStatusHistoryRow[]>(listApplicationStatusHistory()),
  });
}

export function useJobsQuery() {
  return useQuery({
    queryKey: applicationQueryKeys.jobs,
    queryFn: () => unwrap<JobRow[]>(listJobs()),
  });
}

export function useArchivedJobsQuery() {
  return useQuery({
    queryKey: applicationQueryKeys.archivedJobs,
    queryFn: () => unwrap<JobRow[]>(listArchivedJobs()),
  });
}

export function useCompaniesQuery() {
  return useQuery({
    queryKey: applicationQueryKeys.companies,
    queryFn: () => unwrap<CompanyRow[]>(listCompanies()),
  });
}

export function useArchivedCompaniesQuery() {
  return useQuery({
    queryKey: applicationQueryKeys.archivedCompanies,
    queryFn: () => unwrap<CompanyRow[]>(listArchivedCompanies()),
  });
}

export function useCompanyContactsQuery(companyId: string) {
  return useQuery({
    queryKey: applicationQueryKeys.contacts(companyId),
    queryFn: () => unwrap<CompanyContactRow[]>(listCompanyContacts(companyId)),
    enabled: Boolean(companyId),
  });
}

function useInvalidateApplications() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: applicationQueryKeys.all });
    return queryClient.invalidateQueries({
      queryKey: applicationQueryKeys.statusHistory,
    });
  };
}

export function useCreateApplicationMutation() {
  const invalidate = useInvalidateApplications();
  return useMutation<ApplicationRow, Error, ApplicationInsert>({
    mutationFn: (values) => unwrap<ApplicationRow>(createApplication(values)),
    onSuccess: invalidate,
  });
}

export function useUpdateApplicationMutation() {
  const invalidate = useInvalidateApplications();
  return useMutation<
    ApplicationRow,
    Error,
    { applicationId: string; values: ApplicationUpdate }
  >({
    mutationFn: ({ applicationId, values }) =>
      unwrap<ApplicationRow>(updateApplication(applicationId, values)),
    onSuccess: invalidate,
  });
}

export function useArchiveApplicationMutation() {
  const invalidate = useInvalidateApplications();
  return useMutation<ApplicationRow, Error, string>({
    mutationFn: (applicationId) =>
      unwrap<ApplicationRow>(archiveApplication(applicationId)),
    onSuccess: invalidate,
  });
}

export function useCreateCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation<CompanyRow, Error, CompanyInsert>({
    mutationFn: (values) => unwrap<CompanyRow>(createCompany(values)),
    onSuccess: (created) => {
      queryClient.setQueryData<CompanyRow[]>(
        applicationQueryKeys.companies,
        (current = []) =>
          current.some((company) => company.id === created.id)
            ? current
            : [...current, created].sort((left, right) =>
                left.name.localeCompare(right.name, "ja"),
              ),
      );
      return queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.companies,
        refetchType: "none",
      });
    },
  });
}

export function useUpdateCompanyMutation(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation<CompanyRow, Error, CompanyUpdate>({
    mutationFn: (values) =>
      unwrap<CompanyRow>(updateCompany(companyId, values)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.companies,
      }),
  });
}

export function useArchiveCompanyMutation(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation<CompanyRow, Error>({
    mutationFn: () => unwrap<CompanyRow>(archiveCompany(companyId)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.companies,
      }),
  });
}

export function useRestoreCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation<CompanyRow, Error, string>({
    mutationFn: (companyId) => unwrap<CompanyRow>(restoreCompany(companyId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.companies,
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.archivedCompanies,
      });
    },
  });
}

export function useCreateCompanyContactMutation(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation<CompanyContactRow, Error, CompanyContactInsert>({
    mutationFn: (values) =>
      unwrap<CompanyContactRow>(createCompanyContact(values)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.contacts(companyId),
      }),
  });
}

export function useUpdateCompanyContactMutation(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    CompanyContactRow,
    Error,
    { contactId: string; values: CompanyContactUpdate }
  >({
    mutationFn: ({ contactId, values }) =>
      unwrap<CompanyContactRow>(updateCompanyContact(contactId, values)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.contacts(companyId),
      }),
  });
}

export function useArchiveCompanyContactMutation(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation<CompanyContactRow, Error, string>({
    mutationFn: (contactId) =>
      unwrap<CompanyContactRow>(archiveCompanyContact(contactId)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.contacts(companyId),
      }),
  });
}

export function useCreateJobMutation() {
  const queryClient = useQueryClient();
  return useMutation<JobRow, Error, JobInsert>({
    mutationFn: (values) => unwrap<JobRow>(createJob(values)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: applicationQueryKeys.jobs }),
  });
}

export function useUpdateJobMutation(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation<JobRow, Error, JobUpdate>({
    mutationFn: (values) => unwrap<JobRow>(updateJob(jobId, values)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: applicationQueryKeys.jobs }),
  });
}

export function useArchiveJobMutation(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation<JobRow, Error>({
    mutationFn: () => unwrap<JobRow>(archiveJob(jobId)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: applicationQueryKeys.jobs }),
  });
}

export function useRestoreJobMutation() {
  const queryClient = useQueryClient();
  return useMutation<JobRow, Error, string>({
    mutationFn: (jobId) => unwrap<JobRow>(restoreJob(jobId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.jobs,
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.archivedJobs,
      });
    },
  });
}
