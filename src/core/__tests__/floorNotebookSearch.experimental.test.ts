import { filterGlobalSearchResults, getGlobalSearchResultPath } from "../../widgets/search/globalSearchFilter";

const results = filterGlobalSearchResults("۱۲", {
  workers: [], cashbookEntries: [], activities: [], equipment: [],
  floors: [{ id: "f2", projectId: "p", name: "طبقه دوازدهم", number: 12, usageType: "residential", area: null, height: null, description: null, status: "in_progress", progressMode: "calculated", manualProgress: null, unitType: "single" as const, unitCount: null, createdAt: "", updatedAt: "", progress: 72, openTasksCount: 3, openIssuesCount: 0, criticalOpenIssuesCount: 0, stagesCount: 8, completedStagesCount: 3, linkedCashbookTotal: 0, lastActivityAt: null, healthScore: 100, healthBreakdown: [] }],
  floorReports: [{ id: "r1", projectId: "p", date: "2026-01-02", description: "گچ‌کاری طبقه دوم انجام شد", floorId: "f2", stageId: null, updatedAt: "" }],
}, "2026-01-03");

if (!results.some((r) => r.kind === "floor" && r.id === "f2")) throw new Error("شماره طبقه در جستجو پیدا نشد");

const reportResults = filterGlobalSearchResults("گچ", { workers: [], cashbookEntries: [], activities: [], equipment: [], floorReports: [{ id: "r1", projectId: "p", date: "2026-01-02", description: "گچ‌کاری طبقه دوم انجام شد", floorId: "f2", stageId: null, updatedAt: "" }] }, "2026-01-03");
if (!reportResults.some((r) => r.kind === "floorReport" && getGlobalSearchResultPath(r) === "/project/floors/f2")) throw new Error("گزارش متصل به طبقه در جستجو پیدا نشد");

console.log("✅ floor notebook search tests passed");
