import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { allowedHosts: true },
  build: {
    target: "es2022",
    // Optimize for mobile - smaller chunks
    chunkSizeWarningLimit: 500,
    // Rollup options for better bundling
    rollupOptions: {
      output: {
        // Manual chunks for better caching
        manualChunks: (id) => {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react";
          }
          if (id.includes("src/lib/wasm/")) {
            return "wasm";
          }
          if (id.includes("src/lib/vfs/")) {
            return "vfs";
          }
          if (id.includes("src/lib/agent/")) {
            return "agent";
          }
          if (id.includes("src/lib/security/")) {
            return "security";
          }
          if (id.includes("src/lib/mcp/")) {
            return "mcp";
          }
          if (id.includes("src/lib/integrations/")) {
            return "integrations";
          }
          if (id.includes("src/features/terminal/")) {
            return "terminal";
          }
          if (id.includes("src/features/preview/")) {
            return "preview";
          }
          if (id.includes("src/features/mcp/")) {
            return "mcpPanel";
          }
          if (id.includes("src/components/")) {
            return "components";
          }
          return undefined;
        },
      },
    },
    // Minification for production
    minify: "esbuild",
  },
});
