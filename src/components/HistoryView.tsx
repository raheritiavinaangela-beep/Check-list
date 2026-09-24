import React, { useState, useMemo } from 'react';
import { Inspection } from '../types';
import { exportInspectionsToExcel } from '../services/excelExport';
import { deleteInspection } from '../services/storage';
import { InspectionDetailModal } from './InspectionDetailModal';
import {
  Search,
  Filter,
  FileSpreadsheet,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Truck,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface HistoryViewProps {
  inspections: Inspection[];
  onRefresh: () => void;
  onNewInspection: () => void;
  initialFilter?: {
    statusFilter?: 'ALL' | 'CONFORME' | 'NON CONFORME';
    criterionCode?: string | null;
    criterionLabel?: string | null;
    week?: string | null;
    supplier?: string | null;
    timestamp?: number;
  };
  initialStatusFilter?: 'ALL' | 'CONFORME' | 'NON CONFORME';
  initialCriterionCode?: string | null;
  initialCriterionLabel?: string | null;
  initialWeek?: string | null;
  onClearInitialFilter?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  inspections,
  onRefresh,
  onNewInspection,
  initialFilter,
  initialStatusFilter,
  initialCriterionCode,
  initialCriterionLabel,
  initialWeek,
  onClearInitialFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFORME' | 'NON CONFORME'>(
    initialFilter?.statusFilter || initialStatusFilter || 'ALL'
  );
  const [criterionFilter, setCriterionFilter] = useState<{
    code: string;
    label?: string;
  } | null>(() => {
    const code = initialFilter?.criterionCode ?? initialCriterionCode;
    const label = initialFilter?.criterionLabel ?? initialCriterionLabel ?? undefined;
    return code ? { code, label } : null;
  });
  const [selectedSupplier, setSelectedSupplier] = useState<string>(
    initialFilter?.supplier || 'ALL'
  );
  const [selectedWeek, setSelectedWeek] = useState<string>(
    initialFilter?.week || initialWeek || 'ALL'
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [inspectionToDelete, setInspectionToDelete] = useState<Inspection | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // Synchronisation avec les filtres transmis lors de la navigation
  React.useEffect(() => {
    const s = initialFilter?.statusFilter ?? initialStatusFilter;
    if (s) {
      setStatusFilter(s);
    }
  }, [initialFilter?.statusFilter, initialFilter?.timestamp, initialStatusFilter]);

  React.useEffect(() => {
    const code = initialFilter ? initialFilter.criterionCode : initialCriterionCode;
    const label = initialFilter ? initialFilter.criterionLabel : initialCriterionLabel;
    if (code) {
      setCriterionFilter({
        code,
        label: label || undefined,
      });
    } else {
      setCriterionFilter(null);
    }
  }, [initialFilter?.criterionCode, initialFilter?.criterionLabel, initialFilter?.timestamp, initialCriterionCode, initialCriterionLabel]);

  React.useEffect(() => {
    const w = initialFilter?.week ?? initialWeek;
    if (w) {
      setSelectedWeek(w);
    }
  }, [initialFilter?.week, initialFilter?.timestamp, initialWeek]);

  React.useEffect(() => {
    const sup = initialFilter?.supplier;
    if (sup) {
      setSelectedSupplier(sup);
    }
  }, [initialFilter?.supplier, initialFilter?.timestamp]);

  // Liste unique des fournisseurs pour le filtre
  const uniqueSuppliers = useMemo(() => {
    const s = new Set<string>();
    inspections.forEach((i) => {
      if (i.supplier) s.add(i.supplier);
    });
    return Array.from(s).sort();
  }, [inspections]);

  // Filtrage
  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      // Recherche globale (Réf, Fournisseur, Chauffeur, Immat, Contrôleur, Observations)
      const q = searchTerm.toLowerCase().trim();
      if (q) {
        const matchesRef = item.reference.toLowerCase().includes(q);
        const matchesSup = item.supplier.toLowerCase().includes(q);
        const matchesDriver = (item.driverName || '').toLowerCase().includes(q);
        const matchesWeek = (item.week || '').toLowerCase().includes(q);
        const matchesInspector = (item.inspectorName || '').toLowerCase().includes(q);
        const matchesObs = (item.otherObservations || '').toLowerCase().includes(q);
        const matchesCriteriaObs = item.criteriaResults.some((c) =>
          c.observation.toLowerCase().includes(q)
        );

        if (
          !matchesRef &&
          !matchesSup &&
          !matchesDriver &&
          !matchesWeek &&
          !matchesInspector &&
          !matchesObs &&
          !matchesCriteriaObs
        ) {
          return false;
        }
      }

      // Filtre Statut
      if (statusFilter !== 'ALL' && item.globalStatus !== statusFilter) {
        return false;
      }

      // Filtre Critère Spécifique (anomalie valeur '0' sur ce critère)
      if (criterionFilter) {
        const targetCode = criterionFilter.code.toLowerCase();
        const hasCriterionIssue = item.criteriaResults.some(
          (c) =>
            (c.code.toLowerCase() === targetCode ||
              (c.criterionId && c.criterionId.toLowerCase() === targetCode)) &&
            (c.value === '0' || c.isNonCompliant)
        );
        if (!hasCriterionIssue) {
          return false;
        }
      }

      // Filtre Fournisseur
      if (selectedSupplier !== 'ALL' && item.supplier !== selectedSupplier) {
        return false;
      }

      // Filtre Semaine
      if (selectedWeek !== 'ALL') {
        const itemWeek = (item.week || '').toLowerCase().trim();
        const targetWeek = selectedWeek.toLowerCase().trim();
        if (itemWeek !== targetWeek && !itemWeek.includes(targetWeek)) {
          return false;
        }
      }

      // Filtre Dates
      if (startDate && item.date < startDate) {
        return false;
      }
      if (endDate && item.date > endDate) {
        return false;
      }

      return true;
    });
  }, [inspections, searchTerm, statusFilter, criterionFilter, selectedSupplier, selectedWeek, startDate, endDate]);

  const handleConfirmDelete = () => {
    if (!inspectionToDelete) return;
    const ref = inspectionToDelete.reference;
    deleteInspection(inspectionToDelete.id);
    setInspectionToDelete(null);
    onRefresh();
    setDeleteNotice(`La fiche ${ref} a été définitivement supprimée.`);
    setTimeout(() => setDeleteNotice(null), 4000);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setCriterionFilter(null);
    setSelectedSupplier('ALL');
    setSelectedWeek('ALL');
    setStartDate('');
    setEndDate('');
    onClearInitialFilter?.();
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    statusFilter !== 'ALL' ||
    criterionFilter !== null ||
    selectedSupplier !== 'ALL' ||
    selectedWeek !== 'ALL' ||
    startDate !== '' ||
    endDate !== '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Notification de confirmation */}
      {deleteNotice && (
        <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-md flex items-center justify-between animate-in fade-in duration-200">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {deleteNotice}
          </span>
          <button
            type="button"
            onClick={() => setDeleteNotice(null)}
            className="text-emerald-100 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* En-tête & Boutons d'export majeurs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
            Traçabilité & Archives
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Historique des contrôles d'hygiène
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {filteredInspections.length} contrôle(s) affiché(s) sur un total de {inspections.length}
          </p>
        </div>

        {/* Bouton Exporter vers Excel */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn_export_excel"
            type="button"
            onClick={() => exportInspectionsToExcel(filteredInspections)}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer active:scale-95"
            title="Génère un fichier .xlsx structuré avec fiches, détail critère par critère et tableau des anomalies"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>Exporter vers Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Barre de Recherche et Filtres */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Recherche texte */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              id="input_history_search"
              type="text"
              placeholder="Rechercher par fournisseur, réf, chauffeur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filtre Statut */}
          <div>
            <select
              id="select_filter_status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="CONFORME">Conformes (100%)</option>
              <option value="NON CONFORME">Non Conformes (avec anomalies)</option>
            </select>
          </div>

          {/* Filtre Fournisseur */}
          <div>
            <select
              id="select_filter_supplier"
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tous les fournisseurs</option>
              {uniqueSuppliers.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>
          </div>

          {/* Filtres Dates */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Date début"
              className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-xs">à</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Date fin"
              className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-medium">Filtres actifs :</span>
              {statusFilter !== 'ALL' && (
                <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                  statusFilter === 'NON CONFORME'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  Statut : {statusFilter}
                </span>
              )}
              {criterionFilter && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-bold text-[11px] bg-rose-600 text-white shadow-2xs">
                  <AlertTriangle className="w-3 h-3 text-amber-200" />
                  <span>Critère {criterionFilter.code} : {criterionFilter.label || 'Anomalie'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCriterionFilter(null);
                      onClearInitialFilter?.();
                    }}
                    className="ml-1 text-rose-200 hover:text-white font-black"
                    title="Retirer le filtre de critère"
                  >
                    ✕
                  </button>
                </span>
              )}
              {selectedWeek !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-bold text-[11px] bg-blue-600 text-white shadow-2xs">
                  <Calendar className="w-3 h-3 text-blue-200" />
                  <span>Semaine : {selectedWeek}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWeek('ALL');
                      onClearInitialFilter?.();
                    }}
                    className="ml-1 text-blue-200 hover:text-white font-black cursor-pointer"
                    title="Retirer le filtre de semaine"
                  >
                    ✕
                  </button>
                </span>
              )}
              {selectedSupplier !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md text-[11px] font-medium">
                  <Truck className="w-3 h-3 text-slate-500" />
                  <span>Fournisseur : {selectedSupplier}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplier('ALL');
                      onClearInitialFilter?.();
                    }}
                    className="ml-1 text-slate-400 hover:text-slate-700 font-black cursor-pointer"
                    title="Retirer le filtre fournisseur"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Réinitialiser tous les filtres
            </button>
          </div>
        )}
      </div>

      {/* Bannière d'alerte spécifique si redirection depuis Analytics */}
      {criterionFilter && (
        <div className="bg-rose-50 border-2 border-rose-300 text-rose-950 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                Filtre ciblé depuis les Analyses
              </div>
              <div className="text-sm font-black text-rose-950 mt-0.5">
                {filteredInspections.length} fiche(s) avec défaillance sur le critère {criterionFilter.code}
                {criterionFilter.label ? ` (${criterionFilter.label})` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCriterionFilter(null);
              onClearInitialFilter?.();
            }}
            className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            Afficher toutes les fiches
          </button>
        </div>
      )}

      {/* Liste des contrôles */}
      {filteredInspections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Aucun contrôle ne correspond aux critères</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Modifiez vos filtres ou effectuez un nouveau contrôle de véhicule pour enrichir l'historique.
          </p>
          <button
            type="button"
            onClick={onNewInspection}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            Effectuer un contrôle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInspections.map((insp) => {
            const isCompliant = insp.globalStatus === 'CONFORME';
            const nonCompliantList = insp.criteriaResults.filter((c) => c.value === '0');

            return (
              <div
                key={insp.id}
                id={`inspection_row_${insp.id}`}
                className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 shadow-2xs hover:shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isCompliant ? 'border-slate-200 hover:border-emerald-300' : 'border-rose-200 bg-rose-50/20 hover:border-rose-300'
                }`}
              >
                {/* Métadonnées principales */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-900 text-amber-300">
                      {insp.reference}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        isCompliant
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {isCompliant ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      )}
                      <span>{insp.globalStatus}</span>
                      {!isCompliant && (
                        <span>({insp.totalNonCompliant} anomalie{insp.totalNonCompliant > 1 ? 's' : ''})</span>
                      )}
                    </span>

                    <span className="text-xs text-slate-500 font-medium">
                      {insp.date} à {insp.time}
                    </span>
                  </div>

                  {/* Fournisseur & Chauffeur & Camion */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
                    <div className="flex items-center gap-1 font-bold text-slate-900">
                      <Truck className="w-3.5 h-3.5 text-slate-500" />
                      <span>{insp.supplier}</span>
                    </div>

                    {insp.week && (
                      <div className="bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-blue-800 font-bold font-mono text-[11px]">
                        Semaine S: {insp.week}
                      </div>
                    )}

                    {insp.driverName && (
                      <div className="text-slate-600">
                        Chauffeur : <span className="font-medium">{insp.driverName}</span>
                      </div>
                    )}

                    <div className="text-slate-500">
                      Contrôleur : <span className="font-medium text-slate-700">{insp.inspectorName}</span>
                    </div>
                  </div>

                  {/* Aperçu des anomalies si non-conforme */}
                  {nonCompliantList.length > 0 && (
                    <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-2.5 mt-2 text-xs space-y-1">
                      <div className="font-bold text-rose-900 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        Anomalies signalées :
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {nonCompliantList.map((nc, idx) => {
                          const targetCode = criterionFilter?.code.toLowerCase();
                          const isTargeted =
                            targetCode &&
                            (nc.code.toLowerCase() === targetCode ||
                              (nc.criterionId && nc.criterionId.toLowerCase() === targetCode));

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setCriterionFilter({ code: nc.code, label: nc.label });
                                setStatusFilter('NON CONFORME');
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all text-left cursor-pointer ${
                                isTargeted
                                  ? 'bg-rose-600 text-white font-bold ring-2 ring-rose-600 ring-offset-1 shadow-sm'
                                  : 'bg-white border border-rose-300 text-rose-800 hover:bg-rose-100/80'
                              }`}
                              title={`Filtrer spécifiquement sur le critère ${nc.code}`}
                            >
                              <span className={`font-mono ${isTargeted ? 'font-black' : 'font-bold'}`}>
                                {nc.code}
                              </span>
                              : {nc.label}
                              {nc.observation && (
                                <span
                                  className={`italic ml-1 ${
                                    isTargeted ? 'text-rose-100 font-normal' : 'text-slate-600'
                                  }`}
                                >
                                  « {nc.observation} »
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Remarques générales */}
                  {insp.otherObservations && (
                    <p className="text-xs text-slate-600 italic">
                      « {insp.otherObservations} »
                    </p>
                  )}
                </div>

                {/* Actions sur la ligne */}
                <div className="flex items-center gap-2 self-end lg:self-center shrink-0 pt-2 lg:pt-0">
                  <button
                    id={`btn_view_detail_${insp.id}`}
                    type="button"
                    onClick={() => setSelectedInspection(insp)}
                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Consulter la fiche officielle"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Consulter la fiche</span>
                  </button>

                  <button
                    id={`btn_delete_${insp.id}`}
                    type="button"
                    onClick={() => setInspectionToDelete(insp)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Supprimer cette fiche"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Confirmation de Suppression */}
      {inspectionToDelete && (
        <div
          id="modal_confirm_delete_history"
          className="fixed inset-0 z-70 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Supprimer définitivement cette fiche ?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Cette action retirera ce contrôle du registre d'hygiène et mettra à jour les statistiques de conformité.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1 font-mono text-slate-700">
              <div><span className="text-slate-400 font-sans">Référence :</span> <span className="font-bold text-blue-700">{inspectionToDelete.reference}</span></div>
              <div><span className="text-slate-400 font-sans">Date :</span> {inspectionToDelete.date} à {inspectionToDelete.time}</div>
              <div><span className="text-slate-400 font-sans">Fournisseur :</span> <strong className="text-slate-900">{inspectionToDelete.supplier}</strong></div>
              <div><span className="text-slate-400 font-sans">Semaine :</span> {inspectionToDelete.week || 'N/A'}</div>
              <div><span className="text-slate-400 font-sans">Statut :</span> {inspectionToDelete.globalStatus}</div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setInspectionToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                id="btn_confirm_delete_history_action"
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détail & Impression de la fiche */}
      {selectedInspection && (
        <InspectionDetailModal
          inspection={selectedInspection}
          highlightCriterionCode={criterionFilter?.code}
          onClose={() => setSelectedInspection(null)}
          onDeleted={() => {
            onRefresh();
            setDeleteNotice(`La fiche ${selectedInspection.reference} a été définitivement supprimée.`);
            setTimeout(() => setDeleteNotice(null), 4000);
          }}
        />
      )}
    </div>
  );
};
