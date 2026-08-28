import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
HTMLDialogElement.prototype.close = function close() { this.open = false; };
window.confirm = () => true;
if (!globalThis.localStorage) {
    const values = new Map();
    const storage = {
        clear: () => values.clear(),
        getItem: (key) => values.has(String(key)) ? values.get(String(key)) : null,
        removeItem: (key) => values.delete(String(key)),
        setItem: (key, value) => values.set(String(key), String(value)),
    };
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
}
afterEach(cleanup);
