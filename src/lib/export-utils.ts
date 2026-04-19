import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Use "Rs." in PDF since the default jsPDF font (helvetica) does not include the ₹ glyph.
const sanitizeForPdf = (v: string | number) =>
  String(v).replace(/₹/g, "Rs.");

const appendTotalsRow = (rows: (string | number)[][]): (string | number)[][] => {
  if (rows.length === 0) return rows;
  const colCount = rows[0].length;
  const totals: (string | number)[] = new Array(colCount).fill("");
  totals[0] = "TOTAL";
  let hasNumeric = false;
  for (let c = 1; c < colCount; c++) {
    let sum = 0;
    let allNumeric = true;
    for (const r of rows) {
      const cell = r[c];
      const n = typeof cell === "number" ? cell : Number(String(cell).replace(/[₹,Rs.\s%]/g, ""));
      if (Number.isFinite(n) && cell !== "" && cell !== null) {
        sum += n;
      } else {
        allNumeric = false;
        break;
      }
    }
    if (allNumeric) {
      totals[c] = sum;
      hasNumeric = true;
    }
  }
  return hasNumeric ? [...rows, totals] : rows;
};

export function exportCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const withTotals = appendTotalsRow(rows);
  const csv = [headers.join(","), ...withTotals.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportExcel(headers: string[], rows: (string | number)[][], filename: string, sheetName = "Report") {
  const withTotals = appendTotalsRow(rows);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...withTotals]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function exportPDF(title: string, headers: string[], rows: (string | number)[][], filename: string) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(sanitizeForPdf(title), 14, 14);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 20);
  const withTotals = appendTotalsRow(rows);
  const lastIdx = withTotals.length - 1;
  autoTable(doc, {
    startY: 25,
    head: [headers.map(sanitizeForPdf)],
    body: withTotals.map((r) => r.map((c) => sanitizeForPdf(c))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 42, 90] },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === lastIdx && withTotals.length > rows.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });
  doc.save(filename);
}
