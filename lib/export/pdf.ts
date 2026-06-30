// TODO: PDF export integration
//
// Two recommended approaches — pick one:
//
// Option A — Client-side (no server needed):
//   1. Install `@react-pdf/renderer`.
//   2. Create PDF templates in `components/pdf/` (e.g. InvoicePDF.tsx, ReportPDF.tsx).
//   3. Render with <PDFDownloadLink document={<InvoicePDF data={...} />} />.
//
// Option B — Server-side (better for complex layouts):
//   1. Install `puppeteer` or `playwright` on the VPS.
//   2. Create an API route `app/api/export/pdf/route.ts` that:
//        - Renders a Next.js page/component to HTML
//        - Feeds it to headless Chrome
//        - Streams the resulting PDF back to the client
//   3. Add a generatePdf(route: string, filename: string) helper here
//      that POSTs to that API route and triggers a browser download.
//
// Wire export buttons in: Finance reports, Analytics reports, Invoice/Order detail pages.
//
// No implementation goes here; this file is the registry comment only.

export {};
