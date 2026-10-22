export type CsvValue = string | number | null | undefined;

/** RFC 4180 field: quoted when it contains separators, quotes or line breaks. */
export function csvField(value: CsvValue): string {
  const text = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection for text cells.
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value === "string" ? `'${text}` : text;
  return /[",\n\r;]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n");
}

/** Triggers a download; a UTF-8 BOM makes spreadsheets read accents correctly. */
export function downloadCsv(filename: string, rows: CsvValue[][]): void {
  const blob = new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
