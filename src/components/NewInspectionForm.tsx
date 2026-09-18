import React, { useState, useEffect } from 'react';
import {
  Inspection,
  InspectionCriterionResult,
  EvaluationValue,
  SupplierOption,
  GlobalStatus,
  CriterionDefinition,
} from '../types';
import { DEFAULT_INSPECTORS } from '../data/initialCriteria';
import {
  generateInspectionReference,
  getISOWeekString,
  getStoredSuppliers,
  saveSupplier,
  saveInspection,
  getStoredCriteria,
  saveCustomCriterion,
  deleteCustomCriterion,
  getNextCriterionCode,
} from '../services/storage';
import { PhotoCaptureModal } from './PhotoCaptureModal';
import { AddCriterionModal } from './AddCriterionModal';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Camera,
  AlertTriangle,
  Send,
  Sparkles,
  RotateCcw,
  Plus,
  PlusCircle,
  Trash2,
  Truck,
  User,
  Shield,
  Calendar,
  Clock,
  Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface NewInspectionFormProps {
  onInspectionCreated: (newInspection: Inspection) => void;
  onViewHistory: () => void;
}

// Suggestions d'observations rapides selon le critère pour saisie à un doigt
const QUICK_OBSERVATION_PRESETS: Record<string, string[]> = {
  crit_camion_hygiene: ['Sol souillé de boue', 'Résidus de poussière sur les parois', 'Absence de nettoyage récent'],
  crit_bidons_proprete: ['Traces de lait séché en surface', 'Bidons extérieurs boueux', 'Résidus incrustés au fond'],
  crit_couvercles_etancheite: ['Joint manquant ou fendu', 'Fuite de lait constatée', 'Fermeture instable'],
  crit_couvercles_proprete: ['Dépôts gras sur couvercle', 'Couvercle non nettoyé', 'Résidus organiques'],
  crit_absence_autres_produits: ['Présence de bidons d’huile/essence', 'Matériel de mécanique dans la benne', 'Colis sans rapport'],
  crit_absence_rouille: ['Corrosion active sur les ridelles', 'Rouille sur collerette bidon', 'Peinture écaillée'],
  crit_scellage_metallique: ['Barre de scellage tordue', 'Verrouillage impossible', 'Jeu excessif'],
  crit_absence_infestation: ['Présence de mouches dans le caisson', 'Fourmis constatées près des bidons', 'Moucherons'],
  crit_ambiance_odeur: ['Forte odeur de carburant/gasoil', 'Odeur de fermentation aigre', 'Odeur de détergent agressif'],
  crit_etat_plafond: ['Plafond fendu', 'Condensation tombante avec moisissures', 'Revêtement détaché'],
  crit_plomb_securite: ['Plomb absent au déchargement', 'Scellé brisé ou non conforme', 'Numéro de plomb non concordant'],
  crit_pers_hygiene_mains: ['Mains visiblement souillées', 'Ongles longs et non brossés', 'Port de bagues fantaisie'],
  crit_pers_tenues_travail: ['Absence de charlotte/coiffe', 'Bottes non lavées', 'Blouse de travail sale ou déchirée'],
  crit_pers_comportement: ['Opérateur fumant sur le quai', 'Manipulation brutale des bidons', 'Téléphone en main pendant transvasement'],
};

export const NewInspectionForm: React.FC<NewInspectionFormProps> = ({
  onInspectionCreated,
  onViewHistory,
}) => {
  // Date & Heure actuelles par défaut
  const todayStr = new Date().toISOString().slice(0, 10);
  const nowTimeStr = new Date().toTimeString().slice(0, 5);

  const [date, setDate] = useState<string>(todayStr);
  const [time, setTime] = useState<string>(nowTimeStr);
  const [week, setWeek] = useState<string>(getISOWeekString(todayStr));
  const [reference, setReference] = useState<string>(generateInspectionReference('', todayStr, getISOWeekString(todayStr)));

  // Fournisseurs
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [isAddingSupplier, setIsAddingSupplier] = useState<boolean>(false);
  const [newSupplierName, setNewSupplierName] = useState<string>('');

  // Chauffeur & Contrôleur
  const [driverName, setDriverName] = useState<string>('');
  const [inspectorName, setInspectorName] = useState<string>(DEFAULT_INSPECTORS[0]);

  // Autres observations
  const [otherObservations, setOtherObservations] = useState<string>('');

  // Liste active des critères (officiels + personnalisés)
  const [criteriaDefs, setCriteriaDefs] = useState<CriterionDefinition[]>(() => getStoredCriteria());

  // Modal d'ajout de critère
  const [isAddCriterionModalOpen, setIsAddCriterionModalOpen] = useState(false);
  const [addCriterionSection, setAddCriterionSection] = useState<'vehicule_bidons' | 'personnel'>('vehicule_bidons');
  const [suggestedCode, setSuggestedCode] = useState('A.12');

  // État des critères
  const [criteriaState, setCriteriaState] = useState<Record<string, {
    value: EvaluationValue;
    observation: string;
    photos: string[];
    showObservationField: boolean;
  }>>({});

  // Modal Photo
  const [activePhotoModalCriterion, setActivePhotoModalCriterion] = useState<{
    id: string;
    label: string;
  } | null>(null);

  // Erreurs de validation
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showSuccessBanner, setShowSuccessBanner] = useState<boolean>(false);

  // Initialisation des fournisseurs et critères
  useEffect(() => {
    const list = getStoredSuppliers();
    setSuppliers(list);
    if (list.length > 0) {
      setSelectedSupplier(list[0].name);
    }

    const currentCriteria = getStoredCriteria();
    setCriteriaDefs(currentCriteria);

    const initial: typeof criteriaState = {};
    currentCriteria.forEach((crit) => {
      initial[crit.id] = {
        value: null,
        observation: '',
        photos: [],
        showObservationField: false,
      };
    });
    setCriteriaState(initial);
  }, []);

  // Recalcul de la référence (fournisseur-année-semaine) et de la Semaine S: quand la date ou le fournisseur change
  useEffect(() => {
    const calculatedWeek = getISOWeekString(date);
    setWeek(calculatedWeek);
    setReference(generateInspectionReference(selectedSupplier, date, calculatedWeek));
  }, [date, selectedSupplier]);

  // Ajout rapide d'un nouveau fournisseur
  const handleAddNewSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    const added = saveSupplier(newSupplierName);
    setSuppliers(getStoredSuppliers());
    setSelectedSupplier(added.name);
    setNewSupplierName('');
    setIsAddingSupplier(false);
  };

  // Mettre à jour l'évaluation d'un critère (1, 0, N.A)
  const setCriterionEvaluation = (critId: string, value: EvaluationValue) => {
    setCriteriaState((prev) => {
      const current = prev[critId] || { value: null, observation: '', photos: [], showObservationField: false };
      const isZero = value === '0';
      return {
        ...prev,
        [critId]: {
          ...current,
          value,
          // Si 0, ouvrir obligatoirement le champ observation
          showObservationField: isZero ? true : current.showObservationField,
        },
      };
    });
    // Effacer l'erreur liée à ce critère
    setValidationErrors((prev) => prev.filter((err) => !err.includes(critId)));
  };

  // Gestion des critères personnalisés
  const handleOpenAddCriterion = (section: 'vehicule_bidons' | 'personnel') => {
    setAddCriterionSection(section);
    setSuggestedCode(getNextCriterionCode(criteriaDefs, section));
    setIsAddCriterionModalOpen(true);
  };

  const handleAddCriterion = (newCrit: {
    code: string;
    sectionId: 'vehicule_bidons' | 'personnel';
    label: string;
    description?: string;
  }) => {
    const saved = saveCustomCriterion(newCrit);
    const updated = getStoredCriteria();
    setCriteriaDefs(updated);

    // Initialiser l'état du nouveau critère
    setCriteriaState((prev) => ({
      ...prev,
      [saved.id]: {
        value: null,
        observation: '',
        photos: [],
        showObservationField: false,
      },
    }));
  };

  const handleDeleteCriterion = (critId: string, label: string) => {
    if (window.confirm(`Confirmez-vous la suppression du critère personnalisé "${label}" ?`)) {
      deleteCustomCriterion(critId);
      const updated = getStoredCriteria();
      setCriteriaDefs(updated);
      setCriteriaState((prev) => {
        const copy = { ...prev };
        delete copy[critId];
        return copy;
      });
    }
  };

  // Mettre à jour l'observation
  const setCriterionObservation = (critId: string, text: string) => {
    setCriteriaState((prev) => ({
      ...prev,
      [critId]: {
        ...prev[critId],
        observation: text,
      },
    }));
  };

  // Tout marquer Conforme (1) pour un contrôle express
  const handleSetAllCompliant = () => {
    setCriteriaState((prev) => {
      const updated = { ...prev };
      criteriaDefs.forEach((c) => {
        updated[c.id] = {
          value: '1',
          observation: updated[c.id]?.observation || '',
          photos: updated[c.id]?.photos || [],
          showObservationField: false,
        };
      });
      return updated;
    });
    setValidationErrors([]);
  };

  // Réinitialiser le formulaire
  const handleReset = () => {
    const resetState: typeof criteriaState = {};
    criteriaDefs.forEach((crit) => {
      resetState[crit.id] = {
        value: null,
        observation: '',
        photos: [],
        showObservationField: false,
      };
    });
    setCriteriaState(resetState);
    setOtherObservations('');
    setValidationErrors([]);
  };

  // Calcul en direct du statut
  const criteriaList = criteriaDefs.map((c) => ({
    def: c,
    state: criteriaState[c.id] || { value: null, observation: '', photos: [], showObservationField: false },
  }));

  const totalEvaluated = criteriaList.filter((c) => c.state.value !== null).length;
  const nonCompliantCount = criteriaList.filter((c) => c.state.value === '0').length;
  const compliantCount = criteriaList.filter((c) => c.state.value === '1').length;
  const naCount = criteriaList.filter((c) => c.state.value === 'NA').length;

  let calculatedStatus: GlobalStatus = 'EN COURS';
  if (totalEvaluated > 0) {
    if (nonCompliantCount > 0) {
      calculatedStatus = 'NON CONFORME';
    } else if (totalEvaluated === criteriaDefs.length) {
      calculatedStatus = 'CONFORME';
    }
  }

  const effectiveCriteriaCount = compliantCount + nonCompliantCount;
  const liveComplianceRate =
    effectiveCriteriaCount > 0
      ? Math.round((compliantCount / effectiveCriteriaCount) * 100)
      : 100;

  // Soumission et validation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    // Vérifier informations générales
    if (!selectedSupplier) {
      errors.push('Veuillez sélectionner un fournisseur.');
    }
    if (!inspectorName.trim()) {
      errors.push('Veuillez renseigner le nom du contrôleur.');
    }

    // Vérifier que tous les critères ont été évalués
    const missingEvaluations = criteriaDefs.filter(
      (c) => !criteriaState[c.id] || criteriaState[c.id].value === null
    );
    if (missingEvaluations.length > 0) {
      errors.push(
        `Il reste ${missingEvaluations.length} critère(s) non évalué(s). Veuillez renseigner 1, 0 ou N.A pour chacun.`
      );
    }

    // Vérifier la règle HACCP stricte demandée par le client :
    // "le champ Observation devient obligatoire lorsqu'un critère est 0"
    const zeroWithoutObservation = criteriaDefs.filter(
      (c) => criteriaState[c.id]?.value === '0' && !criteriaState[c.id]?.observation.trim()
    );

    if (zeroWithoutObservation.length > 0) {
      const names = zeroWithoutObservation.map((c) => `${c.code} (${c.label})`).join(', ');
      errors.push(
        `Observation obligatoire manquante pour le(s) critère(s) non-conforme(s) : ${names}`
      );
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 300, behavior: 'smooth' });
      return;
    }

    // Construction de l'objet Inspection structuré
    const criteriaResults: InspectionCriterionResult[] = criteriaDefs.map((crit) => {
      const st = criteriaState[crit.id];
      return {
        criterionId: crit.id,
        code: crit.code,
        label: crit.label,
        sectionId: crit.sectionId,
        sectionTitle: crit.sectionTitle,
        category: crit.category,
        value: st.value,
        observation: st.observation.trim(),
        isNonCompliant: st.value === '0',
        photos: st.photos,
      };
    });

    const finalStatus: GlobalStatus = nonCompliantCount > 0 ? 'NON CONFORME' : 'CONFORME';

    const newInspection: Inspection = {
      id: 'insp_' + Date.now(),
      reference,
      date,
      time,
      supplier: selectedSupplier,
      week: week.trim() || getISOWeekString(date),
      driverName: driverName.trim(),
      inspectorName: inspectorName.trim(),
      criteriaResults,
      otherObservations: otherObservations.trim(),
      globalStatus: finalStatus,
      complianceRate: liveComplianceRate,
      totalEvaluated: criteriaDefs.length,
      totalCompliant: compliantCount,
      totalNonCompliant: nonCompliantCount,
      totalNA: naCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveInspection(newInspection);

    if (finalStatus === 'CONFORME') {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6', '#059669'],
        });
      } catch {
        // Confetti optionnel
      }
    }

    setShowSuccessBanner(true);
    onInspectionCreated(newInspection);
  };

  // Séparer les critères par section
  const section1Criteria = criteriaDefs.filter((c) => c.sectionId === 'vehicule_bidons');
  const section2Criteria = criteriaDefs.filter((c) => c.sectionId === 'personnel');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Bannière de confirmation après enregistrement */}
      {showSuccessBanner && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-950 text-base">Contrôle {reference} enregistré avec succès !</h4>
              <p className="text-xs text-emerald-800">
                Les données ont été stockées sous forme structurée et sont prêtes pour l'export Excel et l'analyse.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onViewHistory}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Voir dans l'historique
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSuccessBanner(false);
                // Réinitialiser pour un nouveau contrôle
                const newWeek = getISOWeekString(date);
                setWeek(newWeek);
                setReference(generateInspectionReference(selectedSupplier, date, newWeek));
                setDriverName('');
                setOtherObservations('');
                const resetState: typeof criteriaState = {};
                criteriaDefs.forEach((crit) => {
                  resetState[crit.id] = {
                    value: null,
                    observation: '',
                    photos: [],
                    showObservationField: false,
                  };
                });
                setCriteriaState(resetState);
              }}
              className="px-4 py-2 bg-white text-slate-800 border border-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Nouveau camion
            </button>
          </div>
        </div>
      )}

      {/* Cartouche d'en-tête & Informations Générales */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 text-white p-5 sm:p-6 border-b border-blue-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider">
                  SERVICE SQH
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                  Contrôle hygiène véhicule de livraison lait
                </h2>
              </div>
              <div className="flex items-center gap-2 bg-blue-950/60 border border-blue-400/40 px-3.5 py-1.5 rounded-xl self-start sm:self-auto">
                <span className="text-xs text-blue-200 font-medium">Référence auto :</span>
                <span className="font-mono text-sm font-bold text-amber-300">{reference}</span>
              </div>
            </div>
          </div>

          {/* Formulaire Informations Générales */}
          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50">
            {/* Date */}
            <div>
              <label htmlFor="input_inspection_date" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Date du contrôle *
              </label>
              <input
                id="input_inspection_date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-medium"
              />
            </div>

            {/* Heure */}
            <div>
              <label htmlFor="input_inspection_time" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Heure de réception *
              </label>
              <input
                id="input_inspection_time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-medium"
              />
            </div>

            {/* Fournisseur */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="select_supplier" className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-slate-500" />
                  Fournisseur de lait *
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingSupplier(!isAddingSupplier)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  {isAddingSupplier ? 'Sélectionner' : 'Nouveau'}
                </button>
              </div>

              {isAddingSupplier ? (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Nom nouveau fournisseur..."
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewSupplier}
                    className="px-3 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 cursor-pointer shrink-0"
                  >
                    Ajouter
                  </button>
                </div>
              ) : (
                <select
                  id="select_supplier"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-semibold"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Semaine S: */}
            <div>
              <label htmlFor="input_week_number" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Semaine S: *
              </label>
              <input
                id="input_week_number"
                type="text"
                placeholder="Ex: S38 ou 38"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-bold font-mono"
              />
            </div>

            {/* Chauffeur / Opérateur */}
            <div>
              <label htmlFor="input_driver_name" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Chauffeur / Opérateur
              </label>
              <input
                id="input_driver_name"
                type="text"
                placeholder="Nom du chauffeur livreur"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            {/* Contrôleur / Équipe Qualité */}
            <div>
              <label htmlFor="select_inspector_name" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                Contrôleur Qualité *
              </label>
              <select
                id="select_inspector_name"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs font-semibold"
              >
                {DEFAULT_INSPECTORS.map((insp) => (
                  <option key={insp} value={insp}>
                    {insp}
                  </option>
                ))}
                {!DEFAULT_INSPECTORS.includes(inspectorName) && inspectorName && (
                  <option value={inspectorName}>{inspectorName}</option>
                )}
              </select>
            </div>
          </div>

          {/* Barre d'outils d'évaluation rapide & Statut instantané */}
          <div className="bg-slate-100/90 border-t border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                id="btn_set_all_compliant"
                type="button"
                onClick={handleSetAllCompliant}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tout marquer Conforme (1)</span>
              </button>

              <button
                id="btn_reset_form"
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Effacer</span>
              </button>
            </div>

            {/* Statut calculé en temps réel */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[11px] text-slate-500 font-semibold">
                  Progression : {totalEvaluated} / {criteriaDefs.length}
                </div>
                <div className="text-xs font-bold text-slate-700">
                  Taux : {liveComplianceRate}%
                </div>
              </div>

              <div
                id="live_status_badge"
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-xs ${
                  calculatedStatus === 'CONFORME'
                    ? 'bg-emerald-600 text-white'
                    : calculatedStatus === 'NON CONFORME'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-300 text-slate-700'
                }`}
              >
                {calculatedStatus === 'CONFORME' && <CheckCircle2 className="w-4 h-4" />}
                {calculatedStatus === 'NON CONFORME' && <AlertTriangle className="w-4 h-4" />}
                {calculatedStatus === 'EN COURS' && <HelpCircle className="w-4 h-4" />}
                <span>{calculatedStatus}</span>
                {nonCompliantCount > 0 && (
                  <span className="bg-white text-rose-700 rounded-full px-1.5 py-0.2 text-[10px] font-black">
                    {nonCompliantCount} NC
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Affichage des erreurs de validation */}
        {validationErrors.length > 0 && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 text-rose-900 space-y-1.5 animate-shake">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Veuillez compléter les points suivants avant validation :</span>
            </div>
            <ul className="list-disc list-inside text-xs space-y-1 text-rose-700">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* SECTION 1 : États et propreté véhicules/bidons */}
        <div className="space-y-3">
          <div className="bg-blue-900 border border-blue-800 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-widest">
                Section 1 • Catégorie A. Camion et bidons
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                États et propreté véhicules/bidons à la réception des laits
              </h3>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs bg-blue-950/70 text-blue-200 px-3 py-1.5 rounded-lg border border-blue-700/60 font-medium">
                {section1Criteria.length} critères
              </span>
              <button
                id="btn_add_criterion_section_a"
                type="button"
                onClick={() => handleOpenAddCriterion('vehicule_bidons')}
                className="text-xs bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Insérer critère A</span>
              </button>
            </div>
          </div>

          {/* Tableau structuré à 3 colonnes bien séparées */}
          <div className="border-2 border-slate-300 rounded-2xl overflow-hidden bg-white shadow-xs">
            {/* En-tête des colonnes avec lignes de séparation nettes */}
            <div className="hidden md:grid grid-cols-12 bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider divide-x-2 divide-slate-300 border-b-2 border-slate-300">
              <div className="col-span-5 py-3 px-4 flex items-center justify-between">
                <span>Critère de Contrôle</span>
                <span className="text-[10px] text-slate-500 font-medium lowercase">Norme / Exigence</span>
              </div>
              <div className="col-span-3 py-3 px-3 text-center">
                <span>Évaluation (1 / 0 / N.A)</span>
              </div>
              <div className="col-span-4 py-3 px-4">
                <span>Observations & Justifications</span>
              </div>
            </div>

            {/* Lignes de critères séparées par une bordure horizontale */}
            <div className="divide-y-2 divide-slate-200">
              {section1Criteria.map((criterion, idx) => (
                <CriterionCard
                  key={criterion.id}
                  criterion={criterion}
                  indexNumber={idx + 1}
                  state={criteriaState[criterion.id] || { value: null, observation: '', photos: [], showObservationField: false }}
                  onSetEvaluation={(val) => setCriterionEvaluation(criterion.id, val)}
                  onSetObservation={(obs) => setCriterionObservation(criterion.id, obs)}
                  onOpenPhotoModal={() =>
                    setActivePhotoModalCriterion({ id: criterion.id, label: criterion.label })
                  }
                  onDelete={criterion.isCustom ? () => handleDeleteCriterion(criterion.id, criterion.label) : undefined}
                />
              ))}
            </div>
          </div>

          <button
            id="btn_add_criterion_section_a_bottom"
            type="button"
            onClick={() => handleOpenAddCriterion('vehicule_bidons')}
            className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/40 hover:bg-blue-50 text-blue-800 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer group"
          >
            <PlusCircle className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
            <span>Insérer un critère supplémentaire dans la Section A (Camion et bidons)</span>
          </button>
        </div>

        {/* SECTION 2 : Personnel faisant la manipulation */}
        <div className="space-y-3 pt-2">
          <div className="bg-blue-900 border border-blue-800 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="text-[11px] font-bold text-blue-200 uppercase tracking-widest">
                Section 2 • Section B
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Personnel faisant la manipulation
              </h3>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs bg-blue-950/70 text-blue-200 px-3 py-1.5 rounded-lg border border-blue-700/60 font-medium">
                {section2Criteria.length} critères
              </span>
              <button
                id="btn_add_criterion_section_b"
                type="button"
                onClick={() => handleOpenAddCriterion('personnel')}
                className="text-xs bg-blue-300 hover:bg-blue-200 text-slate-900 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Insérer critère B</span>
              </button>
            </div>
          </div>

          {/* Tableau structuré à 3 colonnes bien séparées */}
          <div className="border-2 border-slate-300 rounded-2xl overflow-hidden bg-white shadow-xs">
            {/* En-tête des colonnes avec lignes de séparation nettes */}
            <div className="hidden md:grid grid-cols-12 bg-slate-100 text-slate-800 text-xs font-bold uppercase tracking-wider divide-x-2 divide-slate-300 border-b-2 border-slate-300">
              <div className="col-span-5 py-3 px-4 flex items-center justify-between">
                <span>Critère de Contrôle</span>
                <span className="text-[10px] text-slate-500 font-medium lowercase">Norme / Exigence</span>
              </div>
              <div className="col-span-3 py-3 px-3 text-center">
                <span>Évaluation (1 / 0 / N.A)</span>
              </div>
              <div className="col-span-4 py-3 px-4">
                <span>Observations & Justifications</span>
              </div>
            </div>

            {/* Lignes de critères séparées par une bordure horizontale */}
            <div className="divide-y-2 divide-slate-200">
              {section2Criteria.map((criterion, idx) => (
                <CriterionCard
                  key={criterion.id}
                  criterion={criterion}
                  indexNumber={idx + 1}
                  state={criteriaState[criterion.id] || { value: null, observation: '', photos: [], showObservationField: false }}
                  onSetEvaluation={(val) => setCriterionEvaluation(criterion.id, val)}
                  onSetObservation={(obs) => setCriterionObservation(criterion.id, obs)}
                  onOpenPhotoModal={() =>
                    setActivePhotoModalCriterion({ id: criterion.id, label: criterion.label })
                  }
                  onDelete={criterion.isCustom ? () => handleDeleteCriterion(criterion.id, criterion.label) : undefined}
                />
              ))}
            </div>
          </div>

          <button
            id="btn_add_criterion_section_b_bottom"
            type="button"
            onClick={() => handleOpenAddCriterion('personnel')}
            className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/40 hover:bg-blue-50 text-blue-800 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer group"
          >
            <PlusCircle className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
            <span>Insérer un critère supplémentaire dans la Section B (Personnel)</span>
          </button>
        </div>

        {/* Champ Autres observations */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2 shadow-xs">
          <label htmlFor="textarea_other_observations" className="block text-sm font-bold text-slate-800">
            Autres observations générales
          </label>
          <p className="text-xs text-slate-500">
            Saisissez ici toute remarque générale sur le véhicule, l'attitude du chauffeur, la météo de livraison ou le fournisseur.
          </p>
          <textarea
            id="textarea_other_observations"
            rows={3}
            placeholder="Remarques complémentaires, incident particulier lors du déchargement..."
            value={otherObservations}
            onChange={(e) => setOtherObservations(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Bouton de validation final */}
        <div className="bg-blue-900 border border-blue-800 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div>
            <div className="font-bold text-base text-white flex items-center gap-2">
              <span>Validation et Enregistrement du Contrôle</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  nonCompliantCount > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                }`}
              >
                {nonCompliantCount > 0 ? `${nonCompliantCount} anomalie(s)` : '100% Conforme'}
              </span>
            </div>
            <p className="text-xs text-blue-200 mt-0.5">
              Enregistre automatiquement la fiche dans la base structurée pour l'historique et l'export Excel (.xlsx).
            </p>
          </div>

          <button
            id="btn_submit_inspection"
            type="submit"
            className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 text-sm"
          >
            <Send className="w-4 h-4" />
            <span>Valider le contrôle</span>
          </button>
        </div>
      </form>

      {/* Modal Photo */}
      {activePhotoModalCriterion && (
        <PhotoCaptureModal
          criterionTitle={activePhotoModalCriterion.label}
          existingPhotos={criteriaState[activePhotoModalCriterion.id]?.photos || []}
          onSavePhotos={(photos) => {
            setCriteriaState((prev) => ({
              ...prev,
              [activePhotoModalCriterion.id]: {
                ...prev[activePhotoModalCriterion.id],
                photos,
              },
            }));
          }}
          onClose={() => setActivePhotoModalCriterion(null)}
        />
      )}

      {/* Modal d'insertion d'un nouveau critère */}
      <AddCriterionModal
        isOpen={isAddCriterionModalOpen}
        onClose={() => setIsAddCriterionModalOpen(false)}
        initialSectionId={addCriterionSection}
        suggestedCode={suggestedCode}
        existingCodes={criteriaDefs.map((c) => c.code)}
        onAdd={handleAddCriterion}
      />
    </div>
  );
};

// Sous-composant pour un critère individuel
interface CriterionCardProps {
  criterion: {
    id: string;
    code: string;
    label: string;
    description?: string;
    isCustom?: boolean;
  };
  indexNumber: number;
  state: {
    value: EvaluationValue;
    observation: string;
    photos: string[];
    showObservationField: boolean;
  };
  onSetEvaluation: (val: EvaluationValue) => void;
  onSetObservation: (obs: string) => void;
  onOpenPhotoModal: () => void;
  onDelete?: () => void;
}

const CriterionCard: React.FC<CriterionCardProps> = ({
  criterion,
  state,
  onSetEvaluation,
  onSetObservation,
  onOpenPhotoModal,
  onDelete,
}) => {
  const isZero = state.value === '0';
  const isOne = state.value === '1';
  const isNA = state.value === 'NA';
  const isUnset = state.value === null;

  const presets = QUICK_OBSERVATION_PRESETS[criterion.id] || [];

  return (
    <div
      id={`criterion_card_${criterion.id}`}
      className={`transition-colors ${
        isZero
          ? 'bg-rose-50/70 hover:bg-rose-50/90'
          : isOne
          ? 'bg-white hover:bg-blue-50/30'
          : isNA
          ? 'bg-slate-50/80 hover:bg-slate-100/50'
          : 'bg-white hover:bg-slate-50/50'
      }`}
    >
      <div className="flex flex-col md:grid md:grid-cols-12 md:divide-x-2 md:divide-slate-300">
        {/* 1. COLONNE CRITÈRE (col-span-5) */}
        <div className="p-3.5 sm:p-4 md:col-span-5 flex flex-col justify-center space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200">
              {criterion.code}
            </span>
            {criterion.isCustom && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                Personnalisé
              </span>
            )}
            <h4
              className={`text-sm sm:text-base font-bold leading-snug ${
                isZero ? 'text-rose-950' : 'text-slate-900'
              }`}
            >
              {criterion.label}
            </h4>
            {criterion.isCustom && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-100/80 p-1 rounded-md transition-colors ml-auto cursor-pointer"
                title="Supprimer ce critère personnalisé"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {criterion.description && (
            <p className="text-xs text-slate-500 leading-normal pl-0.5">{criterion.description}</p>
          )}

          {/* Alerte non-conformité */}
          {isZero && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 mt-1 w-fit">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Non-conformité — Observation requise</span>
            </div>
          )}
        </div>

        {/* 2. COLONNE ÉVALUATION (col-span-3) */}
        <div className="p-3.5 sm:p-4 md:col-span-3 flex flex-col justify-center items-center bg-slate-50/40 md:bg-transparent border-t md:border-t-0 border-slate-200">
          <span className="md:hidden text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 self-start">
            Évaluation :
          </span>
          <div className="flex items-center justify-center gap-2 w-full">
            {/* Bouton 1 */}
            <button
              id={`btn_eval_1_${criterion.id}`}
              type="button"
              onClick={() => onSetEvaluation('1')}
              className={`flex-1 max-w-[72px] h-11 sm:h-12 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                isOne
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-600 ring-offset-1 font-black shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border-2 border-slate-200'
              }`}
              title="Conforme (1)"
            >
              <CheckCircle2 className={`w-4 h-4 ${isOne ? 'text-white' : 'text-emerald-600'}`} />
              <span>1</span>
            </button>

            {/* Bouton 0 */}
            <button
              id={`btn_eval_0_${criterion.id}`}
              type="button"
              onClick={() => onSetEvaluation('0')}
              className={`flex-1 max-w-[72px] h-11 sm:h-12 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                isZero
                  ? 'bg-rose-600 text-white ring-2 ring-rose-600 ring-offset-1 font-black shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 border-2 border-slate-200'
              }`}
              title="Non conforme (0)"
            >
              <XCircle className={`w-4 h-4 ${isZero ? 'text-white' : 'text-rose-600'}`} />
              <span>0</span>
            </button>

            {/* Bouton N.A */}
            <button
              id={`btn_eval_na_${criterion.id}`}
              type="button"
              onClick={() => onSetEvaluation('NA')}
              className={`flex-1 max-w-[72px] h-11 sm:h-12 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs ${
                isNA
                  ? 'bg-slate-700 text-white ring-2 ring-slate-700 ring-offset-1 font-bold shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border-2 border-slate-200'
              }`}
              title="Non applicable (N.A)"
            >
              <span>N.A</span>
            </button>
          </div>
        </div>

        {/* 3. COLONNE OBSERVATION & PHOTOS (col-span-4) */}
        <div className="p-3.5 sm:p-4 md:col-span-4 flex flex-col justify-center space-y-2 border-t md:border-t-0 border-slate-200">
          <div className="flex items-center justify-between gap-2 min-h-[26px]">
            {isZero ? (
              <span className="text-[11px] font-bold text-rose-600">
                * Motif obligatoire
              </span>
            ) : (
              <span />
            )}

            {/* Bouton photo */}
            <button
              id={`btn_photo_${criterion.id}`}
              type="button"
              onClick={onOpenPhotoModal}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                state.photos && state.photos.length > 0
                  ? 'bg-blue-100 text-blue-900 border border-blue-300 font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
              title="Prendre ou importer une photo"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>
                {state.photos && state.photos.length > 0
                  ? `${state.photos.length} photo(s)`
                  : 'Photo'}
              </span>
            </button>
          </div>

          <input
            id={`obs_${criterion.id}`}
            type="text"
            placeholder={
              isZero
                ? 'Précisez obligatoirement le motif...'
                : 'Remarque ou précision éventuelle...'
            }
            value={state.observation}
            onChange={(e) => onSetObservation(e.target.value)}
            className={`w-full text-xs px-3 py-2 rounded-xl border-2 transition-all ${
              isZero && !state.observation.trim()
                ? 'bg-rose-50/80 border-rose-400 focus:ring-2 focus:ring-rose-400 text-rose-950 placeholder-rose-400 font-medium'
                : 'bg-white border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900'
            }`}
          />

          {/* Suggestions rapides si 0 */}
          {isZero && presets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <span className="text-[10px] text-slate-500 font-semibold">Exemples :</span>
              {presets.map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => onSetObservation(preset)}
                  className="text-[10px] bg-white hover:bg-rose-100 text-slate-700 hover:text-rose-900 border border-slate-300 px-2 py-0.5 rounded transition-colors cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>
          )}

          {/* Miniatures des photos attachées */}
          {state.photos && state.photos.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              {state.photos.map((img, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-lg overflow-hidden border border-slate-300 shrink-0 shadow-2xs"
                >
                  <img src={img} alt="preuve" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
