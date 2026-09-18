import { Inspection } from '../types';
import { getStoredCriteria } from './storage';

/**
 * Génère le code HTML complet et autonome d'une fiche officielle imprimable A4.
 * Ce document inclut des styles CSS stricts pour imprimante (format A4, marges propres,
 * bordures nettes, contrastes élevés, cachets de validation et zones de signatures).
 */
export function generatePrintableHTML(inspection: Inspection): string {
  const isCompliant = inspection.globalStatus === 'CONFORME';
  const section1 = inspection.criteriaResults.filter((c) => c.sectionId === 'vehicule_bidons');
  const section2 = inspection.criteriaResults.filter((c) => c.sectionId === 'personnel');

  const statusColor = isCompliant ? '#15803d' : '#b91c1c';
  const statusBg = isCompliant ? '#f0fdf4' : '#fef2f2';
  const statusBorder = isCompliant ? '#86efac' : '#fca5a5';

  const storedCriteria = getStoredCriteria();
  const formatRows = (criteria: typeof section1) =>
    criteria
      .map((c) => {
        const isZero = c.value === '0';
        const valLabel = c.value === '1' ? '1' : c.value === '0' ? '0' : 'N.A';
        const badgeBg = c.value === '1' ? '#dcfce7' : c.value === '0' ? '#fee2e2' : '#f1f5f9';
        const badgeColor = c.value === '1' ? '#166534' : c.value === '0' ? '#991b1b' : '#334155';
        const rowBg = isZero ? '#fff1f2' : '#ffffff';
        const def = storedCriteria.find((item) => item.id === c.criterionId || item.code === c.code);

        return `
        <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 8px; text-align: center; font-weight: bold; font-family: monospace; color: #475569; width: 45px;">
            ${c.code}
          </td>
          <td style="padding: 6px 8px; font-weight: 600; color: #0f172a;">
            <div>${c.label}</div>
            ${def?.description ? `<div style="font-size: 9.5px; color: #64748b; font-weight: normal; margin-top: 2px;">${def.description}</div>` : ''}
          </td>
          <td style="padding: 6px 8px; text-align: center; width: 60px;">
            <span style="display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 800; border-radius: 4px; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${isZero ? '#f87171' : '#cbd5e1'};">
              ${valLabel}
            </span>
          </td>
          <td style="padding: 6px 8px; font-size: 11px; color: ${isZero ? '#991b1b' : '#334155'}; font-weight: ${isZero ? 'bold' : 'normal'};">
            ${c.observation ? c.observation : ''}
          </td>
        </tr>
      `;
      })
      .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Check Véhicule - ${inspection.reference}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 12px;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-left h1 {
      margin: 2px 0;
      font-size: 17px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.02em;
      color: #0f172a;
    }
    .header-left .sub {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .header-left .desc {
      font-size: 10px;
      color: #475569;
      margin-top: 2px;
    }
    .stamp {
      border: 2px solid ${statusColor};
      background: ${statusBg};
      color: ${statusColor};
      padding: 6px 14px;
      border-radius: 8px;
      text-align: center;
      min-width: 140px;
    }
    .stamp-title {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .stamp-status {
      font-size: 15px;
      font-weight: 900;
      line-height: 1.2;
    }
    .stamp-rate {
      font-size: 10px;
      font-weight: 700;
      margin-top: 2px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .meta-table td {
      padding: 6px 10px;
      font-size: 11px;
      border: 1px solid #e2e8f0;
    }
    .meta-label {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: bold;
      color: #64748b;
      display: block;
    }
    .meta-val {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    .section-title {
      background: #1e3a8a;
      color: #ffffff;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 800;
      margin-top: 10px;
      margin-bottom: 0;
      border-radius: 4px 4px 0 0;
      display: flex;
      justify-content: space-between;
    }
    table.criteria-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      border: 1px solid #cbd5e1;
      margin-bottom: 8px;
    }
    table.criteria-table th {
      background: #f1f5f9;
      color: #334155;
      text-transform: uppercase;
      font-size: 9px;
      font-weight: 800;
      padding: 5px 8px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }
    .observations-box {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      padding: 8px 10px;
      border-radius: 6px;
      margin: 10px 0;
    }
    .observations-box strong {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 2px;
    }
    .signatures {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      padding-top: 8px;
      page-break-inside: avoid;
    }
    .sig-box {
      flex: 1;
      border: 1px solid #94a3b8;
      border-radius: 6px;
      padding: 8px 12px;
      min-height: 80px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #ffffff;
    }
    .sig-label {
      font-weight: bold;
      font-size: 10px;
      color: #1e293b;
    }
    .sig-line {
      border-top: 1px dashed #94a3b8;
      padding-top: 4px;
      font-size: 9.5px;
      color: #64748b;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="sub" style="font-size: 11px; font-weight: 900; color: #334155; letter-spacing: 0.05em;">SERVICE SQH</div>
      <h1 style="margin: 2px 0; font-size: 16px; font-weight: 900; text-transform: uppercase; color: #0f172a;">Contrôle hygiène véhicule de livraison lait</h1>
      <div class="desc" style="font-size: 11px; margin-top: 3px; color: #334155;">
        <strong>Résultat final :</strong>
        <span style="font-weight: 800; padding: 1px 6px; border-radius: 4px; background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; font-size: 10px;">${inspection.globalStatus}</span>
        <span style="color: #64748b; font-size: 10px; margin-left: 4px;">(Taux : ${inspection.complianceRate}%)</span>
      </div>
    </div>
    <div class="stamp" style="border: 1.5px solid #cbd5e1; background: #f8fafc; color: #0f172a; min-width: 170px; text-align: right; padding: 6px 12px;">
      <div class="stamp-title" style="color: #64748b; font-size: 9px;">Référence</div>
      <div class="stamp-status" style="font-size: 14px; font-family: monospace; font-weight: 900; color: #1d4ed8;">${inspection.reference}</div>
      <div class="stamp-rate" style="color: #64748b; font-size: 9.5px; font-weight: 600;">Semaine ${inspection.week || ''}</div>
    </div>
  </div>

  <table class="meta-table">
    <tr>
      <td style="width: 25%;">
        <span class="meta-label">Réf. Contrôle</span>
        <span class="meta-val" style="font-family: monospace; color: #1d4ed8;">${inspection.reference}</span>
      </td>
      <td style="width: 25%;">
        <span class="meta-label">Date & Heure</span>
        <span class="meta-val">${inspection.date} à ${inspection.time}</span>
      </td>
      <td style="width: 25%;">
        <span class="meta-label">Fournisseur de Lait</span>
        <span class="meta-val" style="color: #0f172a;">${inspection.supplier}</span>
      </td>
      <td style="width: 25%;">
        <span class="meta-label">Semaine S:</span>
        <span class="meta-val" style="font-family: monospace; color: #1d4ed8;">${inspection.week || 'N/A'}</span>
      </td>
    </tr>
    <tr>
      <td colspan="2">
        <span class="meta-label">Chauffeur / Opérateur Livreur</span>
        <span class="meta-val">${inspection.driverName || 'Non renseigné'}</span>
      </td>
      <td colspan="2">
        <span class="meta-label">Contrôleur Qualité / Réceptionnaire</span>
        <span class="meta-val">${inspection.inspectorName}</span>
      </td>
    </tr>
  </table>

  <!-- SECTION 1 -->
  <div class="section-title">
    <span>Section 1 : États et propreté véhicules/bidons à la réception des laits</span>
    <span style="font-size: 9px; opacity: 0.85;">Catégorie A. Camion & Bidons</span>
  </div>
  <table class="criteria-table">
    <thead>
      <tr>
        <th style="width: 45px; text-align: center;">N°</th>
        <th>Critère de Contrôle Hygiène</th>
        <th style="width: 110px; text-align: center;">Évaluation</th>
        <th>Observations & Non-conformités</th>
      </tr>
    </thead>
    <tbody>
      ${formatRows(section1)}
    </tbody>
  </table>

  <!-- SECTION 2 -->
  <div class="section-title">
    <span>Section 2 : Personnel faisant la manipulation</span>
    <span style="font-size: 9px; opacity: 0.85;">Section B. Hygiène du personnel</span>
  </div>
  <table class="criteria-table">
    <thead>
      <tr>
        <th style="width: 45px; text-align: center;">N°</th>
        <th>Critère de Contrôle Hygiène</th>
        <th style="width: 110px; text-align: center;">Évaluation</th>
        <th>Observations & Non-conformités</th>
      </tr>
    </thead>
    <tbody>
      ${formatRows(section2)}
    </tbody>
  </table>

  <!-- REMARQUES -->
  <div class="observations-box">
    <strong>Autres observations générales :</strong>
    <div style="font-style: italic; color: #1e293b; font-size: 11px;">
      ${inspection.otherObservations || 'Aucune remarque générale supplémentaire mentionnée.'}
    </div>
  </div>

  <!-- SIGNATURES -->
  <div class="signatures">
    <div class="sig-box">
      <div class="sig-label">Visa & Signature du Chauffeur - Livreur :</div>
      <div class="sig-line">Nom lisible : ${inspection.driverName || '................................................'}</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Visa & Signature du Contrôleur Qualité :</div>
      <div class="sig-line">Nom lisible : ${inspection.inspectorName}</div>
    </div>
  </div>

  <div style="text-align: center; font-size: 9px; color: #94a3b8; margin-top: 10px;">
    Document officiel généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • Système Digitalisé HACCP Réception Lait
  </div>
</body>
</html>`;
}

/**
 * Déclenche l'impression de la fiche.
 * Utilise une iframe cachée en priorité, et bascule vers une ouverture de fenêtre
 * ou un téléchargement HTML prêt à l'impression si le navigateur bloque les modales dans l'iframe.
 */
export function printInspection(inspection: Inspection): void {
  const htmlContent = generatePrintableHTML(inspection);

  try {
    // 1. Essai via une iframe invisible intégrée au DOM courant
    const iframe = document.createElement('iframe');
    iframe.id = 'print_inspection_iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      setTimeout(() => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } else {
            fallbackDirectPrint(htmlContent, inspection.reference);
          }
        } catch (printErr) {
          console.warn('Iframe print bloqué par la sandbox du navigateur, recours au fallback', printErr);
          fallbackDirectPrint(htmlContent, inspection.reference);
        } finally {
          setTimeout(() => {
            const existing = document.getElementById('print_inspection_iframe');
            if (existing) document.body.removeChild(existing);
          }, 3000);
        }
      }, 350);
      return;
    }
  } catch (err) {
    console.warn('Impossible de créer iframe de print', err);
  }

  // Si l'iframe échoue, utiliser le fallback
  fallbackDirectPrint(htmlContent, inspection.reference);
}

/**
 * Fallback si le navigateur bloque window.print() dans les iframes :
 * Ouvre une nouvelle fenêtre avec le document prêt ou propose le téléchargement HTML imprimable
 */
export function fallbackDirectPrint(html: string, reference: string): void {
  try {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch {
          // Si print est bloqué par popup
        }
      }, 300);
      return;
    }
  } catch (e) {
    console.warn('Popup bloqué', e);
  }

  // Fallback ultime : téléchargement direct du fichier HTML prêt à imprimer (Ctrl+P)
  downloadPrintableSheetHTML(html, reference);
}

/**
 * Télécharge la fiche de contrôle sous forme de document HTML stylisé A4
 * que l'utilisateur peut ouvrir dans n'importe quel navigateur pour l'imprimer ou l'enregistrer en PDF.
 */
export function downloadPrintableSheetHTML(html: string, reference: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Fiche_Controle_${reference}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
