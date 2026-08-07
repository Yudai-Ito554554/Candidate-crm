import {
  executePaginatedSelect,
  executeSelect,
  executeSingle,
  type RepositoryResult,
} from "@/services/repository";
import type {
  CompanyContactInsert,
  CompanyContactRow,
  CompanyContactUpdate,
  CompanyInsert,
  CompanyRow,
  CompanyUpdate,
} from "@/types/database";

export function listCompanies(): Promise<RepositoryResult<CompanyRow[]>> {
  return executePaginatedSelect<CompanyRow>((client, from, to) =>
    client
      .from("companies")
      .select("*")
      .is("archived_at", null)
      .order("name")
      .order("id")
      .range(from, to),
  );
}

export function listArchivedCompanies(): Promise<
  RepositoryResult<CompanyRow[]>
> {
  return executePaginatedSelect<CompanyRow>((client, from, to) =>
    client
      .from("companies")
      .select("*")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

export function listCompanyContacts(
  companyId: string,
): Promise<RepositoryResult<CompanyContactRow[]>> {
  return executeSelect<CompanyContactRow>((client) =>
    client
      .from("company_contacts")
      .select("*")
      .eq("company_id", companyId)
      .is("archived_at", null)
      .order("full_name"),
  );
}

export function createCompany(
  values: CompanyInsert,
): Promise<RepositoryResult<CompanyRow>> {
  return executeSingle<CompanyRow>((client) =>
    client.from("companies").insert(values).select("*").single(),
  );
}

export function updateCompany(
  companyId: string,
  values: CompanyUpdate,
): Promise<RepositoryResult<CompanyRow>> {
  return executeSingle<CompanyRow>((client) =>
    client
      .from("companies")
      .update(values)
      .eq("id", companyId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function archiveCompany(
  companyId: string,
): Promise<RepositoryResult<CompanyRow>> {
  return updateCompany(companyId, { archived_at: new Date().toISOString() });
}

export function restoreCompany(
  companyId: string,
): Promise<RepositoryResult<CompanyRow>> {
  return executeSingle<CompanyRow>((client) =>
    client
      .from("companies")
      .update({ archived_at: null })
      .eq("id", companyId)
      .not("archived_at", "is", null)
      .select("*")
      .single(),
  );
}

export function createCompanyContact(
  values: CompanyContactInsert,
): Promise<RepositoryResult<CompanyContactRow>> {
  return executeSingle<CompanyContactRow>((client) =>
    client.from("company_contacts").insert(values).select("*").single(),
  );
}

export function updateCompanyContact(
  contactId: string,
  values: CompanyContactUpdate,
): Promise<RepositoryResult<CompanyContactRow>> {
  return executeSingle<CompanyContactRow>((client) =>
    client
      .from("company_contacts")
      .update(values)
      .eq("id", contactId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function archiveCompanyContact(
  contactId: string,
): Promise<RepositoryResult<CompanyContactRow>> {
  return updateCompanyContact(contactId, {
    archived_at: new Date().toISOString(),
  });
}
