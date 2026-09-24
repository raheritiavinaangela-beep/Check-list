import React, { useMemo, useState } from 'react';
import { Inspection } from '../types';
import { exportInspectionsToExcel } from '../services/excelExport';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ShieldCheck,
  Truck,
  Users,
  ArrowRight,
  ChevronRight,
  Calendar,
  Layers,
  Percent,
  Hash,
  Sparkles,
  Info,
  XCircle,
  Table,
  LayoutGrid,
} from 'lucide-react';

interface AnalyticsViewProps {
  inspections: Inspection[];
  onNavigateToNonCompliant?: () => void;
  onNavigateToCriterion?: (criterionCode: string, criterionLabel: string) => void;
  onNavigateToHistory?: (filter: {
    statusFilter?: 'ALL' | 'CONFORME' | 'NON CONFORME';
    criterionCode?: string | null;
    criterionLabel?: string | null;
  }) => void;
}

export interface WeekStatItem {
  weekKey: string;
  weekCode: string;
  year: number;
  dateRangeStr: string;
  mondayTimestamp: number;
  totalInspections: number;
  compliantCount: number;
  nonCompliantCount: number;
  totalAnomalies: number;
  complianceRate: number; // 0..100
  nonComplianceRate: number; // 0..100
  suppliers: {
    supplierName: string;
    driverName: string;
    globalStatus: 'CONFORME' | 'NON CONFORME' | 'EN COURS';
    anomalies: number;
    reference: string;
  }[];
}

function calculateWeekInfo(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return null;

    // Jour de la semaine (Lundi = 0 ... Dimanche = 6)
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Numéro de semaine ISO 8601
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    const year = monday.getFullYear();

    const pad = (n: number) => n.toString().padStart(2, '0');
    const weekCode = `S${pad(weekNumber)}`;
    const weekKey = `${year}-W${pad(weekNumber)}`;
    const dateRangeStr = `${pad(monday.getDate())}/${pad(monday.getMonth() + 1)} au ${pad(sunday.getDate())}/${pad(sunday.getMonth() + 1)}`;

    return {
      weekKey,
      weekCode,
      year,
      dateRangeStr,
      mondayTimestamp: monday.getTime(),
    };
  } catch {
    return null;
  }
}

const MONTH_NAMES_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function getMonthInfo(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const monthKey = `${year}-${pad(monthIndex + 1)}`;
    const monthLabel = `${MONTH_NAMES_FR[monthIndex]} ${year}`;
    const timestamp = new Date(year, monthIndex, 1).getTime();
    return { monthKey, monthLabel, year, monthIndex, timestamp };
  } catch {
    return null;
  }
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  inspections,
  onNavigateToNonCompliant,
  onNavigateToCriterion,
  onNavigateToHistory,
}) => {
  const [chartMode, setChartMode] = useState<'rate' | 'count'>('rate');
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [supplierMonthKey, setSupplierMonthKey] = useState<string>('auto');
  const [supplierViewMode, setSupplierViewMode] = useState<'cards' | 'table'>('cards');

  const handleGoNonCompliant = () => {
    if (onNavigateToHistory) {
      onNavigateToHistory({ statusFilter: 'NON CONFORME', criterionCode: null, criterionLabel: null });
    } else if (onNavigateToNonCompliant) {
      onNavigateToNonCompliant();
    }
  };

  const handleGoCriterion = (code: string, label: string) => {
    if (onNavigateToHistory) {
      onNavigateToHistory({ statusFilter: 'NON CONFORME', criterionCode: code, criterionLabel: label });
    } else if (onNavigateToCriterion) {
      onNavigateToCriterion(code, label);
    }
  };

  const stats = useMemo(() => {
    const total = inspections.length;
    if (total === 0) {
      return {
        total: 0,
        compliantCount: 0,
        nonCompliantCount: 0,
        globalComplianceRate: 0,
        globalNonComplianceRate: 0,
        totalAnomalies: 0,
        criteriaStats: [],
        supplierStats: [],
        weeklyStats: [] as WeekStatItem[],
        sectionStats: { vehicule: { total: 0, nc: 0 }, personnel: { total: 0, nc: 0 } },
      };
    }

    const compliantCount = inspections.filter((i) => i.globalStatus === 'CONFORME').length;
    const nonCompliantCount = inspections.filter((i) => i.globalStatus === 'NON CONFORME').length;
    const globalComplianceRate = Math.round((compliantCount / total) * 100);
    const globalNonComplianceRate = 100 - globalComplianceRate;

    let totalAnomalies = 0;
    const criteriaMap: Record<
      string,
      { code: string; label: string; sectionTitle: string; sectionId: string; count: number; totalEval: number }
    > = {};

    const supplierMap: Record<
      string,
      { name: string; totalInspections: number; compliant: number; nonCompliant: number }
    > = {};

    const sectionStats = {
      vehicule: { total: 0, nc: 0 },
      personnel: { total: 0, nc: 0 },
    };

    const weeklyMap: Record<string, WeekStatItem> = {};

    // 4. Stats Fournisseurs groupées par Mois
    const monthlyGroupsMap: Record<
      string,
      {
        monthKey: string;
        monthLabel: string;
        timestamp: number;
        totalInspections: number;
        compliantCount: number;
        nonCompliantCount: number;
        totalAnomalies: number;
        suppliersMap: Record<
          string,
          {
            name: string;
            totalInspections: number;
            compliant: number;
            nonCompliant: number;
            totalAnomalies: number;
            inspectionsList: {
              reference: string;
              date: string;
              week: string;
              globalStatus: 'CONFORME' | 'NON CONFORME' | 'EN COURS';
              anomalies: number;
            }[];
          }
        >;
      }
    > = {};

    inspections.forEach((insp) => {
      // 1. Groupement hebdomadaire
      const weekInfo = calculateWeekInfo(insp.date) || {
        weekKey: insp.week || 'Semaine',
        weekCode: insp.week || 'S01',
        year: 2026,
        dateRangeStr: insp.date,
        mondayTimestamp: new Date(insp.date).getTime() || 0,
      };

      if (!weeklyMap[weekInfo.weekKey]) {
        weeklyMap[weekInfo.weekKey] = {
          weekKey: weekInfo.weekKey,
          weekCode: weekInfo.weekCode,
          year: weekInfo.year,
          dateRangeStr: weekInfo.dateRangeStr,
          mondayTimestamp: weekInfo.mondayTimestamp,
          totalInspections: 0,
          compliantCount: 0,
          nonCompliantCount: 0,
          totalAnomalies: 0,
          complianceRate: 0,
          nonComplianceRate: 0,
          suppliers: [],
        };
      }

      const weekItem = weeklyMap[weekInfo.weekKey];
      weekItem.totalInspections++;

      // Calcul des anomalies de cette fiche
      let inspAnomalies = 0;
      insp.criteriaResults?.forEach((c) => {
        if (c.value === '0') {
          inspAnomalies++;
        }
      });

      if (insp.globalStatus === 'CONFORME') {
        weekItem.compliantCount++;
      } else {
        weekItem.nonCompliantCount++;
      }
      weekItem.totalAnomalies += inspAnomalies;

      weekItem.suppliers.push({
        supplierName: insp.supplier,
        driverName: insp.driverName,
        globalStatus: insp.globalStatus,
        anomalies: inspAnomalies,
        reference: insp.reference,
      });

      // 2. Stats Fournisseur Global
      if (!supplierMap[insp.supplier]) {
        supplierMap[insp.supplier] = {
          name: insp.supplier,
          totalInspections: 0,
          compliant: 0,
          nonCompliant: 0,
        };
      }
      supplierMap[insp.supplier].totalInspections++;
      if (insp.globalStatus === 'CONFORME') {
        supplierMap[insp.supplier].compliant++;
      } else {
        supplierMap[insp.supplier].nonCompliant++;
      }

      // 3. Stats Fournisseurs par Mois
      const mInfo = getMonthInfo(insp.date);
      if (mInfo) {
        if (!monthlyGroupsMap[mInfo.monthKey]) {
          monthlyGroupsMap[mInfo.monthKey] = {
            monthKey: mInfo.monthKey,
            monthLabel: mInfo.monthLabel,
            timestamp: mInfo.timestamp,
            totalInspections: 0,
            compliantCount: 0,
            nonCompliantCount: 0,
            totalAnomalies: 0,
            suppliersMap: {},
          };
        }
        const mGroup = monthlyGroupsMap[mInfo.monthKey];
        mGroup.totalInspections++;
        if (insp.globalStatus === 'CONFORME') {
          mGroup.compliantCount++;
        } else {
          mGroup.nonCompliantCount++;
        }
        mGroup.totalAnomalies += inspAnomalies;

        if (!mGroup.suppliersMap[insp.supplier]) {
          mGroup.suppliersMap[insp.supplier] = {
            name: insp.supplier,
            totalInspections: 0,
            compliant: 0,
            nonCompliant: 0,
            totalAnomalies: 0,
            inspectionsList: [],
          };
        }
        const supM = mGroup.suppliersMap[insp.supplier];
        supM.totalInspections++;
        if (insp.globalStatus === 'CONFORME') {
          supM.compliant++;
        } else {
          supM.nonCompliant++;
        }
        supM.totalAnomalies += inspAnomalies;
        supM.inspectionsList.push({
          reference: insp.reference,
          date: insp.date,
          week: insp.week || weekInfo.weekCode,
          globalStatus: insp.globalStatus,
          anomalies: inspAnomalies,
        });
      }

      // 4. Stats Critères
      insp.criteriaResults?.forEach((c) => {
        if (!criteriaMap[c.criterionId]) {
          criteriaMap[c.criterionId] = {
            code: c.code,
            label: c.label,
            sectionTitle: c.sectionTitle,
            sectionId: c.sectionId,
            count: 0,
            totalEval: 0,
          };
        }
        criteriaMap[c.criterionId].totalEval++;
        if (c.sectionId === 'vehicule_bidons') sectionStats.vehicule.total++;
        if (c.sectionId === 'personnel') sectionStats.personnel.total++;

        if (c.value === '0') {
          criteriaMap[c.criterionId].count++;
          totalAnomalies++;
          if (c.sectionId === 'vehicule_bidons') sectionStats.vehicule.nc++;
          if (c.sectionId === 'personnel') sectionStats.personnel.nc++;
        }
      });
    });

    // Finaliser les taux par semaine
    const weeklyStats = Object.values(weeklyMap).map((w) => {
      const compRate = w.totalInspections > 0 ? Math.round((w.compliantCount / w.totalInspections) * 100) : 0;
      return {
        ...w,
        complianceRate: compRate,
        nonComplianceRate: 100 - compRate,
      };
    });

    // Tri chronologique des semaines
    weeklyStats.sort((a, b) => a.mondayTimestamp - b.mondayTimestamp);

    // Finaliser les groupes mensuels de fournisseurs
    const monthlySupplierGroups = Object.values(monthlyGroupsMap)
      .map((g) => {
        const suppliers = Object.values(g.suppliersMap)
          .map((s) => ({
            ...s,
            complianceRate:
              s.totalInspections > 0 ? Math.round((s.compliant / s.totalInspections) * 100) : 0,
          }))
          .sort((a, b) => b.nonCompliant - a.nonCompliant || a.name.localeCompare(b.name));

        const compRate =
          g.totalInspections > 0 ? Math.round((g.compliantCount / g.totalInspections) * 100) : 0;
        return {
          ...g,
          complianceRate: compRate,
          suppliers,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    const criteriaStats = Object.values(criteriaMap).sort((a, b) => b.count - a.count);
    const supplierStats = Object.values(supplierMap).sort(
      (a, b) => b.nonCompliant - a.nonCompliant
    );

    return {
      total,
      compliantCount,
      nonCompliantCount,
      globalComplianceRate,
      globalNonComplianceRate,
      totalAnomalies,
      criteriaStats,
      supplierStats,
      monthlySupplierGroups,
      weeklyStats,
      sectionStats,
    };
  }, [inspections]);

  // Semaine sélectionnée dans l'histogramme ou le tableau
  const activeWeek = useMemo(() => {
    if (!selectedWeekKey && stats.weeklyStats.length > 0) {
      return stats.weeklyStats[stats.weeklyStats.length - 1]; // Par défaut la plus récente
    }
    return stats.weeklyStats.find((w) => w.weekKey === selectedWeekKey) || stats.weeklyStats[0] || null;
  }, [selectedWeekKey, stats.weeklyStats]);

  // Max pour l'échelle du graphique en mode Nombre
  const maxWeeklyCount = useMemo(() => {
    if (stats.weeklyStats.length === 0) return 5;
    const maxVal = Math.max(
      ...stats.weeklyStats.map((w) => Math.max(w.totalInspections, w.totalAnomalies))
    );
    return Math.max(maxVal + 1, 4);
  }, [stats.weeklyStats]);

  // Mois sélectionné pour le suivi qualité par fournisseur
  const isAllMonths = supplierMonthKey === 'all';
  const activeMonth = useMemo(() => {
    if (stats.monthlySupplierGroups.length === 0) return null;
    if (supplierMonthKey === 'auto') {
      return stats.monthlySupplierGroups[0]; // Mois le plus récent
    }
    if (supplierMonthKey === 'all') {
      return null;
    }
    return (
      stats.monthlySupplierGroups.find((m) => m.monthKey === supplierMonthKey) ||
      stats.monthlySupplierGroups[0]
    );
  }, [supplierMonthKey, stats.monthlySupplierGroups]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Tableau de bord qualité HACCP
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Analyses statistiques & Suivi Hebdomadaire
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Évolution hebdomadaire du taux de conformité, histogramme des anomalies et suivi qualité par fournisseur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3.5 py-2 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-200">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Total : {stats.total} véhicule{stats.total > 1 ? 's' : ''} contrôlé{stats.total > 1 ? 's' : ''}</span>
          </div>
          <button
            type="button"
            onClick={() => exportInspectionsToExcel(inspections)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>Exporter classeur Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* SECTION HISTOGRAMME HEBDOMADAIRE (REPRÉSENTATION GRAPHIQUE) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <BarChart3 className="w-5 h-5" />
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Histogramme Hebdomadaire des Contrôles & Non-Conformités
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Visualisation graphique de chaque semaine : comparez l'évolution des taux et le nombre d'anomalies relevées.
            </p>
          </div>

          {/* Commutateur de mode graphique */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartMode('rate')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'rate'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Percent className="w-3.5 h-3.5 text-blue-600" />
              <span>Taux (%) Conformité & Non-Conformité</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('count')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'count'
                  ? 'bg-white text-rose-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Hash className="w-3.5 h-3.5 text-rose-600" />
              <span>Nombre de Non-Conformités & Contrôles</span>
            </button>
          </div>
        </div>

        {stats.weeklyStats.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">Aucun contrôle enregistré pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Légende du graphique */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex flex-wrap items-center gap-4">
                {chartMode === 'rate' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500 shadow-2xs"></span>
                      <span className="font-semibold text-slate-700">Taux de Conformité (%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-sm bg-rose-500 shadow-2xs"></span>
                      <span className="font-semibold text-slate-700">Taux de Non-Conformité (%)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <span>(Objectif hygiène : 100% conforme)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-sm bg-rose-500 shadow-2xs"></span>
                      <span className="font-semibold text-slate-700">Nombre de Non-Conformités (Anomalies)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-sm bg-blue-600 shadow-2xs"></span>
                      <span className="font-semibold text-slate-700">Nombre de Contrôles Réalisés</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500 shadow-2xs"></span>
                      <span className="font-semibold text-slate-700">Véhicules 100% Conformes</span>
                    </div>
                  </>
                )}
              </div>

              <div className="text-[11px] text-slate-500 font-medium">
                Cliquez sur une semaine pour voir le détail des fournisseurs
              </div>
            </div>

            {/* Histogramme Graphique en Barres */}
            <div className="pt-6 pb-2 px-2 overflow-x-auto">
              <div
                className="min-w-[500px] flex items-end justify-around gap-6 h-64 border-b-2 border-slate-200 relative pt-6"
              >
                {/* Ligne repère 100% (si mode taux) */}
                {chartMode === 'rate' && (
                  <div className="absolute inset-x-0 top-6 border-b border-dashed border-emerald-300 pointer-events-none flex justify-between items-center text-[10px] text-emerald-600 px-1 font-bold">
                    <span>Objectif Laitier 100%</span>
                    <span>100%</span>
                  </div>
                )}

                {/* Barres pour chaque semaine */}
                {stats.weeklyStats.map((w) => {
                  const isSelected = activeWeek?.weekKey === w.weekKey;

                  return (
                    <div
                      key={w.weekKey}
                      onClick={() => setSelectedWeekKey(w.weekKey)}
                      className={`flex-1 flex flex-col items-center justify-end h-full group cursor-pointer transition-all ${
                        isSelected ? 'scale-102' : 'hover:scale-101 opacity-90 hover:opacity-100'
                      }`}
                    >
                      {/* Barres verticales côte-à-côte */}
                      <div className="w-full max-w-[110px] flex items-end justify-center gap-2 h-full pb-1">
                        {chartMode === 'rate' ? (
                          <>
                            {/* Barre Taux Conformité */}
                            <div className="flex-1 flex flex-col items-center justify-end h-full">
                              <span className="text-[11px] font-black text-emerald-700 mb-1">
                                {w.complianceRate}%
                              </span>
                              <div
                                style={{ height: `${Math.max(w.complianceRate, 4)}%` }}
                                className={`w-full rounded-t-lg transition-all ${
                                  w.complianceRate === 100
                                    ? 'bg-emerald-500 shadow-sm ring-2 ring-emerald-300/60'
                                    : 'bg-emerald-500'
                                } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                              />
                            </div>

                            {/* Barre Taux Non-Conformité */}
                            <div className="flex-1 flex flex-col items-center justify-end h-full">
                              <span className="text-[11px] font-black text-rose-700 mb-1">
                                {w.nonComplianceRate}%
                              </span>
                              <div
                                style={{ height: `${Math.max(w.nonComplianceRate, 4)}%` }}
                                className={`w-full rounded-t-lg bg-rose-500 transition-all ${
                                  isSelected ? 'ring-2 ring-blue-500' : ''
                                }`}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Barre Nombre Non-Conformités (Anomalies) */}
                            <div className="flex-1 flex flex-col items-center justify-end h-full">
                              <span className="text-[11px] font-black text-rose-700 mb-1">
                                {w.totalAnomalies}
                              </span>
                              <div
                                style={{
                                  height: `${Math.max((w.totalAnomalies / maxWeeklyCount) * 100, 5)}%`,
                                }}
                                className={`w-full rounded-t-lg bg-rose-500 transition-all ${
                                  isSelected ? 'ring-2 ring-blue-500' : ''
                                }`}
                                title={`${w.totalAnomalies} anomalies relevées`}
                              />
                            </div>

                            {/* Barre Nombre de Contrôles */}
                            <div className="flex-1 flex flex-col items-center justify-end h-full">
                              <span className="text-[11px] font-black text-blue-700 mb-1">
                                {w.totalInspections}
                              </span>
                              <div
                                style={{
                                  height: `${Math.max((w.totalInspections / maxWeeklyCount) * 100, 5)}%`,
                                }}
                                className={`w-full rounded-t-lg bg-blue-600 transition-all ${
                                  isSelected ? 'ring-2 ring-blue-500' : ''
                                }`}
                                title={`${w.totalInspections} véhicules contrôlés`}
                              />
                            </div>

                            {/* Barre Conformes */}
                            <div className="flex-1 flex flex-col items-center justify-end h-full">
                              <span className="text-[11px] font-black text-emerald-700 mb-1">
                                {w.compliantCount}
                              </span>
                              <div
                                style={{
                                  height: `${Math.max((w.compliantCount / maxWeeklyCount) * 100, 5)}%`,
                                }}
                                className={`w-full rounded-t-lg bg-emerald-500 transition-all ${
                                  isSelected ? 'ring-2 ring-blue-500' : ''
                                }`}
                                title={`${w.compliantCount} conformes`}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Étiquette Axe X : Semaine */}
                      <div className="pt-2 text-center">
                        <div
                          className={`font-mono text-xs font-black px-2 py-0.5 rounded-full inline-block ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-800 group-hover:bg-slate-300'
                          }`}
                        >
                          {w.weekCode}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">
                          {w.dateRangeStr}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fiche détaillée de la semaine active */}
            {activeWeek && (
              <div className="mt-4 p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-mono font-black text-sm shrink-0 shadow-xs">
                    {activeWeek.weekCode}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Semaine {activeWeek.weekCode} ({activeWeek.dateRangeStr})</span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          activeWeek.complianceRate === 100
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {activeWeek.complianceRate}% conforme • {activeWeek.totalAnomalies} anomalie(s)
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {activeWeek.totalInspections} fournisseur(s) contrôlé(s) •{' '}
                      <span className="font-semibold text-emerald-700">{activeWeek.compliantCount} conforme(s)</span> •{' '}
                      <span className="font-semibold text-rose-700">{activeWeek.nonCompliantCount} avec défaillance(s)</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 mr-1">Fournisseurs contrôlés :</span>
                  {activeWeek.suppliers.map((sup, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border ${
                        sup.globalStatus === 'CONFORME'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {sup.globalStatus === 'CONFORME' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3 h-3 text-rose-600" />
                      )}
                      <span>{sup.supplierName}</span>
                      {sup.anomalies > 0 && (
                        <span className="font-mono text-[10px] bg-rose-200 text-rose-900 px-1 rounded">
                          +{sup.anomalies}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TABLEAU RÉCAPITULATIF HEBDOMADAIRE ("RÉDIGÉ EN TABLEAU") */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Tableau de Suivi Hebdomadaire (1 Contrôle / Fournisseur / Semaine)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tableau exhaustif du nombre de non-conformités, des volumes contrôlés et des taux de conformité semaine par semaine.
            </p>
          </div>

          <span className="text-xs font-bold text-slate-500 self-start sm:self-auto px-3 py-1 bg-slate-100 rounded-lg">
            {stats.weeklyStats.length} semaine{stats.weeklyStats.length > 1 ? 's' : ''} au total
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Semaine</th>
                <th className="py-3 px-3">Période (Dates)</th>
                <th className="py-3 px-3 text-center">Véhicules Contrôlés</th>
                <th className="py-3 px-3 text-center">Conformes</th>
                <th className="py-3 px-3 text-center">Défaillants</th>
                <th className="py-3 px-3 text-center bg-rose-50/60 text-rose-900">
                  Nombre de Non-Conformités
                </th>
                <th className="py-3 px-3 text-center">Taux Conformité</th>
                <th className="py-3 px-3 text-center">Taux Non-Conformité</th>
                <th className="py-3 px-3">Fournisseurs contrôlés</th>
                <th className="py-3 px-3 text-center">Statut Semaine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stats.weeklyStats.map((w) => {
                const isSelected = activeWeek?.weekKey === w.weekKey;
                const isPerfect = w.complianceRate === 100;

                return (
                  <tr
                    key={w.weekKey}
                    onClick={() => setSelectedWeekKey(w.weekKey)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 font-medium'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-3 font-mono font-black text-slate-900">
                      <span className="px-2 py-0.5 bg-slate-200 rounded text-slate-800">
                        {w.weekCode}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {w.dateRangeStr}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900">
                      {w.totalInspections}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        {w.compliantCount}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {w.nonCompliantCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                          <XCircle className="w-3 h-3" />
                          {w.nonCompliantCount}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center bg-rose-50/40">
                      {w.totalAnomalies > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigateToHistory) {
                              onNavigateToHistory({
                                statusFilter: 'NON CONFORME',
                                week: w.weekCode,
                              });
                            } else if (onNavigateToNonCompliant) {
                              onNavigateToNonCompliant(w.weekCode);
                            }
                          }}
                          className="inline-flex items-center justify-center gap-1.5 font-mono font-black px-3 py-1.5 rounded-lg text-xs bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-xs cursor-pointer transition-all hover:shadow-md ring-2 ring-rose-400/50 group/btn"
                          title={`Cliquer pour voir directement les ${w.totalAnomalies} anomalies de la semaine ${w.weekCode}`}
                        >
                          <span>{w.totalAnomalies} anomalie{w.totalAnomalies > 1 ? 's' : ''}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-rose-200 group-hover/btn:translate-x-0.5 transition-transform" />
                        </button>
                      ) : (
                        <span className="inline-block font-mono font-bold px-2 py-0.5 rounded-lg text-xs bg-emerald-100 text-emerald-800">
                          0 anomalie
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className={`h-full ${isPerfect ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${w.complianceRate}%` }}
                          />
                        </div>
                        <span
                          className={`font-black font-mono text-xs ${
                            isPerfect ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {w.complianceRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`font-black font-mono text-xs ${
                          w.nonComplianceRate > 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}
                      >
                        {w.nonComplianceRate}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {w.suppliers.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (s.globalStatus !== 'CONFORME') {
                                if (onNavigateToHistory) {
                                  onNavigateToHistory({
                                    statusFilter: 'NON CONFORME',
                                    week: w.weekCode,
                                    supplier: s.supplierName,
                                  });
                                } else if (onNavigateToNonCompliant) {
                                  onNavigateToNonCompliant(w.weekCode);
                                }
                              }
                            }}
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-transform ${
                              s.globalStatus === 'CONFORME'
                                ? 'bg-emerald-100 text-emerald-900 cursor-default'
                                : 'bg-rose-100 text-rose-900 font-bold hover:bg-rose-200 active:scale-95 cursor-pointer shadow-2xs'
                            }`}
                            title={
                              s.globalStatus === 'CONFORME'
                                ? `${s.supplierName} - Conforme`
                                : `${s.supplierName} - ${s.anomalies} anomalies (Cliquer pour afficher)`
                            }
                          >
                            <span>{s.supplierName}</span>
                            {s.anomalies > 0 && (
                              <span className="ml-1 text-[9px] text-rose-700 font-bold">({s.anomalies})</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isPerfect ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Objectif 100%</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Alerte Défauts</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Ligne Total & Moyennes */}
            <tfoot className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300 text-xs">
              <tr>
                <td className="py-3 px-3" colSpan={2}>
                  TOTAL CUMULÉ ({stats.weeklyStats.length} semaine{stats.weeklyStats.length > 1 ? 's' : ''})
                </td>
                <td className="py-3 px-3 text-center font-black">{stats.total}</td>
                <td className="py-3 px-3 text-center text-emerald-700 font-black">
                  {stats.compliantCount}
                </td>
                <td className="py-3 px-3 text-center text-rose-700 font-black">
                  {stats.nonCompliantCount}
                </td>
                <td className="py-3 px-3 text-center bg-rose-100/70 text-rose-900 font-black text-sm">
                  {stats.totalAnomalies > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateToHistory) {
                          onNavigateToHistory({ statusFilter: 'NON CONFORME' });
                        } else if (onNavigateToNonCompliant) {
                          onNavigateToNonCompliant();
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-rose-600 hover:bg-rose-700 active:scale-95 text-white cursor-pointer shadow-xs transition-all ring-2 ring-rose-400/40"
                      title="Cliquer pour voir toutes les anomalies enregistrées"
                    >
                      <span>{stats.totalAnomalies} anomalies</span>
                      <ArrowRight className="w-3.5 h-3.5 text-rose-200" />
                    </button>
                  ) : (
                    <span>0 anomalie</span>
                  )}
                </td>
                <td className="py-3 px-3 text-center text-emerald-700 font-black text-sm">
                  {stats.globalComplianceRate}% moy.
                </td>
                <td className="py-3 px-3 text-center text-rose-700 font-black text-sm">
                  {stats.globalNonComplianceRate}% moy.
                </td>
                <td className="py-3 px-3" colSpan={2}>
                  {stats.supplierStats.length} partenaires laitiers suivis
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* CLASSEMENT CRITÈRES & SUIVI FOURNISSEURS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pareto des critères les plus souvent non-conformes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Fréquence des Non-Conformités par Critère
              </h3>
              <p className="text-xs text-slate-500">
                Détection automatique des critères posant le plus fréquemment problème
              </p>
            </div>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>

          <div className="space-y-2 pt-2">
            {stats.criteriaStats.slice(0, 7).map((crit) => {
              const hasIssues = crit.count > 0;
              const barRatio = stats.total > 0 ? Math.round((crit.count / stats.total) * 100) : 0;

              return (
                <div
                  key={crit.code}
                  onClick={() => {
                    if (hasIssues && onNavigateToCriterion) {
                      onNavigateToCriterion(crit.code, crit.label);
                    }
                  }}
                  className={`p-2 rounded-xl transition-all ${
                    hasIssues
                      ? 'cursor-pointer hover:bg-rose-50/80 hover:shadow-2xs border border-transparent hover:border-rose-200 active:scale-[0.99] group'
                      : 'opacity-70'
                  }`}
                  title={
                    hasIssues
                      ? `Cliquer pour voir les ${crit.count} fiches présentant une anomalie sur ${crit.code}`
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-800 flex items-center gap-2 truncate max-w-[65%] sm:max-w-[70%]">
                      <span
                        className={`font-mono font-black px-1.5 py-0.5 rounded text-[11px] ${
                          hasIssues
                            ? 'bg-rose-100 text-rose-900 border border-rose-200 group-hover:bg-rose-200 transition-colors'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {crit.code}
                      </span>
                      <span className="truncate group-hover:text-rose-900 group-hover:underline decoration-rose-300">
                        {crit.label}
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`font-bold font-mono px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1 ${
                          hasIssues
                            ? 'bg-rose-100 text-rose-800 group-hover:bg-rose-200 transition-colors'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span className="font-black">{crit.count}/{stats.total}</span>
                        <span className="text-[10px] font-medium opacity-85">
                          ({crit.count} fois sur {stats.total})
                        </span>
                      </span>
                      {hasIssues && (
                        <ChevronRight className="w-3.5 h-3.5 text-rose-400 group-hover:text-rose-700 group-hover:translate-x-0.5 transition-all" />
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        hasIssues ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(barRatio, hasIssues ? 8 : 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Classement & Bilan Mensuel des Fournisseurs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Suivi Qualité par Fournisseur (Données par Mois)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Bilan mensuel et respect de la cadence hebdomadaire (1 contrôle / semaine / livreur)
              </p>
            </div>

            {/* Sélecteur de mois & Mode de vue */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={supplierMonthKey}
                  onChange={(e) => setSupplierMonthKey(e.target.value)}
                  className="pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 hover:bg-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                  aria-label="Sélectionner le mois"
                >
                  <option value="auto">
                    📅 {stats.monthlySupplierGroups[0]?.monthLabel || 'Mois en cours'} (Mois récent)
                  </option>
                  {stats.monthlySupplierGroups.map((g) => (
                    <option key={g.monthKey} value={g.monthKey}>
                      📅 {g.monthLabel} ({g.totalInspections} contrôle{g.totalInspections > 1 ? 's' : ''})
                    </option>
                  ))}
                  <option value="all">🌐 Tous les mois (Bilan global)</option>
                </select>
                <Calendar className="w-3.5 h-3.5 text-blue-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
              </div>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSupplierViewMode('cards')}
                  title="Affichage en cartes"
                  className={`p-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    supplierViewMode === 'cards'
                      ? 'bg-white text-blue-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierViewMode('table')}
                  title="Affichage en tableau"
                  className={`p-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    supplierViewMode === 'table'
                      ? 'bg-white text-blue-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Synthèse du mois sélectionné */}
          {activeMonth ? (
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-900">Bilan {activeMonth.monthLabel} :</span>
                <span className="text-slate-600">
                  {activeMonth.totalInspections} contrôle(s) •{' '}
                  <span className="font-semibold text-emerald-700">{activeMonth.compliantCount} conforme(s)</span> •{' '}
                  <span className="font-semibold text-rose-700">{activeMonth.totalAnomalies} anomalie(s)</span>
                </span>
              </div>
              <span
                className={`font-black px-2 py-0.5 rounded-full text-[11px] ${
                  activeMonth.complianceRate === 100
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                Taux mensuel : {activeMonth.complianceRate}%
              </span>
            </div>
          ) : isAllMonths ? (
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-800">Cumul global sur tous les mois</span>
              <span className="text-slate-600 font-medium">
                {stats.total} contrôles • {stats.totalAnomalies} anomalies au total
              </span>
            </div>
          ) : null}

          {/* Affichage des Fournisseurs du mois */}
          {(!activeMonth && !isAllMonths) || (activeMonth && activeMonth.suppliers.length === 0) ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Aucun contrôle enregistré pour ce mois.
            </div>
          ) : supplierViewMode === 'cards' ? (
            <div className="space-y-3 pt-1">
              {(isAllMonths
                ? stats.supplierStats.map((s) => ({
                    name: s.name,
                    totalInspections: s.totalInspections,
                    compliant: s.compliant,
                    nonCompliant: s.nonCompliant,
                    totalAnomalies: 0,
                    complianceRate:
                      s.totalInspections > 0
                        ? Math.round((s.compliant / s.totalInspections) * 100)
                        : 100,
                    inspectionsList: [] as {
                      reference: string;
                      date: string;
                      week: string;
                      globalStatus: 'CONFORME' | 'NON CONFORME' | 'EN COURS';
                      anomalies: number;
                    }[],
                  }))
                : activeMonth?.suppliers || []
              ).map((sup) => {
                const isPerfect = sup.complianceRate === 100;

                return (
                  <div
                    key={sup.name}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                          <Truck className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{sup.name}</div>
                          <div className="text-xs text-slate-500">
                            {sup.totalInspections} contrôle(s) en {activeMonth ? activeMonth.monthLabel : 'cumul'} •{' '}
                            <span className="text-emerald-700 font-semibold">{sup.compliant} conforme(s)</span>
                            {sup.nonCompliant > 0 && (
                              <span className="text-rose-700 font-semibold"> • {sup.nonCompliant} défaillance(s)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                            isPerfect
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {sup.complianceRate}% conforme
                        </span>
                      </div>
                    </div>

                    {/* Fiches / Semaines contrôlées pour ce fournisseur dans le mois */}
                    {sup.inspectionsList && sup.inspectionsList.length > 0 && (
                      <div className="pt-1 flex flex-wrap items-center gap-1.5 border-t border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">
                          Passages du mois :
                        </span>
                        {sup.inspectionsList.map((insp, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              if (insp.anomalies > 0) {
                                if (onNavigateToHistory) {
                                  onNavigateToHistory({
                                    statusFilter: 'NON CONFORME',
                                    week: insp.week,
                                    supplier: sup.name,
                                  });
                                } else if (onNavigateToNonCompliant) {
                                  onNavigateToNonCompliant(insp.week);
                                }
                              }
                            }}
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
                              insp.globalStatus === 'CONFORME'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 cursor-default'
                                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 cursor-pointer active:scale-95'
                            }`}
                            title={`Contrôle du ${insp.date} (${insp.reference}) - ${insp.globalStatus} (${insp.anomalies} anomalies)${
                              insp.anomalies > 0 ? ' - Cliquer pour afficher les anomalies' : ''
                            }`}
                          >
                            {insp.globalStatus === 'CONFORME' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <XCircle className="w-3 h-3 text-rose-600" />
                            )}
                            <span className="font-mono">{insp.week}</span>
                            {insp.anomalies > 0 ? (
                              <span className="text-[10px] text-rose-700 font-bold">
                                ({insp.anomalies} non-conf.)
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-700">100%</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Mode Tableau Mensuel */
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Fournisseur</th>
                    <th className="py-2.5 px-3 text-center">Contrôles du mois</th>
                    <th className="py-2.5 px-3 text-center">Conformes</th>
                    <th className="py-2.5 px-3 text-center">Défaillants</th>
                    <th className="py-2.5 px-3 text-center">Anomalies</th>
                    <th className="py-2.5 px-3 text-center">Taux Mensuel</th>
                    <th className="py-2.5 px-3 text-center">Statut Qualité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(isAllMonths
                    ? stats.supplierStats.map((s) => ({
                        name: s.name,
                        totalInspections: s.totalInspections,
                        compliant: s.compliant,
                        nonCompliant: s.nonCompliant,
                        totalAnomalies: 0,
                        complianceRate:
                          s.totalInspections > 0
                            ? Math.round((s.compliant / s.totalInspections) * 100)
                            : 100,
                      }))
                    : activeMonth?.suppliers || []
                  ).map((sup) => {
                    const isPerfect = sup.complianceRate === 100;

                    return (
                      <tr key={sup.name} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{sup.name}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-800">
                          {sup.totalInspections}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-700 font-bold">
                          {sup.compliant}
                        </td>
                        <td className="py-2.5 px-3 text-center text-rose-700 font-bold">
                          {sup.nonCompliant}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {sup.totalAnomalies > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (onNavigateToHistory) {
                                  onNavigateToHistory({
                                    statusFilter: 'NON CONFORME',
                                    supplier: sup.name,
                                  });
                                } else if (onNavigateToNonCompliant) {
                                  onNavigateToNonCompliant();
                                }
                              }}
                              className="font-mono font-bold px-2 py-0.5 rounded text-[11px] bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-95 shadow-2xs inline-flex items-center gap-1 transition-all"
                              title={`Cliquer pour voir les anomalies de ${sup.name}`}
                            >
                              <span>{sup.totalAnomalies}</span>
                              <ArrowRight className="w-3 h-3 text-rose-200" />
                            </button>
                          ) : (
                            <span className="font-mono font-bold px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800">
                              0
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-black font-mono text-xs ${
                              isPerfect ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {sup.complianceRate}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isPerfect ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Objectif 100%
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              À surveiller
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Règle de cadence hebdomadaire HACCP */}
          <div className="pt-2 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>
              Cadence cible : 1 contrôle par semaine par fournisseur (soit 4 à 5 contrôles par mois et par partenaire).
            </span>
          </div>
        </div>
      </div>

      {/* Comparatif par section */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/90 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">Section 1</span>
            <h4 className="text-base font-bold text-white">Véhicules & Bidons</h4>
            <p className="text-xs text-slate-400 mt-1">
              Hygiène intérieur, étanchéité couvercles, rouille, scellage, odeurs, infestation, plomb de sécurité.
            </p>
            <div className="mt-3 font-semibold text-xs text-slate-300">
              Anomalies constatées :{' '}
              <span className="text-amber-400 font-bold">{stats.sectionStats.vehicule.nc}</span>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/90 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Section 2</span>
            <h4 className="text-base font-bold text-white">Personnel de Manipulation</h4>
            <p className="text-xs text-slate-400 mt-1">
              Hygiène des mains (ongles courts, absence bijoux), port des tenues requises, comportement hygiène.
            </p>
            <div className="mt-3 font-semibold text-xs text-slate-300">
              Anomalies constatées :{' '}
              <span className="text-amber-400 font-bold">{stats.sectionStats.personnel.nc}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
