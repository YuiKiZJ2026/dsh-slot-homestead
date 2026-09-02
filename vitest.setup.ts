import "@testing-library/jest-dom/vitest";

// Node 26 exposes an experimental global localStorage getter that resolves to
// undefined unless Node is started with --localstorage-file. Vitest cannot
// replace an existing Node global while populating jsdom, so use the storage
// owned by the active jsdom window to preserve browser semantics.
const testDom = (globalThis as typeof globalThis & {
  jsdom?: { window: { localStorage: Storage } };
}).jsdom;

if (testDom !== undefined) {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    enumerable: true,
    value: testDom.window.localStorage,
  });
}
