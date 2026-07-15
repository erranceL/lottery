import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// GitHub Pages 部署在 https://<user>.github.io/lottery/ 路径下
export default defineConfig({
  plugins: [react()],
  base: "/lottery/",
  test: {
    environment: "node",
  },
});
