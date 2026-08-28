import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    server: {
        host: "0.0.0.0",
        port: 3000,
        allowedHosts: [".internal", "localhost"],
        proxy: {
            "/api": { target: "http://localhost:8000", changeOrigin: true },
        },
    },
    build: { outDir: "dist", sourcemap: true },
    test: {
        environment: "happy-dom",
        setupFiles: "./src/test/setup.js",
        reporters: ["default", "junit"],
        outputFile: { junit: "../output/frontend.xml" },
    },
});
