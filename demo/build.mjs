// Builds demo/dist/index.html: one self-contained page with React, Tourline and styles inlined.
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const root = new URL("../", import.meta.url);

const result = await build({
  entryPoints: [new URL("demo/main.tsx", root).pathname],
  bundle: true,
  minify: true,
  format: "iife",
  jsx: "automatic",
  write: false,
  define: { "process.env.NODE_ENV": '"production"' },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const libraryCss = await readFile(new URL("src/styles/tourline.css", root), "utf8");
const template = await readFile(new URL("demo/template.html", root), "utf8");
const html = template.replace("/*TOURLINE_CSS*/", () => libraryCss).replace("/*DEMO_JS*/", () => js);

await mkdir(new URL("demo/dist/", root), { recursive: true });
await writeFile(new URL("demo/dist/index.html", root), html);

const libraryJs = await readFile(new URL("dist/index.js", root));
console.log(`demo: ${(html.length / 1024).toFixed(0)} kB, library gzip: ${(gzipSync(libraryJs).length / 1024).toFixed(1)} kB`);
