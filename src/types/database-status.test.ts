import {
  activityTypeToDatabase,
  applicationStatusToDatabase,
  candidateStatusToDatabase,
  jobStatusToDatabase,
  taskPriorityToDatabase,
  taskTypeToDatabase,
} from "@/types/database-status";

describe("database status mappings", () => {
  it("covers every existing localized UI status", () => {
    expect(Object.keys(candidateStatusToDatabase)).toHaveLength(11);
    expect(Object.keys(applicationStatusToDatabase)).toHaveLength(12);
    expect(Object.keys(jobStatusToDatabase)).toHaveLength(3);
    expect(Object.keys(taskPriorityToDatabase)).toHaveLength(3);
    expect(Object.keys(activityTypeToDatabase)).toHaveLength(6);
    expect(Object.keys(taskTypeToDatabase)).toHaveLength(6);
  });

  it("keeps candidate and application statuses as separate concepts", () => {
    expect(candidateStatusToDatabase["選考中"]).toBe("active_selection");
    expect(applicationStatusToDatabase["書類選考"]).toBe("document_screening");
    expect(activityTypeToDatabase["面談"]).toBe("meeting");
    expect(taskTypeToDatabase["選考確認"]).toBe("selection");
  });
});
