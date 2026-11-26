import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const source = new URL("../src", import.meta.url).pathname;
const extensions = new Set([".ts", ".tsx", ".css"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return files.flat();
}

let changed = 0;
for (const file of await walk(source)) {
  if (!extensions.has(extname(file))) continue;
  const original = await readFile(file, "utf8");
  const normalized = `${original
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd()}\n`;
  if (normalized !== original) {
    await writeFile(file, normalized);
    changed += 1;
  }
}

console.log(`Форматирование завершено: обновлено файлов — ${changed}.`);
