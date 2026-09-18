import React from 'react';
import { ClipboardCheck, History, BarChart3, ShieldCheck, Truck, Lock } from 'lucide-react';

interface HeaderProps {
  activeTab: 'new' | 'history' | 'analytics';
  setActiveTab: (tab: 'new' | 'history' | 'analytics') => void;
  totalInspectionsCount: number;
  onLock?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalInspectionsCount,
  onLock,
}) => {
  return (
    <header className="bg-blue-950 text-white border-b border-blue-900 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3.5 gap-3">
          {/* Logo & Titre */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-inner shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Check Véhicule
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-900 text-blue-200 border border-blue-700">
                  <ShieldCheck className="w-3 h-3" />
                  SERVICE SQH
                </span>
              </div>
              <p className="text-xs text-blue-200/80">
                Contrôle hygiène véhicule de livraison lait
              </p>
            </div>
          </div>

          {/* Navigation par onglets */}
          <nav className="flex items-center gap-1 bg-blue-900/80 p-1 rounded-xl border border-blue-800 self-start md:self-auto overflow-x-auto max-w-full">
            <button
              id="nav_tab_new"
              type="button"
              onClick={() => setActiveTab('new')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'new'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Nouveau Contrôle</span>
            </button>

            <button
              id="nav_tab_history"
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Historique</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-700 text-slate-200">
                {totalInspectionsCount}
              </span>
            </button>

            <button
              id="nav_tab_analytics"
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Statistiques & Risques</span>
            </button>

            {onLock && (
              <button
                id="btn_lock_session"
                type="button"
                onClick={onLock}
                title="Verrouiller l'accès"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-red-950/50 border border-transparent hover:border-red-800/60 transition-all cursor-pointer whitespace-nowrap ml-1"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Verrouiller</span>
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
