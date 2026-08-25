import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'src');
const extensions = new Set(['.ts', '.tsx', '.astro', '.js', '.jsx']);
const needles = [
  ".eq('status', 'active')",
  '.eq("status", "active")',
];
const replacement = ".in('status', ['active', 'aktiv', 'enabled'])";

function filesUnder(directory) {
  const result = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      result.push(...filesUnder(full));
    } else if (extensions.has(path.extname(entry.name))) {
      result.push(full);
    }
  }

  return result;
}

function isStaffRoleQueryAt(source, position) {
  const before = source.slice(Math.max(0, position - 2500), position);
  const lastFromSingle = before.lastIndexOf(".from('");
  const lastFromDouble = before.lastIndexOf('.from("');
  const lastFrom = Math.max(lastFromSingle, lastFromDouble);

  if (lastFrom < 0) return false;

  const queryTail = before.slice(lastFrom);
  return (
    queryTail.startsWith(".from('opc_staff_roles')") ||
    queryTail.startsWith('.from("opc_staff_roles")')
  );
}

let changedFiles = 0;
let changedQueries = 0;

for (const file of filesUnder(root)) {
  const original = fs.readFileSync(file, 'utf8');
  let source = original;

  for (const needle of needles) {
    let searchFrom = 0;

    while (true) {
      const index = source.indexOf(needle, searchFrom);
      if (index < 0) break;

      if (!isStaffRoleQueryAt(source, index)) {
        searchFrom = index + needle.length;
        continue;
      }

      source = `${source.slice(0, index)}${replacement}${source.slice(index + needle.length)}`;
      changedQueries += 1;
      searchFrom = index + replacement.length;
    }
  }

  if (source !== original) {
    fs.writeFileSync(file, source);
    changedFiles += 1;
    console.log(`normalized staff status query: ${path.relative(process.cwd(), file)}`);
  }
}

console.log(`normalized ${changedQueries} staff-role query(s) in ${changedFiles} file(s)`);
