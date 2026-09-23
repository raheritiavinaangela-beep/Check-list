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

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  inspections,
  onNavigateToNonCompliant,
  onNavigateToCriterion,
  onNavigateToHistory,
}) => {
  const [chartMode, setChartMode] = useState<'rate' | 'count'>('rate');
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);

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

      // 2. Stats Fournisseur
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

      // 3. Stats Critères
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
                      <span
                        className={`inline-block font-mono font-black px-2.5 py-1 rounded-lg text-xs ${
                          w.totalAnomalies > 0
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {w.totalAnomalies} anomalie{w.totalAnomalies > 1 ? 's' : ''}
                      </span>
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
                          <span
                            key={i}
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              s.globalStatus === 'CONFORME'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-rose-100 text-rose-900 font-bold'
                            }`}
                            title={`${s.supplierName} - ${s.globalStatus} (${s.anomalies} anomalies)`}
                          >
                            {s.supplierName}
                          </span>
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
                  {stats.totalAnomalies} anomalies
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
              const pct = stats.total > 0 ? Math.round((crit.count / stats.total) * 100) : 0;
              const hasIssues = crit.count > 0;

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
                    <span className="font-semibold text-slate-800 flex items-center gap-2 truncate max-w-[75%]">
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
                        className={`font-bold font-mono px-2 py-0.5 rounded text-[11px] ${
                          hasIssues
                            ? 'bg-rose-100 text-rose-800 group-hover:bg-rose-200 transition-colors'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {crit.count} anomalie{crit.count > 1 ? 's' : ''} ({pct}%)
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
                      style={{ width: `${Math.max(pct, hasIssues ? 6 : 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Classement Qualité Fournisseurs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Suivi Qualité par Fournisseur
              </h3>
              <p className="text-xs text-slate-500">
                Taux de conformité et alertes d'anomalies par livreur
              </p>
            </div>
            <Truck className="w-5 h-5 text-slate-400" />
          </div>

          <div className="space-y-3 pt-2">
            {stats.supplierStats.map((sup) => {
              const compRate =
                sup.totalInspections > 0
                  ? Math.round((sup.compliant / sup.totalInspections) * 100)
                  : 100;
              const isPerfect = compRate === 100;

              return (
                <div
                  key={sup.name}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{sup.name}</div>
                    <div className="text-slate-500 mt-0.5">
                      {sup.totalInspections} contrôle(s) • {sup.compliant} conformes • {sup.nonCompliant} défaillance(s)
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
                      {compRate}% conforme
                    </span>
                  </div>
                </div>
              );
            })}
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
