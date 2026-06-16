import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const ignoredDirectories = new Set([
  ".git",
  "coverage",
  "dist",
  "logs",
  "node_modules",
]);

function collectJavaScriptFiles(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        collectJavaScriptFiles(fullPath, files);
      }
      continue;
    }

    if (stat.isFile() && fullPath.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = collectJavaScriptFiles(root).sort();

if (files.length === 0) {
  console.error(`No JavaScript files found under ${root}`);
  process.exit(1);
}

for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

console.log(`Checked ${files.length} JavaScript file(s) under ${root}`);
