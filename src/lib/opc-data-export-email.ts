function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildOpcDataExportEmailHtml(input: {
  scopeLabel: string;
  recipientEmail: string;
  generatedAt: string;
  fileNames: string[];
  rowCount: number;
  batchNumber?: number;
  batchCount?: number;
}) {
  const files = input.fileNames
    .map(
      (name) =>
        `<li style="margin:0 0 5px 0;">${escapeHtml(name)}</li>`,
    )
    .join('');

  const batch =
    Number(input.batchCount || 1) > 1
      ? `<p style="margin:0 0 20px 0;font-size:13px;line-height:18px;color:#555;">
          Teil ${Number(input.batchNumber || 1)} von ${Number(input.batchCount || 1)}
        </p>`
      : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;background:#f2f2f2;">
<tr>
<td align="center">

<table cellpadding="0" cellspacing="0" style="max-width:540px;width:90%;background:#ffffff;border-radius:20px;margin:0 auto;overflow:hidden;">

<tr>
<td style="background:#f7931e;padding:28px 32px;text-align:left;">
<img
src="https://cdn.prod.website-files.com/6944470386300e196e5fc347/69495340f6a0fe99fed87217_WHITE%20ORANGE%20PRO%20CLEAN%20LOGO%20ORIGINAL.png"
width="65"
alt="Orange Pro Clean GmbH"
style="display:block;"
>
</td>
</tr>

<tr>
<td style="padding:32px 32px 20px 32px;">
<h1 style="font-family:Helvetica,Arial,sans-serif;font-size:36px;line-height:38px;font-weight:900;text-transform:uppercase;color:#1a1a1a;margin:0;">
IHR DATENEXPORT
</h1>
</td>
</tr>

<tr>
<td style="padding:0 32px 32px 32px;color:#1a1a1a;">

<p style="margin:0 0 20px 0;font-size:15px;line-height:21px;">
Der im Orange Pro Clean Portal angeforderte Unternehmensdatenexport wurde erstellt.
</p>

<p style="margin:0 0 8px 0;font-size:15px;line-height:20px;font-weight:700;">
${escapeHtml(input.scopeLabel)}
</p>

<p style="margin:0 0 20px 0;font-size:13px;line-height:19px;color:#555;">
Stand: ${escapeHtml(input.generatedAt)}<br>
Datensätze: ${escapeHtml(input.rowCount)}<br>
Empfänger: ${escapeHtml(input.recipientEmail)}
</p>

${batch}

<div style="margin:0 0 22px 0;padding:16px;border-radius:14px;background:#f7f7f7;border:1px solid #eeeeee;">
<p style="margin:0 0 10px 0;font-size:13px;font-weight:700;">
Enthaltene Dateien
</p>
<ul style="margin:0;padding-left:18px;font-size:12px;line-height:18px;color:#444;">
${files}
</ul>
</div>

<p style="margin:0 0 22px 0;font-size:12px;line-height:18px;color:#666;">
Die Dateien enthalten ausschließlich für den Unternehmensbetrieb aufbereitete Daten.
Interne Datenbankkennungen, System-Metadaten und technische Authentifizierungsinformationen
werden nicht exportiert. AHV-Nummern werden maskiert dargestellt.
</p>

<p style="margin:0 0 4px 0;font-size:15px;line-height:18px;">
Freundliche Grüsse<br>
Ihr Orange Pro Clean Team
</p>

<p style="margin:10px 0 0 0;font-size:10px;line-height:13px;">
Orange Pro Clean GmbH<br>
<a href="mailto:info@orangeproclean.ch" style="color:#1a1a1a;text-decoration:none;">info@orangeproclean.ch</a><br>
<a href="https://www.orangeproclean.ch" style="color:#1a1a1a;text-decoration:none;">www.orangeproclean.ch</a><br>
<a href="https://maps.app.goo.gl/CZRD3axnahsaVYME8" style="color:#f7931e;text-decoration:none;">
Hagmattstrasse 7a, 4123 Allschwil, Schweiz
</a>
</p>

</td>
</tr>

<tr>
<td style="padding:20px 32px;text-align:center;border-top:1px solid #eeeeee;">
<p style="font-size:9px;line-height:13px;color:#777;margin:0;">
Diese E-Mail wurde aufgrund einer authentifizierten Datenexport-Anfrage
im Orange Pro Clean Portal automatisch versendet.
Der Export wird ausschließlich an die im authentifizierten Benutzerkonto
hinterlegte E-Mail-Adresse übermittelt.
<br><br>
<a href="https://www.orangeproclean.ch/datenschutz" style="color:#777;text-decoration:underline;">
Datenschutz
</a>
</p>
</td>
</tr>

</table>

</td>
</tr>
</table>
</body>
</html>`;
}
