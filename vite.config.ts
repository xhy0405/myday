import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

function collectPrecacheAssets(directory: string, root = directory): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = resolve(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return collectPrecacheAssets(fullPath, root);
    }

    const relativePath = relative(root, fullPath).replace(/\\/g, "/");
    if (relativePath === "sw.js") {
      return [];
    }

    if (!/\.(?:html|js|css|png|svg|webmanifest|webp|jpg|jpeg|ico|woff2?)$/i.test(relativePath)) {
      return [];
    }

    return [`./${relativePath}`];
  });
}

function mydayServiceWorkerPlugin() {
  return {
    name: "myday-service-worker",
    apply: "build" as const,
    closeBundle() {
      const distDir = resolve(__dirname, "dist");
      const serviceWorkerPath = resolve(distDir, "sw.js");
      if (!existsSync(serviceWorkerPath)) {
        writeFileSync(serviceWorkerPath, readFileSync(resolve(__dirname, "public", "sw.js"), "utf8"));
      }
      const assets = Array.from(new Set(["./", ...collectPrecacheAssets(distDir)])).sort();
      const versionHash = createHash("sha256");
      assets.forEach((asset) => {
        versionHash.update(asset);
        if (asset !== "./") {
          versionHash.update(readFileSync(resolve(distDir, asset.replace(/^\.\//, ""))));
        }
      });
      const version = versionHash.digest("hex").slice(0, 12);
      const source = readFileSync(serviceWorkerPath, "utf8")
        .replace(/const CACHE_NAME = ".*?";/, `const CACHE_NAME = "myday-static-${version}";`)
        .replace(
          /const PRECACHE_ASSETS = \[[\s\S]*?\];/,
          `const PRECACHE_ASSETS = ${JSON.stringify(assets, null, 2)};`,
        );

      writeFileSync(serviceWorkerPath, source);
    },
  };
}

// Vite 配置：启用 React 插件（支持 JSX、Fast Refresh 等）
export default defineConfig({
  base: "./",
  plugins: [react(), mydayServiceWorkerPlugin()],
});
