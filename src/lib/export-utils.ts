import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportExcel(headers: string[], rows: (string | number)[][], filename: string, sheetName = "Report") {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function exportPDF(title: string, headers: string[], rows: (string | number)[][], filename: string) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 20);
  autoTable(doc, {
    startY: 25,
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 42, 90] },
  });
  doc.save(filename);
}
