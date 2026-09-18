import React, { useMemo } from 'react';
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

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  inspections,
  onNavigateToNonCompliant,
  onNavigateToCriterion,
  onNavigateToHistory,
}) => {
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
        totalAnomalies: 0,
        criteriaStats: [],
        supplierStats: [],
        sectionStats: { vehicule: { total: 0, nc: 0 }, personnel: { total: 0, nc: 0 } },
      };
    }

    const compliantCount = inspections.filter((i) => i.globalStatus === 'CONFORME').length;
    const nonCompliantCount = inspections.filter((i) => i.globalStatus === 'NON CONFORME').length;
    const globalComplianceRate = Math.round((compliantCount / total) * 100);

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

    inspections.forEach((insp) => {
      // Stats Fournisseur
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

      // Stats Critères
      insp.criteriaResults.forEach((c) => {
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

    const criteriaStats = Object.values(criteriaMap).sort((a, b) => b.count - a.count);
    const supplierStats = Object.values(supplierMap).sort(
      (a, b) => b.nonCompliant - a.nonCompliant
    );

    return {
      total,
      compliantCount,
      nonCompliantCount,
      globalComplianceRate,
      totalAnomalies,
      criteriaStats,
      supplierStats,
      sectionStats,
    };
  }, [inspections]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
            Tableau de bord qualité HACCP
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Analyses statistiques & Détection des risques
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Visualisation des fréquences d'anomalies, classement des critères critiques et suivi des fournisseurs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      {/* Cartes KPI clés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Fiches</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1">Véhicules contrôlés</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Taux Conformité</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600">
            {stats.globalComplianceRate}%
          </div>
          <div className="text-xs text-emerald-700 mt-1 font-medium">
            {stats.compliantCount} véhicules 100% conformes
          </div>
        </div>

        <div
          id="card_metric_non_conformities"
          onClick={() => {
            if (stats.nonCompliantCount > 0) {
              handleGoNonCompliant();
            }
          }}
          className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition-all ${
            stats.nonCompliantCount > 0
              ? 'border-rose-200 hover:border-rose-400 hover:shadow-md hover:bg-rose-50/20 cursor-pointer group active:scale-[0.99]'
              : 'border-slate-200'
          }`}
          title={
            stats.nonCompliantCount > 0
              ? 'Cliquer pour consulter les fiches défaillantes dans l’historique'
              : undefined
          }
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <span>Non-Conformités</span>
              {stats.nonCompliantCount > 0 && (
                <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200 group-hover:bg-rose-200 transition-colors">
                  Voir fiches
                </span>
              )}
            </span>
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              {stats.nonCompliantCount > 0 && (
                <ArrowRight className="w-3.5 h-3.5 text-rose-400 group-hover:text-rose-700 group-hover:translate-x-0.5 transition-all" />
              )}
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600">
            {stats.totalAnomalies}
          </div>
          <div className="text-xs text-rose-700 mt-1 font-medium flex items-center justify-between">
            <span>Sur {stats.nonCompliantCount} fiches défaillantes</span>
            {stats.nonCompliantCount > 0 && (
              <span className="text-[11px] font-bold text-rose-600 group-hover:underline flex items-center gap-0.5">
                Accéder →
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Fournisseurs</span>
            <Truck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {stats.supplierStats.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Partenaires laitiers suivis</div>
        </div>
      </div>

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
