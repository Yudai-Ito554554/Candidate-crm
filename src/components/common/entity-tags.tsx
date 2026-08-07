import { LoaderCircle, Plus, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";

import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EditorOnly } from "@/features/access/editor-only";
import {
  useArchiveEntityTagMutation,
  useAttachEntityTagMutation,
  useCreateAndAttachEntityTagMutation,
  useEntityTagsQuery,
  useSharedTagsQuery,
  type EntityTagTarget,
} from "@/features/tags/entity-tag-queries";

export function EntityTags({
  label,
  target,
  className,
}: {
  label: string;
  target: EntityTagTarget;
  className?: string;
}) {
  const tagsQuery = useSharedTagsQuery();
  const relationsQuery = useEntityTagsQuery(target);
  const attachMutation = useAttachEntityTagMutation(target);
  const createMutation = useCreateAndAttachEntityTagMutation(target);
  const archiveMutation = useArchiveEntityTagMutation(target);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const relationByTagId = useMemo(
    () =>
      new Map(
        (relationsQuery.data ?? []).map((relation) => [
          relation.tag_id,
          relation,
        ]),
      ),
    [relationsQuery.data],
  );
  const assignedTags = (tagsQuery.data ?? []).filter((tag) =>
    relationByTagId.has(tag.id),
  );
  const availableTags = (tagsQuery.data ?? []).filter(
    (tag) => !relationByTagId.has(tag.id),
  );
  const isMutating =
    attachMutation.isPending ||
    createMutation.isPending ||
    archiveMutation.isPending;
  const error =
    tagsQuery.error ??
    relationsQuery.error ??
    attachMutation.error ??
    createMutation.error ??
    archiveMutation.error;

  const attachSelected = async () => {
    if (!selectedTagId) return;
    await attachMutation.mutateAsync(selectedTagId);
    setSelectedTagId("");
  };

  const addNamedTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    const existing = (tagsQuery.data ?? []).find(
      (tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (existing && !relationByTagId.has(existing.id)) {
      await attachMutation.mutateAsync(existing.id);
    } else if (!existing) {
      await createMutation.mutateAsync(name);
    }
    setNewTagName("");
  };

  return (
    <SectionCard
      className={className}
      description="検索・AI分析に利用する正規化済みの共通タグです。"
      title={`${label}タグ`}
    >
      {tagsQuery.isPending || relationsQuery.isPending ? (
        <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" />
          タグを読み込んでいます…
        </div>
      ) : (
        <>
          <div className="flex min-h-8 flex-wrap gap-2">
            {assignedTags.length ? (
              assignedTags.map((tag) => {
                const relation = relationByTagId.get(tag.id);
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-xs font-medium text-slate-700"
                    key={tag.id}
                  >
                    <Tag className="size-3" />
                    {tag.name}
                    <EditorOnly>
                      <button
                        aria-label={`${label}から${tag.name}タグを外す`}
                        className="rounded-full p-1 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        disabled={isMutating}
                        onClick={() =>
                          relation && archiveMutation.mutate(relation.id)
                        }
                        type="button"
                      >
                        <X className="size-3" />
                      </button>
                    </EditorOnly>
                  </span>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">
                タグはまだ設定されていません
              </p>
            )}
          </div>
          <EditorOnly>
            <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                <span className="block">既存タグ</span>
                <Select
                  aria-label={`${label}の既存タグ`}
                  className="min-w-48"
                  disabled={isMutating}
                  onChange={(event) => setSelectedTagId(event.target.value)}
                  value={selectedTagId}
                >
                  <option value="">選択してください</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </Select>
              </label>
              <Button
                aria-label={`${label}へ既存タグを追加`}
                disabled={!selectedTagId || isMutating}
                onClick={() => void attachSelected()}
                size="sm"
                variant="outline"
              >
                追加
              </Button>
              <span className="pb-2 text-xs text-slate-400">または</span>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                <span className="block">新しいタグ</span>
                <Input
                  aria-label={`${label}の新しいタグ`}
                  className="h-9 w-48"
                  disabled={isMutating}
                  maxLength={50}
                  onChange={(event) => setNewTagName(event.target.value)}
                  placeholder="例：循環器"
                  value={newTagName}
                />
              </label>
              <Button
                aria-label={`${label}へタグを作成して追加`}
                className="gap-1.5"
                disabled={!newTagName.trim() || isMutating}
                onClick={() => void addNamedTag()}
                size="sm"
              >
                <Plus className="size-4" />
                作成して追加
              </Button>
            </div>
          </EditorOnly>
          {error ? (
            <p className="mt-3 text-sm text-rose-700">{error.message}</p>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}
