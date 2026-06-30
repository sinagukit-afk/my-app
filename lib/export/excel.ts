// TODO: Excel export integration
//
// Wiring plan:
//   1. Install `xlsx` (SheetJS) — the most common choice; no server needed.
//        npm install xlsx          ← confirm with user before running
//   2. Add an exportToExcel() helper here:
//
//        import * as XLSX from 'xlsx';
//
//        export function exportToExcel<T extends object>(
//          rows: T[],
//          filename: string,
//        ): void {
//          const ws = XLSX.utils.json_to_sheet(rows);
//          const wb = XLSX.utils.book_new();
//          XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
//          XLSX.writeFile(wb, `${filename}.xlsx`);
//        }
//
//   3. Wire it to the <DataToolbar /> component
//      (components/business/data-toolbar.tsx — "Export" button placeholder already exists).
//   4. Call exportToExcel(filteredRows, 'inventory-export') from any DataTable page.
//
// No implementation goes here; this file is the registry comment only.

export {};
