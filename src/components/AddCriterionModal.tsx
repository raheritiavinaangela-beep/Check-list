import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Check, AlertCircle } from 'lucide-react';

interface AddCriterionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSectionId: 'vehicule_bidons' | 'personnel';
  suggestedCode: string;
  existingCodes: string[];
  onAdd: (newCrit: {
    code: string;
    sectionId: 'vehicule_bidons' | 'personnel';
    label: string;
    description?: string;
  }) => void;
}

export const AddCriterionModal: React.FC<AddCriterionModalProps> = ({
  isOpen,
  onClose,
  initialSectionId,
  suggestedCode,
  existingCodes,
  onAdd,
}) => {
  const [sectionId, setSectionId] = useState<'vehicule_bidons' | 'personnel'>(initialSectionId);
  const [code, setCode] = useState(suggestedCode);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSectionId(initialSectionId);
      setCode(suggestedCode);
      setLabel('');
      setDescription('');
      setError('');
    }
  }, [isOpen, initialSectionId, suggestedCode]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = label.trim();
    if (!cleanLabel) {
      setError("Veuillez renseigner l'intitulé du critère.");
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError('Veuillez renseigner un code pour le critère (ex: A.12 ou B.4).');
      return;
    }

    const isCodeTaken = existingCodes.some(
      (c) => c.trim().toUpperCase() === cleanCode
    );
    if (isCodeTaken) {
      setError(`Le code "${cleanCode}" est déjà attribué à un autre critère.`);
      return;
    }

    onAdd({
      code: cleanCode,
      sectionId,
      label: cleanLabel,
      description: description.trim(),
    });
    onClose();
  };

  const suggestions =
    sectionId === 'vehicule_bidons'
      ? [
          { label: 'Contrôle de la température du lait au déchargement', desc: 'Vérification au thermomètre sonde (doit être ≤ 4°C ou ≤ 6°C selon protocole)' },
          { label: 'État du plancher et absence de stagnation d’eau', desc: 'Plancher étanche, propre, sans flaques résiduelles' },
          { label: 'Propreté extérieure du véhicule (carrosserie, roues)', desc: 'Véhicule lavé avant entrée en zone de déchargement' },
          { label: 'Intégrité du joint de vanne de vidange', desc: 'Joint souple, sans craquelures ni résidus' },
        ]
      : [
          { label: 'Port obligatoire de gants propres pour manipulation', desc: 'Gants alimentaires jetables ou lavables dédiés' },
          { label: 'Absence de symptômes de maladie (toux, plaies ouvertes)', desc: 'Chauffeur/livreur apte au contact alimentaire' },
          { label: 'Lavage des mains préalable au poste de désinfection', desc: 'Passage obligatoire par le lavabo avant ouverture des bidons' },
        ];

  return (
    <div
      id="add_criterion_modal_overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="add_criterion_modal_content"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Entête */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white p-5 flex items-center justify-between border-b border-blue-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700/80 flex items-center justify-center text-white border border-blue-400/30">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Insérer un nouveau critère</h3>
              <p className="text-xs text-blue-200">
                {sectionId === 'vehicule_bidons'
                  ? 'Catégorie A • Camion et bidons'
                  : 'Catégorie B • Personnel faisant la manipulation'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-200 hover:text-white hover:bg-blue-800 p-2 rounded-xl transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Choix de la catégorie */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Catégorie / Section
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSectionId('vehicule_bidons');
                  if (!code || code.startsWith('B.')) {
                    setCode(suggestedCode.startsWith('A.') ? suggestedCode : 'A.12');
                  }
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between ${
                  sectionId === 'vehicule_bidons'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div className="font-extrabold">Section A</div>
                  <div className="text-[11px] font-normal text-slate-500">Camion et bidons</div>
                </div>
                {sectionId === 'vehicule_bidons' && <Check className="w-4 h-4 text-blue-600" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSectionId('personnel');
                  if (!code || code.startsWith('A.')) {
                    setCode('B.4');
                  }
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between ${
                  sectionId === 'personnel'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div className="font-extrabold">Section B</div>
                  <div className="text-[11px] font-normal text-slate-500">Personnel</div>
                </div>
                {sectionId === 'personnel' && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            </div>
          </div>

          {/* Code du critère */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="input_new_criterion_code" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Code du critère
              </label>
              <span className="text-[11px] text-slate-500">Ex: A.12, A.13, B.4, B.5...</span>
            </div>
            <input
              id="input_new_criterion_code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={sectionId === 'vehicule_bidons' ? 'A.12' : 'B.4'}
              className="w-full font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              required
            />
          </div>

          {/* Intitulé du critère */}
          <div>
            <label htmlFor="input_new_criterion_label" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Intitulé / Libellé du critère <span className="text-rose-500">*</span>
            </label>
            <input
              id="input_new_criterion_label"
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (error) setError('');
              }}
              placeholder={
                sectionId === 'vehicule_bidons'
                  ? 'Ex: Température du lait au déchargement...'
                  : 'Ex: Port obligatoire de gants jetables...'
              }
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              required
            />
          </div>

          {/* Description / Consigne */}
          <div>
            <label htmlFor="textarea_new_criterion_description" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description / Consigne de contrôle <span className="text-slate-400 font-normal">(Optionnel)</span>
            </label>
            <textarea
              id="textarea_new_criterion_description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Vérifier avec thermomètre étalonné, max 4°C. Mentionner tout dépassement..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
            />
          </div>

          {/* Suggestions d'exemples rapides */}
          <div className="pt-1">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
              Exemples rapides fréquents :
            </span>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setLabel(s.label);
                    setDescription(s.desc);
                    if (error) setError('');
                  }}
                  className="text-[11px] bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors text-left"
                >
                  + {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              id="btn_submit_new_criterion"
              type="submit"
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Insérer le critère</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
