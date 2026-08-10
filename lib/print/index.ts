// TODO: Printing integration
//
// Wiring plan:
//   1. DONE — simple browser printing: components/print/print-button.tsx calls
//      window.print() from a client action; app/globals.css has a @media print
//      stylesheet (sizes the page to the document's minimum width, forces
//      light-mode tokens) and components/layout/app-shell.tsx hides the
//      sidebar/header/breadcrumb via print:hidden. Wired on the Quote view and
//      Payment preview pages.
//   2. For receipts / labels / structured print layouts: <PrintButton> + a
//      fixed-width printable Card is that structured layout for documents.
//      For thermal receipts specifically, see step 3.
//        a. Create a printable React component (e.g. `components/print/receipt.tsx`)
//           styled with inline CSS (no Tailwind — it strips unused classes).
//        b. Render it into a hidden <div> (or a new window) and call window.print().
//   3. For thermal / ESC-POS printers (common for receipts):
//        - Investigate `escpos` or `star-micronics-webprnt` npm packages.
//        - Or use a self-hosted print server that accepts HTTP jobs from this app.
//   4. Add a printDocument(componentId: string) helper here when step 1 or 2 is chosen.
//
// No implementation goes here; this file is the registry comment only.

export {};
