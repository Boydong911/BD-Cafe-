import { readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const IGNORE = new Set(["node_modules", ".next", ".git"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(relative(ROOT, full).split("\\").join("/"));
  }
  return out;
}

const files = walk(ROOT).sort();
writeFileSync(join(ROOT, "PROJECT-STRUCTURE.txt"), files.join("\n") + "\n", "utf8");
console.log(`✅ ${files.length} file dicatat di PROJECT-STRUCTURE.txt`);