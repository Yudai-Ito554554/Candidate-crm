import { Archive, Check, Pencil, Plus, Tags, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useAccess } from "@/features/access/use-access";
import {
  useArchiveSharedTagMutation,
  useCreateSharedTagMutation,
  useSharedTagsQuery,
  useUpdateSharedTagMutation,
} from "@/features/tags/entity-tag-queries";
import { tagNameSchema } from "@/features/tags/tag-management-model";

export function TagManagementPanel() {
  const { canWrite } = useAccess();
  const tagsQuery = useSharedTagsQuery();
  const archiveTag = useArchiveSharedTagMutation();
  const createTag = useCreateSharedTagMutation();
  const updateTag = useUpdateSharedTagMutation();
  const [newTagName, setNewTagName] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [archivingTagId, setArchivingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function startEditing(tagId: string, name: string) {
    setMessage(null);
    setEditingTagId(tagId);
    setEditingName(name);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const parsed = tagNameSchema.safeParse(newTagName);
    if (!parsed.success) {
      setMessage(
        parsed.error.issues[0]?.message ?? "タグ名を確認してください。",
      );
      return;
    }
    try {
      await createTag.mutateAsync(parsed.data);
      setNewTagName("");
      setMessage("タグを作成しました。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "タグを作成できませんでした。",
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTagId) return;
    setMessage(null);
    const parsed = tagNameSchema.safeParse(editingName);
    if (!parsed.success) {
      setMessage(
        parsed.error.issues[0]?.message ?? "タグ名を確認してください。",
      );
      return;
    }
    try {
      await updateTag.mutateAsync({
        tagId: editingTagId,
        name: parsed.data,
      });
      setEditingTagId(null);
      setEditingName("");
      setMessage("タグ名を更新しました。");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "タグ名を更新できませんでした。",
      );
    }
  }

  async function handleArchive(tagId: string) {
    setMessage(null);
    try {
      await archiveTag.mutateAsync(tagId);
      setArchivingTagId(null);
      setMessage("未使用タグをアーカイブしました。");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "タグをアーカイブできませんでした。",
      );
    }
  }

  return (
    <SectionCard
      description="候補者・企業・求人で共通利用するタグです。作成したタグは各詳細画面ですぐに利用できます。"
      title="タグ管理"
    >
      {canWrite ? (
        <form
          className="mb-3 flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-3"
          onSubmit={(event) => void handleCreate(event)}
        >
          <label className="min-w-52 flex-1 text-xs font-medium text-slate-600">
            新しいタグ名
            <Input
              className="mt-1 bg-white"
              maxLength={40}
              onChange={(event) => setNewTagName(event.target.value)}
              placeholder="例：循環器、北海道、管理職候補"
              value={newTagName}
            />
          </label>
          <Button disabled={createTag.isPending} size="sm" type="submit">
            <Plus aria-hidden="true" className="size-4" />
            {createTag.isPending ? "作成中…" : "タグを作成"}
          </Button>
        </form>
      ) : null}
      {tagsQuery.isPending ? (
        <p className="py-6 text-center text-sm text-slate-500">
          タグを読み込んでいます…
        </p>
      ) : tagsQuery.error ? (
        <EmptyState message={tagsQuery.error.message} />
      ) : (tagsQuery.data ?? []).length ? (
        <div className="divide-y divide-slate-100">
          {(tagsQuery.data ?? []).map((tag) => (
            <div className="py-2.5" key={tag.id}>
              {editingTagId === tag.id ? (
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={(event) => void handleSubmit(event)}
                >
                  <Input
                    aria-label={`${tag.name}の新しいタグ名`}
                    autoFocus
                    className="min-w-52 flex-1"
                    maxLength={40}
                    onChange={(event) => setEditingName(event.target.value)}
                    value={editingName}
                  />
                  <Button
                    aria-label="タグ名を保存"
                    disabled={updateTag.isPending}
                    size="sm"
                    type="submit"
                  >
                    <Check aria-hidden="true" className="size-4" />
                    保存
                  </Button>
                  <Button
                    aria-label="タグ名の編集をキャンセル"
                    disabled={updateTag.isPending}
                    onClick={() => setEditingTagId(null)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <X aria-hidden="true" className="size-4" />
                    キャンセル
                  </Button>
                </form>
              ) : archivingTagId === tag.id ? (
                <div
                  aria-label={`${tag.name}のアーカイブ確認`}
                  className="rounded-md border border-amber-200 bg-amber-50 p-3"
                  role="alertdialog"
                >
                  <p className="text-sm font-medium text-amber-950">
                    「{tag.name}」をアーカイブしますか？
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    使用中のタグはDBで拒否されます。アーカイブ後は新しい関連付けや検索候補へ表示されません。
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      disabled={archiveTag.isPending}
                      onClick={() => void handleArchive(tag.id)}
                      size="sm"
                      type="button"
                    >
                      <Archive aria-hidden="true" className="size-4" />
                      {archiveTag.isPending ? "処理中…" : "アーカイブする"}
                    </Button>
                    <Button
                      disabled={archiveTag.isPending}
                      onClick={() => setArchivingTagId(null)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex min-w-0 items-center gap-2 text-sm text-slate-800">
                    <Tags
                      aria-hidden="true"
                      className="size-4 text-slate-400"
                    />
                    <span className="truncate">{tag.name}</span>
                  </span>
                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        aria-label={`${tag.name}を編集`}
                        onClick={() => startEditing(tag.id, tag.name)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                        名称変更
                      </Button>
                      <Button
                        aria-label={`${tag.name}をアーカイブ`}
                        onClick={() => {
                          setMessage(null);
                          setArchivingTagId(tag.id);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Archive aria-hidden="true" className="size-4" />
                        アーカイブ
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="登録済みのタグはありません" />
      )}
      {message ? (
        <p
          aria-live="polite"
          className="mt-3 text-sm text-slate-700"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </SectionCard>
  );
}
