// TODO: QR code scanner integration
//
// Wiring plan:
//   1. Install `jsQR` or reuse the same library chosen for barcode scanning (most
//      barcode libs also handle QR codes, including zxing-wasm).
//   2. Create a client component `components/ui/qr-scanner.tsx` with the same
//      camera-stream pattern as barcode-scanner.tsx.
//   3. Use cases:
//        - Scan a QR-encoded product ID on shelf labels
//        - Scan a QR-encoded order reference from a printed picking slip
//        - Link mobile camera to the desktop app via a QR handshake
//   4. For QR code *generation* (printing labels) install `qrcode` and add a
//      <QRCode value={...} /> UI component.
//
// No implementation goes here; this file is the registry comment only.

export {};
