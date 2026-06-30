// TODO: Printing integration
//
// Wiring plan:
//   1. For simple browser printing: call window.print() from a client action and
//      add a @media print stylesheet that hides the sidebar/nav.
//   2. For receipts / labels / structured print layouts:
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
