import * as XLSX from 'xlsx';
import { Inspection } from '../types';

/**
 * Exporte l'ensemble des contrôles d'hygiène vers un classeur Excel (.xlsx)
 * avec les 15 colonnes strictement ordonnées selon les exigences qualité :
 * 1. Référence Contrôle (nom fournisseur-année-semaine)
 * 2. Date
 * 3. Heure
 * 4. Semaine
 * 5. Fournisseur
 * 6. Chauffeur
 * 7. Contrôleur
 * 8. Catégorie
 * 9. Code Critère
 * 10. Critères
 * 11. Évaluation
 * 12. Observation
 * 13. Photo
 * 14. Statut Global
 * 15. Taux de Conformité
 */
export function exportInspectionsToExcel(inspections: Inspection[], filenamePrefix = 'Controles_Hygiene_Lait'): void {
  if (!inspections || inspections.length === 0) {
    alert('Aucun contrôle à exporter.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // 1. FEUILLE 1 : DETAIL CRITERES (15 colonnes sans redondance inutile)
  const detailedRows: Array<Record<string, string | number>> = [];

  inspections.forEach((insp) => {
    const year = insp.date ? insp.date.slice(0, 4) : '2026';
    const week = insp.week || 'S01';
    // 1- Référence Contrôle est nom fournisseur-année-semaine
    const refControle = `${insp.supplier || 'FOURNISSEUR'}-${year}-${week}`;

    insp.criteriaResults.forEach((crit, critIndex) => {
      const evalVal =
        crit.value === '1'
          ? '1'
          : crit.value === '0'
          ? '0'
          : crit.value === 'NA'
          ? 'N.A'
          : (crit.value || '');

      const isFirstRowOfInspection = critIndex === 0;

      detailedRows.push({
        'Référence Contrôle': isFirstRowOfInspection ? refControle : '',
        'Date': isFirstRowOfInspection ? insp.date : '',
        'Heure': isFirstRowOfInspection ? insp.time : '',
        'Semaine': isFirstRowOfInspection ? (insp.week || week) : '',
        'Fournisseur': isFirstRowOfInspection ? insp.supplier : '',
        'Chauffeur': isFirstRowOfInspection ? (insp.driverName || 'N/A') : '',
        'Contrôleur': isFirstRowOfInspection ? insp.inspectorName : '',
        'Catégorie': crit.category,
        'Code Critère': crit.code,
        'Critères': crit.label,
        'Évaluation': evalVal,
        'Observation': crit.observation || '',
        'Photo': crit.photos && crit.photos.length > 0 ? `${crit.photos.length} photo(s)` : '0',
        'Statut Global': isFirstRowOfInspection ? insp.globalStatus : '',
        'Taux de Conformité': isFirstRowOfInspection ? `${insp.complianceRate}%` : '',
      });
    });
  });

  const wsDetailed = XLSX.utils.json_to_sheet(detailedRows);
  // Ajuster la largeur des 15 colonnes
  wsDetailed['!cols'] = [
    { wch: 28 }, // 1. Référence Contrôle (nom fournisseur-année-semaine)
    { wch: 12 }, // 2. Date
    { wch: 9 },  // 3. Heure
    { wch: 10 }, // 4. Semaine
    { wch: 24 }, // 5. Fournisseur
    { wch: 20 }, // 6. Chauffeur
    { wch: 28 }, // 7. Contrôleur
    { wch: 24 }, // 8. Catégorie
    { wch: 14 }, // 9. Code Critère
    { wch: 55 }, // 10. Critères
    { wch: 14 }, // 11. Évaluation
    { wch: 40 }, // 12. Observation
    { wch: 12 }, // 13. Photo
    { wch: 20 }, // 14. Statut Global
    { wch: 20 }, // 15. Taux de Conformité
  ];

  XLSX.utils.book_append_sheet(wb, wsDetailed, 'Détail Contrôles (15 col)');

  // 2. FEUILLE 2 : SYNTHÈSE DES FICHES DE CONTRÔLE
  const summaryRows = inspections.map((insp) => {
    const year = insp.date ? insp.date.slice(0, 4) : '2026';
    const week = insp.week || 'S01';
    const refControle = `${insp.supplier || 'FOURNISSEUR'}-${year}-${week}`;

    return {
      'Référence Contrôle': refControle,
      'Date': insp.date,
      'Heure': insp.time,
      'Semaine': insp.week || week,
      'Fournisseur': insp.supplier,
      'Chauffeur': insp.driverName || 'N/A',
      'Contrôleur': insp.inspectorName,
      'Statut Global': insp.globalStatus,
      'Taux de Conformité': `${insp.complianceRate}%`,
      'Critères Conformes (1)': insp.totalCompliant,
      'Non-Conformités (0)': insp.totalNonCompliant,
      'Non Applicables (N.A)': insp.totalNA,
      'Total Critères': insp.totalEvaluated,
      'Observation Générale': insp.otherObservations || '',
    };
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 28 },
    { wch: 12 },
    { wch: 9 },
    { wch: 10 },
    { wch: 24 },
    { wch: 20 },
    { wch: 28 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 14 },
    { wch: 45 },
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Synthèse Fiches');

  // 3. FEUILLE 3 : ANOMALIES & FREQUENCE CRITERES
  const criteriaStatsMap: Record<
    string,
    { code: string; label: string; section: string; totalEvaluations: number; nonCompliantCount: number }
  > = {};

  inspections.forEach((insp) => {
    insp.criteriaResults.forEach((crit) => {
      if (!criteriaStatsMap[crit.criterionId]) {
        criteriaStatsMap[crit.criterionId] = {
          code: crit.code,
          label: crit.label,
          section: crit.sectionTitle,
          totalEvaluations: 0,
          nonCompliantCount: 0,
        };
      }
      criteriaStatsMap[crit.criterionId].totalEvaluations++;
      if (crit.value === '0') {
        criteriaStatsMap[crit.criterionId].nonCompliantCount++;
      }
    });
  });

  const statsRows = Object.values(criteriaStatsMap)
    .sort((a, b) => b.nonCompliantCount - a.nonCompliantCount)
    .map((item) => {
      const rate =
        item.totalEvaluations > 0
          ? ((item.nonCompliantCount / item.totalEvaluations) * 100).toFixed(1)
          : '0';
      return {
        'Code Critère': item.code,
        Section: item.section,
        'Critère Contrôlé': item.label,
        'Total Évaluations': item.totalEvaluations,
        'Nombre Non-Conformités': item.nonCompliantCount,
        'Fréquence (n/x)': `${item.nonCompliantCount}/${item.totalEvaluations} (${item.nonCompliantCount} fois sur ${item.totalEvaluations})`,
        'Taux Anomalie (%)': `${rate}%`,
        'Niveau Risque':
          item.nonCompliantCount === 0
            ? 'Faible'
            : item.nonCompliantCount >= 2
            ? 'Élevé - Priorité HACCP'
            : 'Moyen',
      };
    });

  const wsStats = XLSX.utils.json_to_sheet(statsRows);
  wsStats['!cols'] = [
    { wch: 14 },
    { wch: 35 },
    { wch: 45 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, wsStats, 'Stats & Risques Qualité');

  // Génération et téléchargement
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}_${dateStr}.xlsx`);
}

