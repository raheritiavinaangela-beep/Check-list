import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, Truck } from 'lucide-react';

interface PasswordGateProps {
  onUnlock: () => void;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Vérification du mot de passe demandé "RJC!"
    if (password === 'RJC!') {
      try {
        sessionStorage.setItem('check_vehicule_auth', 'true');
      } catch {
        // Fallback si sessionStorage non disponible
      }
      onUnlock();
    } else {
      setError('Mot de passe incorrect. Veuillez vérifier la saisie.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* En-tête de la fenêtre */}
        <div className="bg-blue-950 p-6 text-white text-center relative">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg mb-3">
            <Truck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <Lock className="w-5 h-5 text-blue-300" />
            Accès Sécurisé
          </h2>
          <p className="text-xs text-blue-200/80 mt-1">
            Check Véhicule • Contrôle Hygiène Laitière
          </p>
          <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-900 text-blue-200 border border-blue-700">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
            SERVICE SQH QUALITÉ
          </div>
        </div>

        {/* Formulaire de mot de passe */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label
              htmlFor="password_input"
              className="block text-sm font-semibold text-slate-700 mb-1.5"
            >
              Mot de passe d'accès
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                id="password_input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                placeholder="Entrez le mot de passe..."
                className="w-full pl-10 pr-11 py-2.5 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
                title={showPassword ? 'Masquer' : 'Afficher'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <button
            id="btn_submit_unlock"
            type="submit"
            disabled={!password.trim() || isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Lock className="w-4 h-4" />
            <span>Déverrouiller l'accès</span>
          </button>

          <p className="text-center text-[11px] text-slate-400">
            Protégé par le système de gestion hygiène & sécurité alimentaire
          </p>
        </form>
      </div>
    </div>
  );
};
