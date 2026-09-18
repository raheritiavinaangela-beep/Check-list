import React, { useState, useEffect } from 'react';
import { Inspection } from './types';
import { getStoredInspections } from './services/storage';
import { Header } from './components/Header';
import { NewInspectionForm } from './components/NewInspectionForm';
import { HistoryView } from './components/HistoryView';
import { AnalyticsView } from './components/AnalyticsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'new' | 'history' | 'analytics'>('new');
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [historyFilter, setHistoryFilter] = useState<{
    statusFilter?: 'ALL' | 'CONFORME' | 'NON CONFORME';
    criterionCode?: string | null;
    criterionLabel?: string | null;
    timestamp?: number;
  }>({});

  const reloadInspections = () => {
    const list = getStoredInspections();
    setInspections(list);
  };

  useEffect(() => {
    reloadInspections();
  }, []);

  const handleInspectionCreated = () => {
    reloadInspections();
    // Ne pas changer brutalement d'onglet pour laisser l'utilisateur voir la bannière de succès
  };

  const handleNavigateToNonCompliant = () => {
    setHistoryFilter({
      statusFilter: 'NON CONFORME',
      criterionCode: null,
      criterionLabel: null,
      timestamp: Date.now(),
    });
    setActiveTab('history');
  };

  const handleNavigateToCriterion = (code: string, label: string) => {
    setHistoryFilter({
      statusFilter: 'NON CONFORME',
      criterionCode: code,
      criterionLabel: label,
      timestamp: Date.now(),
    });
    setActiveTab('history');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased">
      {/* En-tête avec navigation par onglets */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalInspectionsCount={inspections.length}
      />

      {/* Contenu principal selon l'onglet actif */}
      <main className="flex-1 pb-16">
        {activeTab === 'new' && (
          <NewInspectionForm
            onInspectionCreated={handleInspectionCreated}
            onViewHistory={() => setActiveTab('history')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            inspections={inspections}
            onRefresh={reloadInspections}
            onNewInspection={() => setActiveTab('new')}
            initialStatusFilter={historyFilter.statusFilter}
            initialCriterionCode={historyFilter.criterionCode}
            initialCriterionLabel={historyFilter.criterionLabel}
            onClearInitialFilter={() => setHistoryFilter({})}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            inspections={inspections}
            onNavigateToNonCompliant={handleNavigateToNonCompliant}
            onNavigateToCriterion={handleNavigateToCriterion}
          />
        )}
      </main>

      {/* Pied de page sobre */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Système Digitalisé de Contrôle Hygiène Laitière • Norme HACCP Réception Lait Cru
          </span>
          <span className="text-slate-400 font-mono">
            {inspections.length} fiches archivées • Export Excel prêt
          </span>
        </div>
      </footer>
    </div>
  );
}
