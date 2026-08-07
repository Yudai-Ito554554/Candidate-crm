import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArrowLeft, Building2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { SectionCard } from "@/components/common/section-card";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { jobStatusLabels } from "@/features/applications/application-model";
import {
  companyWebsiteSchema,
  findCompanyDuplicates,
  quickCompanyFormSchema,
} from "@/features/applications/company-form-model";
import { JobImportPanel } from "@/features/applications/job-import-panel";
import {
  resolveJobImportCompanyMatch,
  toImportedCompanyDraft,
  toJobImportFormPatch,
  type ImportedCompanyDraft,
} from "@/features/applications/job-import-model";
import {
  findJobDuplicates,
  jobFormSchema,
  toJobFormValues,
  toJobValues,
  type JobDuplicateMatch,
  type JobFormValues,
} from "@/features/applications/job-form-model";
import {
  useApplicationsDataQuery,
  useArchiveJobMutation,
  useCompaniesQuery,
  useCompanyContactsQuery,
  useCreateCompanyMutation,
  useCreateJobMutation,
  useJobsQuery,
  useUpdateJobMutation,
} from "@/features/applications/application-queries";
import { useAuth } from "@/features/auth/use-auth";
import type { CompanyRow } from "@/types/database";

export function JobFormPage() {
  const { jobId = "" } = useParams();
  const isEditing = Boolean(jobId);
  const navigate = useNavigate();
  const auth = useAuth();
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const applicationsQuery = useApplicationsDataQuery();
  const job = (jobsQuery.data ?? []).find((item) => item.id === jobId);
  const createMutation = useCreateJobMutation();
  const createCompanyMutation = useCreateCompanyMutation();
  const updateMutation = useUpdateJobMutation(jobId);
  const archiveMutation = useArchiveJobMutation(jobId);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const navigationBypass = useRef(false);
  const [duplicateMatches, setDuplicateMatches] = useState<JobDuplicateMatch[]>(
    [],
  );
  const [pendingValues, setPendingValues] = useState<JobFormValues | null>(
    null,
  );
  const [duplicateCheckError, setDuplicateCheckError] = useState<string | null>(
    null,
  );
  const [importedCompanyDraft, setImportedCompanyDraft] =
    useState<ImportedCompanyDraft | null>(null);
  const [companyCreationMessage, setCompanyCreationMessage] = useState<
    string | null
  >(null);
  const [inlineCreatedCompany, setInlineCreatedCompany] =
    useState<CompanyRow | null>(null);
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    values: toJobFormValues(job),
  });
  const companies =
    inlineCreatedCompany &&
    !(companiesQuery.data ?? []).some(
      (company) => company.id === inlineCreatedCompany.id,
    )
      ? [...(companiesQuery.data ?? []), inlineCreatedCompany].sort(
          (left, right) => left.name.localeCompare(right.name, "ja"),
        )
      : (companiesQuery.data ?? []);
  const companyId = useWatch({ control: form.control, name: "company_id" });
  const importedCompanyValidation = importedCompanyDraft
    ? quickCompanyFormSchema.safeParse(importedCompanyDraft)
    : null;
  const importedCompanyDuplicateMatches = importedCompanyDraft
    ? findCompanyDuplicates(
        {
          name: importedCompanyDraft.name,
          website: companyWebsiteSchema.safeParse(importedCompanyDraft.website)
            .success
            ? importedCompanyDraft.website
            : "",
        },
        companies,
      )
    : [];
  const companyField = form.register("company_id");
  const contactsQuery = useCompanyContactsQuery(companyId);
  const relatedApplications = (applicationsQuery.data ?? []).filter(
    (application) => application.job_id === jobId,
  );
  const mutation = job ? updateMutation : createMutation;
  const createJob = async (formValues: JobFormValues) => {
    navigationBypass.current = true;
    try {
      const created = await createMutation.mutateAsync({
        ...toJobValues(formValues),
        owner_id: auth.user?.id ?? null,
      });
      void navigate(`/jobs/${created.id}`, { replace: true });
    } catch {
      navigationBypass.current = false;
    }
  };
  const submit = async (formValues: JobFormValues) => {
    const writeValues = toJobValues(formValues);
    if (job) {
      navigationBypass.current = true;
      try {
        const updated = await updateMutation.mutateAsync(writeValues);
        void navigate(`/jobs/${updated.id}`);
      } catch {
        navigationBypass.current = false;
      }
      return;
    }

    if (jobsQuery.isError) {
      setDuplicateCheckError(
        "既存求人との重複を確認できませんでした。再読み込みしてから登録してください。",
      );
      return;
    }
    const matches = findJobDuplicates(formValues, jobsQuery.data ?? []);
    if (matches.length) {
      setDuplicateMatches(matches);
      setPendingValues(formValues);
      setDuplicateCheckError(null);
      return;
    }
    await createJob(formValues);
  };
  const clearDuplicateWarning = () => {
    setDuplicateMatches([]);
    setPendingValues(null);
    setDuplicateCheckError(null);
  };
  const selectExistingImportedCompany = (company: CompanyRow) => {
    form.setValue("company_id", company.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("contact_id", "");
    setImportedCompanyDraft(null);
    setDuplicateCheckError(null);
    createCompanyMutation.reset();
    setCompanyCreationMessage(
      `登録済み企業「${company.name}」を企業欄へ選択しました。`,
    );
    form.setFocus("title");
  };
  const createAndSelectImportedCompany = async () => {
    if (!importedCompanyDraft) return;
    const parsedDraft = quickCompanyFormSchema.safeParse(importedCompanyDraft);
    if (!parsedDraft.success) return;
    if (!companiesQuery.isSuccess) {
      setDuplicateCheckError(
        "既存企業との重複を確認できませんでした。再読み込みしてから登録してください。",
      );
      return;
    }

    const duplicateCompanies = findCompanyDuplicates(
      parsedDraft.data,
      companiesQuery.data,
    );
    if (duplicateCompanies.length > 1) {
      setDuplicateCheckError(
        "企業名とWebサイトが異なる登録済み企業に一致しました。内容を確認し、既存企業から選択してください。",
      );
      return;
    }
    const existing = duplicateCompanies[0]?.company;
    if (existing) {
      selectExistingImportedCompany(existing);
      return;
    }

    try {
      const created = await createCompanyMutation.mutateAsync({
        name: parsedDraft.data.name,
        industry: parsedDraft.data.industry || null,
        website: parsedDraft.data.website || null,
      });
      setInlineCreatedCompany(created);
      form.setValue("company_id", created.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("contact_id", "");
      setImportedCompanyDraft(null);
      setDuplicateCheckError(null);
      setCompanyCreationMessage(
        `企業「${created.name}」を登録し、求人の企業欄へ選択しました。企業の詳細情報は後から企業画面で追加できます。`,
      );
      form.setFocus("title");
    } catch {
      setCompanyCreationMessage(null);
    }
  };
  const performArchive = async () => {
    navigationBypass.current = true;
    try {
      await archiveMutation.mutateAsync();
      void navigate("/jobs");
    } catch {
      navigationBypass.current = false;
    }
  };

  if (isEditing && jobsQuery.isPending)
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        求人を読み込んでいます…
      </p>
    );
  if (isEditing && !job) return <EmptyState message="求人が見つかりません" />;
  return (
    <div>
      <UnsavedChangesGuard
        bypassRef={navigationBypass}
        when={form.formState.isDirty}
      />
      <Link
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"
        to={job ? `/jobs/${job.id}` : "/jobs"}
      >
        <ArrowLeft className="size-3.5" />
        {job ? "求人詳細へ戻る" : "求人一覧へ戻る"}
      </Link>
      <PageIntro
        action={
          job ? (
            confirmArchive ? (
              <div className="flex gap-2">
                <Button
                  disabled={
                    archiveMutation.isPending || relatedApplications.length > 0
                  }
                  onClick={() => void performArchive()}
                  size="sm"
                >
                  実行
                </Button>
                <Button
                  onClick={() => setConfirmArchive(false)}
                  size="sm"
                  variant="outline"
                >
                  戻る
                </Button>
              </div>
            ) : (
              <Button
                className="gap-1.5 text-rose-700"
                onClick={() => setConfirmArchive(true)}
                size="sm"
                variant="outline"
              >
                <Archive className="size-4" />
                アーカイブ
              </Button>
            )
          ) : null
        }
        description="企業、採用担当者、募集条件と社内情報を管理します。"
        title={job ? `${job.title}を編集` : "新規求人登録"}
      />
      {confirmArchive && relatedApplications.length > 0 ? (
        <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          選考が{relatedApplications.length}
          件あるためアーカイブできません。募集状況を「充足」に変更してください。
        </p>
      ) : null}
      {!isEditing && duplicateMatches.length ? (
        <section
          aria-label="重複求人の確認"
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4"
          role="alert"
        >
          <h2 className="text-sm font-semibold text-amber-950">
            同じ企業に一致する求人があります
          </h2>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            別ポジションや再募集であることを確認してから登録を続けてください。
          </p>
          <ul className="mt-3 space-y-2">
            {duplicateMatches.map(({ job: match, matchedFields }) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-white px-3 py-2"
                key={match.id}
              >
                <span className="text-sm text-slate-800">
                  {match.title}（一致：{matchedFields.join("・")}）
                </span>
                <Link
                  className="text-xs font-medium text-blue-700 hover:underline"
                  target="_blank"
                  to={`/jobs/${match.id}`}
                >
                  既存求人を確認
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={clearDuplicateWarning} size="sm" variant="outline">
              入力内容を見直す
            </Button>
            <Button
              disabled={!pendingValues || createMutation.isPending}
              onClick={() => {
                if (pendingValues) void createJob(pendingValues);
              }}
              size="sm"
            >
              別求人であることを確認して登録
            </Button>
          </div>
        </section>
      ) : null}
      {duplicateCheckError ? (
        <p
          className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          role="alert"
        >
          {duplicateCheckError}
        </p>
      ) : null}
      {!isEditing ? (
        <JobImportPanel
          companies={companies}
          getCurrentValues={() => form.getValues()}
          onApply={(result, selectedFields, resolvedCompanyId) => {
            createCompanyMutation.reset();
            setCompanyCreationMessage(null);
            const patch = resolveJobImportCompanyMatch(
              toJobImportFormPatch(result, companies),
              resolvedCompanyId ?? null,
            );
            for (const [field, value] of Object.entries(patch.values)) {
              if (!selectedFields.includes(field as keyof JobFormValues))
                continue;
              form.setValue(field as keyof JobFormValues, value, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }
            const firstAppliedField = selectedFields.find(
              (field) => patch.values[field] !== undefined,
            );
            const valuesAfterApply = form.getValues();
            const firstMissingRequiredField: keyof JobFormValues | undefined =
              !valuesAfterApply.company_id
                ? "company_id"
                : !valuesAfterApply.title.trim()
                  ? "title"
                  : undefined;
            const focusTarget = firstMissingRequiredField ?? firstAppliedField;
            if (focusTarget) form.setFocus(focusTarget);
            if (result.company_name && !patch.matchedCompany) {
              setImportedCompanyDraft(toImportedCompanyDraft(result));
              setDuplicateCheckError(null);
            } else {
              setImportedCompanyDraft(null);
              setDuplicateCheckError(null);
            }
          }}
        />
      ) : null}
      {importedCompanyDraft !== null ? (
        <section
          aria-label="AIで取得した未登録企業"
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4"
        >
          <p className="text-sm font-semibold text-amber-950">
            AIで取得した企業は未登録です
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            企業名・業種・Webサイトを確認、修正してから登録できます。AIは求人票に明記された情報だけを候補化します。
          </p>
          <div className="mt-3 grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1.2fr)_minmax(10rem,0.8fr)_minmax(15rem,1fr)]">
            <label className="text-xs font-medium text-amber-950">
              登録する企業名
              <Input
                className="mt-1 bg-white"
                onChange={(event) => {
                  setImportedCompanyDraft((current) =>
                    current ? { ...current, name: event.target.value } : null,
                  );
                  setDuplicateCheckError(null);
                  createCompanyMutation.reset();
                }}
                value={importedCompanyDraft.name}
              />
            </label>
            <label className="text-xs font-medium text-amber-950">
              業種（任意）
              <Input
                className="mt-1 bg-white"
                onChange={(event) => {
                  setImportedCompanyDraft((current) =>
                    current
                      ? { ...current, industry: event.target.value }
                      : null,
                  );
                  setDuplicateCheckError(null);
                  createCompanyMutation.reset();
                }}
                value={importedCompanyDraft.industry}
              />
            </label>
            <label className="text-xs font-medium text-amber-950">
              Webサイト（任意）
              <Input
                className="mt-1 bg-white"
                inputMode="url"
                onChange={(event) => {
                  setImportedCompanyDraft((current) =>
                    current
                      ? { ...current, website: event.target.value }
                      : null,
                  );
                  setDuplicateCheckError(null);
                  createCompanyMutation.reset();
                }}
                placeholder="https://example.com"
                value={importedCompanyDraft.website}
              />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-3">
              <Button
                onClick={() => {
                  setImportedCompanyDraft(null);
                  createCompanyMutation.reset();
                  form.setFocus("company_id");
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                既存企業から選ぶ
              </Button>
              <Button
                disabled={
                  !importedCompanyValidation?.success ||
                  companiesQuery.isPending ||
                  companiesQuery.isError ||
                  importedCompanyDuplicateMatches.length > 0 ||
                  createCompanyMutation.isPending
                }
                onClick={() => void createAndSelectImportedCompany()}
                size="sm"
                type="button"
              >
                <Building2 className="mr-1.5 size-4" />
                この企業を登録して選択
              </Button>
            </div>
          </div>
          {importedCompanyValidation?.success === false ? (
            <p className="mt-2 text-xs text-rose-700" role="alert">
              {importedCompanyValidation.error.issues[0]?.message}
            </p>
          ) : null}
          {importedCompanyDuplicateMatches.length ? (
            <div className="mt-3 rounded-md border border-amber-300 bg-white p-3">
              <p className="text-xs font-semibold text-amber-950">
                登録済み企業の候補
              </p>
              <p className="mt-1 text-xs text-amber-900">
                一致理由を確認し、正しい企業を選択してください。新しい企業は作成されません。
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {importedCompanyDuplicateMatches.map((match) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-2"
                    key={match.company.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {match.company.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {match.matchedFields.join("・")}一致
                      </p>
                    </div>
                    <Button
                      aria-label={`登録済み企業「${match.company.name}」を選択`}
                      onClick={() =>
                        selectExistingImportedCompany(match.company)
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      この企業を選択
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {companiesQuery.isError ? (
            <p className="mt-2 text-xs text-rose-700">
              既存企業を確認できないため登録できません。再読み込みしてください。
            </p>
          ) : null}
          {createCompanyMutation.error ? (
            <p className="mt-2 text-xs text-rose-700" role="alert">
              {createCompanyMutation.error.message}
            </p>
          ) : null}
        </section>
      ) : null}
      {companyCreationMessage ? (
        <p
          className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {companyCreationMessage}
        </p>
      ) : null}
      <SectionCard title="求人情報">
        <form
          onChange={clearDuplicateWarning}
          onSubmit={(event) => void form.handleSubmit(submit)(event)}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">
              企業 *
              <Select
                className="w-full"
                {...companyField}
                onChange={(event) => {
                  void companyField.onChange(event);
                  form.setValue("contact_id", "");
                  setImportedCompanyDraft(null);
                  setCompanyCreationMessage(null);
                }}
                value={companyId}
              >
                <option value="">企業を選択</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
              {form.formState.errors.company_id ? (
                <span className="text-rose-700">
                  {form.formState.errors.company_id.message}
                </span>
              ) : null}
            </label>
            <label className="text-xs font-medium text-slate-600">
              採用担当者
              <Select
                className="w-full"
                disabled={!companyId || contactsQuery.isPending}
                {...form.register("contact_id")}
              >
                <option value="">未設定</option>
                {(contactsQuery.data ?? []).map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.full_name ?? "氏名未登録"}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-xs font-medium text-slate-600 md:col-span-2">
              求人名 *<Input {...form.register("title")} />
              {form.formState.errors.title ? (
                <span className="text-rose-700">
                  {form.formState.errors.title.message}
                </span>
              ) : null}
            </label>
            <label className="text-xs font-medium text-slate-600">
              事業部
              <Input {...form.register("division")} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              職種
              <Input {...form.register("occupation")} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              雇用形態
              <Input {...form.register("employment_type")} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              勤務地（読点区切り）
              <Input {...form.register("locations")} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              年収下限（万円）
              <Input inputMode="numeric" {...form.register("salary_min")} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              年収上限（万円）
              <Input inputMode="numeric" {...form.register("salary_max")} />
              {form.formState.errors.salary_max ? (
                <span className="text-rose-700">
                  {form.formState.errors.salary_max.message}
                </span>
              ) : null}
            </label>
            <label className="text-xs font-medium text-slate-600">
              募集状況
              <Select className="w-full" {...form.register("job_status")}>
                {Object.entries(jobStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              募集開始日
              <Input type="date" {...form.register("opened_at")} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              募集終了日
              <Input type="date" {...form.register("closed_at")} />
              {form.formState.errors.closed_at ? (
                <span className="text-rose-700">
                  {form.formState.errors.closed_at.message}
                </span>
              ) : null}
            </label>
            <label className="text-xs font-medium text-slate-600 md:col-span-2">
              業務内容
              <Textarea {...form.register("description")} />
            </label>
            <label className="text-xs font-medium text-slate-600 md:col-span-2">
              必須要件
              <Textarea {...form.register("required_conditions")} />
            </label>
            <label className="text-xs font-medium text-slate-600 md:col-span-2">
              歓迎要件
              <Textarea {...form.register("preferred_conditions")} />
            </label>
            <label className="text-xs font-medium text-slate-600 md:col-span-2">
              社内メモ
              <Textarea {...form.register("internal_notes")} />
            </label>
          </div>
          {mutation.error ? (
            <p className="mt-3 text-sm text-rose-700">
              {mutation.error.message}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              onClick={() => void navigate(-1)}
              type="button"
              variant="outline"
            >
              キャンセル
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                companiesQuery.isPending ||
                (!isEditing && jobsQuery.isPending)
              }
              type="submit"
            >
              {job ? "変更を保存" : "求人を登録"}
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
