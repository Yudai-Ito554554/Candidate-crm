import { Archive, ArrowLeft, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { UnsavedChangesGuard } from "@/components/common/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CandidateForm } from "@/features/candidates/candidate-form";
import {
  findCandidateDuplicates,
  type CandidateDuplicateMatch,
  toCandidateValues,
  type CandidateFormValues,
} from "@/features/candidates/candidate-form-model";
import {
  useArchiveCandidateMutation,
  useCandidateQuery,
  useCandidatesQuery,
  useCreateCandidateMutation,
  useUpdateCandidateMutation,
} from "@/features/candidates/candidate-queries";
import { useAuth } from "@/features/auth/use-auth";

export function CandidateFormPage() {
  const { candidateId = "" } = useParams();
  const isEditing = Boolean(candidateId);
  const navigate = useNavigate();
  const auth = useAuth();
  const candidateQuery = useCandidateQuery(candidateId);
  const candidatesQuery = useCandidatesQuery();
  const createMutation = useCreateCandidateMutation();
  const updateMutation = useUpdateCandidateMutation(candidateId);
  const archiveMutation = useArchiveCandidateMutation(candidateId);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const navigationBypass = useRef(false);
  const [duplicateMatches, setDuplicateMatches] = useState<
    CandidateDuplicateMatch[]
  >([]);
  const [pendingValues, setPendingValues] =
    useState<CandidateFormValues | null>(null);
  const [duplicateCheckError, setDuplicateCheckError] = useState<string | null>(
    null,
  );

  if (isEditing && candidateQuery.isPending) {
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-600">
        <LoaderCircle className="size-5 animate-spin" />
        候補者情報を読み込んでいます…
      </div>
    );
  }

  if (isEditing && candidateQuery.isError) {
    return (
      <EmptyState
        message={
          candidateQuery.error instanceof Error
            ? candidateQuery.error.message
            : "候補者を読み込めませんでした"
        }
      />
    );
  }

  const candidate = candidateQuery.data;
  const mutationError = createMutation.error ?? updateMutation.error;

  const createCandidate = async (formValues: CandidateFormValues) => {
    navigationBypass.current = true;
    try {
      const values = toCandidateValues(formValues);
      const created = await createMutation.mutateAsync({
        ...values,
        owner_id: auth.user?.id ?? null,
      });
      void navigate(`/candidates/${created.id}`, { replace: true });
    } catch {
      navigationBypass.current = false;
    }
  };

  const submit = async (formValues: CandidateFormValues) => {
    const values = toCandidateValues(formValues);
    if (isEditing) {
      navigationBypass.current = true;
      try {
        const updated = await updateMutation.mutateAsync(values);
        void navigate(`/candidates/${updated.id}`, { replace: true });
      } catch {
        navigationBypass.current = false;
      }
      return;
    }

    if (candidatesQuery.isError) {
      setDuplicateCheckError(
        "既存候補者との重複を確認できませんでした。再読み込みしてから登録してください。",
      );
      return;
    }
    const matches = findCandidateDuplicates(
      formValues,
      candidatesQuery.data ?? [],
    );
    if (matches.length) {
      setDuplicateMatches(matches);
      setPendingValues(formValues);
      setDuplicateCheckError(null);
      return;
    }
    await createCandidate(formValues);
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
      void navigate("/candidates", { replace: true });
    } catch {
      navigationBypass.current = false;
    }
  };

  return (
    <div>
      <UnsavedChangesGuard bypassRef={navigationBypass} when={formDirty} />
      <Link
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"
        to={candidate ? `/candidates/${candidate.id}` : "/candidates"}
      >
        <ArrowLeft className="size-3.5" />
        {candidate ? "候補者詳細へ戻る" : "候補者一覧へ戻る"}
      </Link>
      <PageIntro
        action={
          isEditing ? (
            confirmArchive ? (
              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-2">
                <span className="text-xs text-rose-700">
                  一覧からアーカイブしますか？
                </span>
                <Button
                  className="h-8"
                  disabled={archiveMutation.isPending}
                  onClick={() => void performArchive()}
                  size="sm"
                >
                  実行
                </Button>
                <Button
                  className="h-8"
                  onClick={() => setConfirmArchive(false)}
                  size="sm"
                  variant="outline"
                >
                  戻る
                </Button>
              </div>
            ) : (
              <Button
                className="gap-2 text-rose-700"
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
        description="候補者の基本情報、希望条件、次回対応を安全に保存します。"
        title={candidate ? `${candidate.full_name}を編集` : "新規候補者登録"}
      />
      {!isEditing && duplicateMatches.length ? (
        <section
          aria-label="重複候補者の確認"
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4"
          role="alert"
        >
          <h2 className="text-sm font-semibold text-amber-950">
            既存候補者と一致する情報があります
          </h2>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            同一人物でないことを確認してから登録を続けてください。
          </p>
          <ul className="mt-3 space-y-2">
            {duplicateMatches.map(({ candidate: match, matchedFields }) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-white px-3 py-2"
                key={match.id}
              >
                <span className="text-sm text-slate-800">
                  {match.full_name}（一致：{matchedFields.join("・")}）
                </span>
                <Link
                  className="text-xs font-medium text-blue-700 hover:underline"
                  target="_blank"
                  to={`/candidates/${match.id}`}
                >
                  既存候補者を確認
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
                if (pendingValues) void createCandidate(pendingValues);
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
      <CandidateForm
        candidate={candidate}
        errorMessage={
          mutationError instanceof Error ? mutationError.message : undefined
        }
        isSubmitting={
          createMutation.isPending ||
          updateMutation.isPending ||
          (!isEditing && candidatesQuery.isPending)
        }
        onCancel={() => void navigate(-1)}
        onValuesChange={() => {
          clearDuplicateWarning();
          setFormDirty(true);
        }}
        onSubmit={submit}
      />
    </div>
  );
}
