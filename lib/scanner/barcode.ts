// TODO: Barcode scanner integration
//
// Wiring plan (browser camera approach):
//   1. Install a barcode-decoding library, e.g. `zxing-wasm` or `@zxing/browser`.
//   2. Create a client component `components/ui/barcode-scanner.tsx` that:
//        - Opens a <video> stream via getUserMedia()
//        - Feeds frames to the decoder
//        - Calls onScan(code: string) when a barcode is recognised
//   3. Use <BarcodeScanner /> in Inventory → Add Item / Stock Adjustment pages to
//      populate SKU/barcode fields without manual typing.
//   4. For hardware USB scanners: they emit keystrokes — no extra code needed; just
//      point focus to the SKU input field.
//
// No implementation goes here; this file is the registry comment only.

export {};
