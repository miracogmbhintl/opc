import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const srcRoot = join(root, 'src');
const pagesRoot = join(srcRoot, 'pages');
const componentsRoot = join(srcRoot, 'components');
const routesFile = join(srcRoot, 'lib', 'opc-routes.ts');
const astroConfigFile = join(root, 'astro.config.mjs');
const sidebarFile = join(componentsRoot, 'MirakaSidebar.tsx');

const failures = [];
const warnings = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }

  return files;
}

function relPath(file) {
  return relative(root, file).split(sep).join('/');
}

function routeCandidates(route) {
  if (route === '/') return [join(pagesRoot, 'index.astro')];

  const clean = route.replace(/^\/+|\/+$/g, '');
  const parts = clean.split('/').filter(Boolean);
  const direct = [join(pagesRoot, `${clean}.astro`), join(pagesRoot, clean, 'index.astro')];

  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const prefix = parts.slice(0, i).join('/');
    direct.push(join(pagesRoot, prefix, '[...path].astro'));
    direct.push(join(pagesRoot, prefix, '[...slug].astro'));
  }

  return direct;
}

async function exists(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function hasValidPageOutput(content) {
  return (
    /<(?:html|Layout|[A-Z][A-Za-z0-9_]*)\b/.test(content) ||
    /Astro\.redirect\s*\(/.test(content) ||
    /return\s+new\s+Response\s*\(/.test(content)
  );
}

function auditLifecycle(file, content, { astroPage = false } = {}) {
  const rel = relPath(file);

  if (astroPage && /DOMContentLoaded/.test(content)) {
    failures.push(`${rel}: DOMContentLoaded-only runtime is unsafe after Astro client navigation`);
  }

  if (/new\s+MutationObserver\s*\(/.test(content) && !/\.disconnect\s*\(/.test(content)) {
    failures.push(`${rel}: MutationObserver has no disconnect cleanup`);
  }

  if (/\bsetInterval\s*\(/.test(content) && !/\bclearInterval\s*\(/.test(content)) {
    failures.push(`${rel}: interval has no clearInterval cleanup`);
  }

  if (/\.channel\s*\(/.test(content) && !/removeChannel\s*\(/.test(content)) {
    failures.push(`${rel}: Supabase realtime channel has no removeChannel cleanup`);
  }

  if (/onAuthStateChange\s*\(/.test(content) && !/unsubscribe\s*\(/.test(content)) {
    failures.push(`${rel}: Supabase auth subscription has no unsubscribe cleanup`);
  }

  const addsWindowListener = /window\.addEventListener\s*\(/.test(content);
  const removesWindowListener = /window\.removeEventListener\s*\(/.test(content);
  if (addsWindowListener && !removesWindowListener) {
    warnings.push(`${rel}: window event listener is persistent; verify this is intentional runtime state`);
  }

  const addsDocumentListener = /document\.addEventListener\s*\(/.test(content);
  const removesDocumentListener = /document\.removeEventListener\s*\(/.test(content);
  const explicitAstroRuntime = /astro:(?:page-load|before-swap)/.test(content);
  if (addsDocumentListener && !removesDocumentListener && !explicitAstroRuntime) {
    warnings.push(`${rel}: document event listener is persistent; verify this is intentional runtime state`);
  }

  if (/\bsetTimeout\s*\(/.test(content) && !/\bclearTimeout\s*\(/.test(content)) {
    warnings.push(`${rel}: one-shot timeout has no explicit unmount cleanup`);
  }
}

const allFiles = await walk(pagesRoot);
const pageFiles = allFiles.filter((file) => file.endsWith('.astro')).sort();
const componentFiles = (await walk(componentsRoot))
  .filter((file) => /\.(?:tsx|jsx|ts|js)$/.test(file) && !/\.backup(?:[-.]|$)/.test(file))
  .sort();
const routeSource = await readFile(routesFile, 'utf8');
const astroConfig = await readFile(astroConfigFile, 'utf8');
const sidebarSource = await readFile(sidebarFile, 'utf8');

for (const file of pageFiles) {
  const content = await readFile(file, 'utf8');
  const rel = relPath(file);

  if (!content.trim()) failures.push(`${rel}: empty Astro page`);
  if (!hasValidPageOutput(content)) warnings.push(`${rel}: no obvious render, redirect, or Response output`);

  if (content.includes('__OPC_NO_MOTION_VIEW_TRANSITIONS__') && !content.includes('document.startViewTransition')) {
    failures.push(`${rel}: legacy transition marker without transition implementation`);
  }

  auditLifecycle(file, content, { astroPage: true });
}

for (const file of componentFiles) {
  const content = await readFile(file, 'utf8');
  auditLifecycle(file, content);
}

const routeMatches = [...routeSource.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*:\s*['"](\/[^'"]*|\/)['"]/g)];
const routes = routeMatches.map((match) => ({ key: match[1], path: match[2] }));

for (const route of routes) {
  const candidates = routeCandidates(route.path);
  let resolved = false;

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      resolved = true;
      break;
    }
  }

  if (!resolved) {
    const clean = route.path.replace(/^\/+|\/+$/g, '');
    const listPage = join(pagesRoot, `${clean}.astro`);
    const dynamicChildren = [
      join(pagesRoot, clean, '[id].astro'),
      join(pagesRoot, clean, '[reportId].astro'),
      join(pagesRoot, clean, '[jobId].astro'),
    ];

    if (await exists(listPage)) resolved = true;
    if (!resolved) {
      for (const child of dynamicChildren) {
        if (await exists(child)) {
          resolved = true;
          break;
        }
      }
    }
  }

  if (!resolved) failures.push(`OPC_ROUTES.${route.key} -> ${route.path}: no matching Astro page or catch-all route`);
}

const bannedProductionRoutes = [
  'src/pages/api/diagnostic.ts',
  'src/pages/api/supabase-test.ts',
  'src/pages/api/test-clients.ts',
  'src/pages/api/test-login.ts',
  'src/pages/api/test-google-api.ts',
  'src/pages/api/tickets/test-create.ts',
  'src/pages/api/tools/business-scraper/diagnose.ts',
  'src/pages/supabase-diagnostic.astro',
  'src/pages/verify-supabase.astro',
  'src/pages/work-os/debug-auth.astro',
  'src/pages/test-login.astro',
  'src/pages/test-file-upload.astro',
  'src/pages/test-client-detail.astro',
  'src/pages/test-chat.astro',
  'src/pages/test-react.astro',
  'src/pages/test-render.astro',
  'src/pages/test.astro',
  'src/pages/diagnostic-tree-view.astro',
  'src/pages/index.before-clean-rollback.astro',
  'src/pages/index.miraka-backup.astro',
];

for (const rel of bannedProductionRoutes) {
  if (await exists(join(root, rel))) failures.push(`${rel}: public diagnostic/test route must not ship to production`);
}

if (!astroConfig.includes('OPC_VIEW_TRANSITION_COMPAT_V2')) failures.push('astro.config.mjs: missing OPC_VIEW_TRANSITION_COMPAT_V2 runtime guard');
if (!astroConfig.includes("typeof transitionInput.update === 'function'")) failures.push('astro.config.mjs: view-transition guard does not execute options.update()');
if (!sidebarSource.includes('data-astro-reload="true"')) failures.push('MirakaSidebar.tsx: desktop navigation is not explicitly protected by full-page reload');

const primaryPages = [
  'dashboard.astro',
  'kunden.astro',
  'mitarbeiter.astro',
  'anfragen.astro',
  'besichtigungen.astro',
  'kalender.astro',
  'einsaetze.astro',
  'zeiterfassung.astro',
  'anfragen-schaeden.astro',
  'qr-codes.astro',
  'berichte-dateien.astro',
  'finanzen.astro',
  'rechnungsautomationen.astro',
  'einstellungen.astro',
];

for (const page of primaryPages) {
  if (!await exists(join(pagesRoot, page))) failures.push(`primary page missing: src/pages/${page}`);
}

console.log(`App page integrity audit: ${pageFiles.length} Astro pages, ${routes.length} OPC route entries, ${componentFiles.length} runtime component files.`);
console.log('Navigation integrity: Astro 5 transition compatibility guard present; primary desktop navigation is hard-reload protected.');
console.log('Lifecycle integrity: Astro pages and React components checked for unsafe DOMContentLoaded mounts, observer leaks, interval leaks, realtime leaks, and auth subscription leaks.');
console.log('Security integrity: public diagnostic/test routes are excluded from production.');

if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (failures.length) {
  console.error(`Integrity failures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('App page integrity verified.');
