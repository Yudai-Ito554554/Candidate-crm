import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { getJob, tasks } from "@/data/mock-data";
import { formatDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";

type TaskView = "未完了" | "完了" | "期限超過";

export function CandidateTasks({ candidateId }: { candidateId: string }) {
  const [view, setView] = useState<TaskView>("未完了");
  const candidateTasks = tasks
    .filter((task) => task.candidateId === candidateId)
    .filter((task) =>
      view === "完了"
        ? task.status === "完了"
        : view === "期限超過"
          ? isOverdue(task.dueDate, task.status === "完了")
          : task.status !== "完了",
    );
  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-lg border border-slate-200 bg-white p-1.5">
        {(["未完了", "完了", "期限超過"] as TaskView[]).map((item) => (
          <button
            aria-pressed={view === item}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium",
              view === item
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
            key={item}
            onClick={() => setView(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      {candidateTasks.length ? (
        <TableContainer>
          <Table>
            <thead>
              <tr>
                <Th>期限</Th>
                <Th>優先度</Th>
                <Th>タスク</Th>
                <Th>関連求人</Th>
                <Th>ステータス</Th>
              </tr>
            </thead>
            <tbody>
              {candidateTasks.map((task) => {
                const job = task.jobId ? getJob(task.jobId) : undefined;
                return (
                  <tr key={task.id}>
                    <Td
                      className={
                        isOverdue(task.dueDate, task.status === "完了")
                          ? "font-semibold text-rose-700"
                          : ""
                      }
                    >
                      {formatDate(task.dueDate)}
                    </Td>
                    <Td>
                      <Badge value={task.priority} />
                    </Td>
                    <Td className="font-medium">{task.title}</Td>
                    <Td>{job?.title ?? "-"}</Td>
                    <Td>
                      <Badge value={task.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableContainer>
      ) : (
        <EmptyState message={`${view}のタスクはありません`} />
      )}
    </div>
  );
}
