#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const target = path.join(root, 'src/components/SettingsPageTranslated.tsx');

if (!fs.existsSync(target)) {
  console.error(`Nicht gefunden: ${target}`);
  process.exit(1);
}

let source = fs.readFileSync(target, 'utf8');
const original = source;

const importLine = "import OwnerDataExportButton from './OwnerDataExportButton';";
if (!source.includes(importLine)) {
  const anchor = "import PortalSkeleton from './shared/PortalSkeleton';";
  if (!source.includes(anchor)) {
    console.error('Import-Anker PortalSkeleton wurde nicht gefunden. Keine Datei verändert.');
    process.exit(2);
  }
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

const alreadyPresent =
  source.includes('Unternehmensdaten exportieren') &&
  source.includes('<OwnerDataExportButton') &&
  source.includes('scope="all"');

if (!alreadyPresent) {
  const block = `\n\n          <div\n            data-opc-owner-full-export=\"true\"\n            style={{\n              marginTop: '20px',\n              padding: '16px',\n              borderRadius: '18px',\n              border: \`1px solid \${BRAND.border}\`,\n              background: '#FAFAFA',\n            }}\n          >\n            <div\n              style={{\n                marginBottom: '10px',\n                fontSize: '15px',\n                fontWeight: 850,\n                color: BRAND.text,\n              }}\n            >\n              Unternehmensdaten exportieren\n            </div>\n\n            <div style={{ marginBottom: '12px', color: BRAND.muted, fontSize: '13px', lineHeight: 1.5 }}>\n              Der aktuelle Unternehmensdatenbestand wird als aufbereitete CSV-Dateien ausschließlich an die E-Mail-Adresse des authentifizierten Owner-Kontos gesendet.\n            </div>\n\n            <OwnerDataExportButton\n              scope=\"all\"\n              label=\"Gesamten Datenbestand per E-Mail anfordern\"\n            />\n          </div>`;

  const saveButtonNeedle = `<div style={buttonRowStyle}>\n            <button type=\"button\" disabled={saving} onClick={handleSaveSystem} style={primaryButtonStyle}>`;

  if (source.includes(saveButtonNeedle)) {
    source = source.replace(saveButtonNeedle, `${block}\n\n          ${saveButtonNeedle}`);
  } else {
    const systemCloseNeedle = `        </section>\n      )}\n\n      <style>{\``;
    if (!source.includes(systemCloseNeedle)) {
      console.error('System-Tab-Anker wurde nicht gefunden. Keine Datei verändert.');
      process.exit(3);
    }
    source = source.replace(systemCloseNeedle, `${block}\n        </section>\n      )}\n\n      <style>{\``);
  }
}

if (source === original) {
  console.log('Owner-Datenexport ist bereits korrekt in Einstellungen eingebunden.');
  process.exit(0);
}

const backup = `${target}.before-owner-export-${Date.now()}.bak`;
fs.copyFileSync(target, backup);
fs.writeFileSync(target, source, 'utf8');

console.log('Owner-Datenexport wurde in Einstellungen wiederhergestellt.');
console.log(`Backup: ${backup}`);
console.log('Route: /einstellungen -> System -> Unternehmensdaten exportieren');
