import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArrowLeft, Pencil, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { EntityTags } from "@/components/common/entity-tags";
import { SectionCard } from "@/components/common/section-card";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  companyFormSchema,
  contactFormSchema,
  findCompanyDuplicates,
  toCompanyFormValues,
  toCompanyValues,
  toContactFormValues,
  toContactValues,
  type CompanyDuplicateMatch,
  type CompanyFormValues,
  type ContactFormValues,
} from "@/features/applications/company-form-model";
import {
  useArchiveCompanyContactMutation,
  useArchiveCompanyMutation,
  useCompaniesQuery,
  useCompanyContactsQuery,
  useCreateCompanyContactMutation,
  useCreateCompanyMutation,
  useJobsQuery,
  useUpdateCompanyContactMutation,
  useUpdateCompanyMutation,
} from "@/features/applications/application-queries";
import type { CompanyContactRow } from "@/types/database";

function ContactEditor({
  companyId,
  contact,
  onClose,
}: {
  companyId: string;
  contact?: CompanyContactRow;
  onClose: () => void;
}) {
  const createMutation = useCreateCompanyContactMutation(companyId);
  const updateMutation = useUpdateCompanyContactMutation(companyId);
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: toContactFormValues(contact),
  });
  const mutation = contact ? updateMutation : createMutation;
  const submit = async (values: ContactFormValues) => {
    const writeValues = toContactValues(companyId, values);
    if (contact)
      await updateMutation.mutateAsync({
        contactId: contact.id,
        values: writeValues,
      });
    else await createMutation.mutateAsync(writeValues);
    onClose();
  };
  return (
    <form
      className="mb-4 rounded-md border border-blue-200 bg-blue-50/40 p-4"
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
    >
      <div className="mb-3 flex justify-between">
        <h3 className="text-sm font-semibold">
          {contact ? "担当者を編集" : "担当者を追加"}
        </h3>
        <Button
          aria-label="担当者フォームを閉じる"
          onClick={onClose}
          size="sm"
          type="button"
          variant="outline"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-medium text-slate-600">
          氏名 *<Input {...form.register("full_name")} />
          {form.formState.errors.full_name ? (
            <span className="text-rose-700">
              {form.formState.errors.full_name.message}
            </span>
          ) : null}
        </label>
        <label className="text-xs font-medium text-slate-600">
          部署
          <Input {...form.register("department")} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          役職
          <Input {...form.register("position")} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          メールアドレス
          <Input {...form.register("email")} />
          {form.formState.errors.email ? (
            <span className="text-rose-700">
              {form.formState.errors.email.message}
            </span>
          ) : null}
        </label>
        <label className="text-xs font-medium text-slate-600">
          電話番号
          <Input {...form.register("phone")} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          メモ
          <Input {...form.register("notes")} />
        </label>
      </div>
      {mutation.error ? (
        <p className="mt-2 text-sm text-rose-700">{mutation.error.message}</p>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button onClick={onClose} type="button" variant="outline">
          キャンセル
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          保存
        </Button>
      </div>
    </form>
  );
}

export function CompanyFormPage() {
  const { companyId = "" } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(companyId);
  const companiesQuery = useCompaniesQuery();
  const jobsQuery = useJobsQuery();
  const company = (companiesQuery.data ?? []).find(
    (item) => item.id === companyId,
  );
  const contactsQuery = useCompanyContactsQuery(companyId);
  const createMutation = useCreateCompanyMutation();
  const updateMutation = useUpdateCompanyMutation(companyId);
  const archiveMutation = useArchiveCompanyMutation(companyId);
  const archiveContactMutation = useArchiveCompanyContactMutation(companyId);
  const [editingContact, setEditingContact] = useState<
    CompanyContactRow | "new" | null
  >(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const navigationBypass = useRef(false);
  const [duplicateMatches, setDuplicateMatches] = useState<
    CompanyDuplicateMatch[]
  >([]);
  const [pendingValues, setPendingValues] = useState<CompanyFormValues | null>(
    null,
  );
  const [duplicateCheckError, setDuplicateCheckError] = useState<string | null>(
    null,
  );
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    values: toCompanyFormValues(company),
  });
  const relatedJobs = (jobsQuery.data ?? []).filter(
    (job) => job.company_id === companyId,
  );
  const createCompany = async (formValues: CompanyFormValues) => {
    navigationBypass.current = true;
    try {
      const created = await createMutation.mutateAsync(
        toCompanyValues(formValues),
      );
      void navigate(`/companies/${created.id}/edit`, { replace: true });
    } catch {
      navigationBypass.current = false;
    }
  };
  const submit = async (formValues: CompanyFormValues) => {
    const writeValues = toCompanyValues(formValues);
    if (company) {
      navigationBypass.current = true;
      try {
        await updateMutation.mutateAsync(writeValues);
        void navigate("/companies");
      } catch {
        navigationBypass.current = false;
      }
      return;
    }

    if (companiesQuery.isError) {
      setDuplicateCheckError(
        "既存企業との重複を確認できませんでした。再読み込みしてから登録してください。",
      );
      return;
    }
    const matches = findCompanyDuplicates(
      formValues,
      companiesQuery.data ?? [],
    );
    if (matches.length) {
      setDuplicateMatches(matches);
      setPendingValues(formValues);
      setDuplicateCheckError(null);
      return;
    }
    await createCompany(formValues);
  };
  const clearDuplicateWarning = () => {
    setDuplicateMatches([]);
    setPendingValues(null);
    setDuplicateCheckError(null);
  };
  const performArchive = async () => {
    navigationBypass.current = true;
    try {
      await archiveMutation.mutateAsync();
      void navigate("/companies");
    } catch {
      navigationBypass.current = false;
    }
  };

  if (isEditing && companiesQuery.isPending)
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        企業を読み込んでいます…
      </p>
    );
  if (isEditing && !company)
    return <EmptyState message="企業が見つかりません" />;
  const mutation = company ? updateMutation : createMutation;
  return (
    <div>
      <UnsavedChangesGuard
        bypassRef={navigationBypass}
        when={form.formState.isDirty}
      />
      <Link
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"
        to="/companies"
      >
        <ArrowLeft className="size-3.5" />
        企業管理へ戻る
      </Link>
      <PageIntro
        action={
          company ? (
            <div className="flex gap-2">
              {confirmArchive ? (
                <>
                  <Button
                    disabled={
                      archiveMutation.isPending || relatedJobs.length > 0
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
                </>
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
              )}
            </div>
          ) : null
        }
        description="企業の検索情報と採用担当者を管理します。"
        title={company ? `${company.name}を編集` : "新規企業登録"}
      />
      {confirmArchive && relatedJobs.length > 0 ? (
        <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          求人が{relatedJobs.length}
          件あるためアーカイブできません。先に求人をアーカイブしてください。
        </p>
      ) : null}
      {!isEditing && duplicateMatches.length ? (
        <section
          aria-label="重複企業の確認"
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4"
          role="alert"
        >
          <h2 className="text-sm font-semibold text-amber-950">
            既存企業と一致する情報があります
          </h2>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            別法人や別事業体であることを確認してから登録を続けてください。
          </p>
          <ul className="mt-3 space-y-2">
            {duplicateMatches.map(({ company: match, matchedFields }) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-white px-3 py-2"
                key={match.id}
              >
                <span className="text-sm text-slate-800">
                  {match.name}（一致：{matchedFields.join("・")}）
                </span>
                <Link
                  className="text-xs font-medium text-blue-700 hover:underline"
                  target="_blank"
                  to={`/companies/${match.id}`}
                >
                  既存企業を確認
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
                if (pendingValues) void createCompany(pendingValues);
              }}
              size="sm"
            >
              重複でないことを確認して登録
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
      <SectionCard title="企業情報">
        <form
          onChange={clearDuplicateWarning}
          onSubmit={(event) => void form.handleSubmit(submit)(event)}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-medium text-slate-600">
              企業名 *<Input {...form.register("name")} />
              {form.formState.errors.name ? (
                <span className="text-rose-700">
                  {form.formState.errors.name.message}
                </span>
              ) : null}
            </label>
            <label className="text-xs font-medium text-slate-600">
              企業名カナ
              <Input {...form.register("name_kana")} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              業種
              <Input {...form.register("industry")} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              所在地
              <Input {...form.register("address")} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              従業員数
              <Input inputMode="numeric" {...form.register("employees")} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              資本金（円）
              <Input inputMode="numeric" {...form.register("capital")} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              上場区分
              <Select className="w-full" {...form.register("listed")}>
                <option value="">未設定</option>
                <option value="true">上場</option>
                <option value="false">非上場</option>
              </Select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Webサイト
              <Input {...form.register("website")} />
              {form.formState.errors.website ? (
                <span className="text-rose-700">
                  {form.formState.errors.website.message}
                </span>
              ) : null}
            </label>
            <label className="text-xs font-medium text-slate-600 md:col-span-2 xl:col-span-4">
              社内メモ
              <Textarea {...form.register("notes")} />
            </label>
          </div>
          {mutation.error ? (
            <p className="mt-3 text-sm text-rose-700">
              {mutation.error.message}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              onClick={() => void navigate("/companies")}
              type="button"
              variant="outline"
            >
              キャンセル
            </Button>
            <Button
              disabled={
                mutation.isPending || (!isEditing && companiesQuery.isPending)
              }
              type="submit"
            >
              {company ? "変更を保存" : "企業を登録"}
            </Button>
          </div>
        </form>
      </SectionCard>
      {company ? (
        <div className="mt-4 space-y-4">
          <EntityTags
            label="企業"
            target={{ kind: "company", id: company.id }}
          />
          <SectionCard
            action={
              <Button
                className="gap-1.5"
                onClick={() => setEditingContact("new")}
                size="sm"
              >
                <Plus className="size-4" />
                担当者追加
              </Button>
            }
            description="求人の採用担当者として選択できます。"
            title="採用担当者"
          >
            {editingContact ? (
              <ContactEditor
                companyId={company.id}
                contact={editingContact === "new" ? undefined : editingContact}
                onClose={() => setEditingContact(null)}
              />
            ) : null}
            {contactsQuery.data?.length ? (
              <div className="divide-y divide-slate-100">
                {contactsQuery.data.map((contact) => {
                  const referenced = relatedJobs.some(
                    (job) => job.contact_id === contact.id,
                  );
                  return (
                    <div
                      className="flex items-center justify-between gap-3 py-3"
                      key={contact.id}
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {contact.full_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {[contact.department, contact.position, contact.email]
                            .filter(Boolean)
                            .join(" / ") || "詳細未登録"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          aria-label={`${contact.full_name}を編集`}
                          onClick={() => setEditingContact(contact)}
                          size="sm"
                          variant="outline"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          aria-label={`${contact.full_name}をアーカイブ`}
                          className="text-rose-700"
                          disabled={
                            referenced || archiveContactMutation.isPending
                          }
                          onClick={() =>
                            archiveContactMutation.mutate(contact.id)
                          }
                          size="sm"
                          title={
                            referenced ? "求人で使用中の担当者です" : undefined
                          }
                          variant="outline"
                        >
                          <Archive className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="担当者はまだ登録されていません" />
            )}
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
