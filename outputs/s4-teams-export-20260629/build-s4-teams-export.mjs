import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const inputPath = "/tmp/mrjz-s4-teams-export/teams.json";
const outputDir = "/Users/xuhuang/self-made-program/mrjz-app/outputs/s4-teams-export-20260629";
const outputPath = path.join(outputDir, "mrjz-season-4-teams.xlsx");
const previewPath = path.join(outputDir, "mrjz-season-4-teams-preview.png");

const rawRows = JSON.parse(await fs.readFile(inputPath, "utf8"));

const rows = rawRows.map((row) => [
  `Team ${row.team_no}`,
  row.team_name ?? "",
  row.player_name ?? "",
  row.steam_id64 ? String(row.steam_id64) : "",
  row.account_id ? String(row.account_id) : "",
]);

const teamCount = new Set(rawRows.map((row) => row.team_name)).size;
const playerCount = rawRows.length;
const exportedAt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).format(new Date());

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("第四届队伍名单");
sheet.showGridLines = false;

sheet.mergeCells("A1:E1");
sheet.getRange("A1").values = [["每日节奏第四届社区赛队伍名单"]];
sheet.getRange("A1").format = {
  fill: "#111827",
  font: { bold: true, color: "#FFFFFF", size: 16 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange("A1").format.rowHeightPx = 34;

sheet.getRange("A3:B5").values = [
  ["导出时间", exportedAt],
  ["队伍数", teamCount],
  ["选手数", playerCount],
];
sheet.getRange("A3:A5").format = {
  fill: "#E5E7EB",
  font: { bold: true, color: "#111827" },
};
sheet.getRange("B3:B5").format = {
  fill: "#F9FAFB",
  horizontalAlignment: "left",
};
sheet.getRange("A3:B5").format.borders = {
  preset: "all",
  style: "thin",
  color: "#D1D5DB",
};

const headers = [["队伍编号", "队名", "选手名", "SteamID64", "Dota Account ID"]];
const tableStartRow = 7;
const tableRows = [headers[0], ...rows];
const tableRange = `A${tableStartRow}:E${tableStartRow + tableRows.length - 1}`;

sheet.getRange(`C${tableStartRow + 1}:E${tableStartRow + tableRows.length - 1}`).setNumberFormat("@");
sheet.getRange(tableRange).values = tableRows;
sheet.getRange(`A${tableStartRow}:E${tableStartRow}`).format = {
  fill: "#1F2937",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange(`A${tableStartRow}:E${tableStartRow}`).format.rowHeightPx = 26;
sheet.getRange(`A${tableStartRow + 1}:E${tableStartRow + tableRows.length - 1}`).format = {
  fill: "#FFFFFF",
  verticalAlignment: "center",
};
sheet.getRange(`A${tableStartRow + 1}:A${tableStartRow + tableRows.length - 1}`).format.horizontalAlignment = "center";
sheet.getRange(`D${tableStartRow + 1}:E${tableStartRow + tableRows.length - 1}`).format.horizontalAlignment = "left";
sheet.getRange(`D${tableStartRow + 1}:E${tableStartRow + tableRows.length - 1}`).format.numberFormat = "@";
sheet.getRange(tableRange).format.borders = {
  insideHorizontal: { style: "thin", color: "#E5E7EB" },
  insideVertical: { style: "thin", color: "#E5E7EB" },
  top: { style: "medium", color: "#9CA3AF" },
  bottom: { style: "medium", color: "#9CA3AF" },
  left: { style: "medium", color: "#9CA3AF" },
  right: { style: "medium", color: "#9CA3AF" },
};

sheet.tables.add(tableRange, true, "Season4Teams");
sheet.freezePanes.freezeRows(tableStartRow);

sheet.getRange("A:A").format.columnWidth = 12;
sheet.getRange("B:B").format.columnWidth = 24;
sheet.getRange("C:C").format.columnWidth = 22;
sheet.getRange("D:D").format.columnWidth = 24;
sheet.getRange("E:E").format.columnWidth = 18;

const check = await workbook.inspect({
  kind: "table",
  range: "第四届队伍名单!A1:E20",
  include: "values",
  tableMaxRows: 20,
  tableMaxCols: 5,
  maxChars: 6000,
});
console.log(check.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
  maxChars: 2000,
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "第四届队伍名单",
  range: "A1:E24",
  scale: 2,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(JSON.stringify({ outputPath, previewPath, teamCount, playerCount }, null, 2));
