import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom"],
  // Hooks and context inside: Next.js App Router must treat the package as a Client Component boundary.
  banner: { js: '"use client";' },
  // Plain Node instead of `cp` in the npm script, which cmd.exe on Windows does not have.
  onSuccess: () => copyFile("src/styles/tourline.css", "dist/styles.css"),
});
