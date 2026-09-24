import { Inspection, SupplierOption, CriterionDefinition } from '../types';
import { OFFICIAL_CRITERIA, DEFAULT_SUPPLIERS } from '../data/initialCriteria';
import {
  saveInspectionToFirestore,
  deleteInspectionFromFirestore,
  saveSupplierToFirestore,
  saveCriterionToFirestore,
  deleteCriterionFromFirestore,
} from './firebase';

const STORAGE_KEY_INSPECTIONS = 'lait_hygiene_inspections_v3';
const STORAGE_KEY_SUPPLIERS = 'lait_hygiene_suppliers_v3';
const STORAGE_KEY_CRITERIA = 'lait_hygiene_criteria_v3';

export function getStoredCriteria(): CriterionDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CRITERIA);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_CRITERIA, JSON.stringify(OFFICIAL_CRITERIA));
      return OFFICIAL_CRITERIA;
    }
    const parsed: CriterionDefinition[] = JSON.parse(raw);
    // Assurer que tous les critères officiels de base sont conservés
    const officialIds = new Set(OFFICIAL_CRITERIA.map((c) => c.id));
    const customItems = parsed.filter((c) => !officialIds.has(c.id));
    return [
      ...OFFICIAL_CRITERIA,
      ...customItems.map((c) => ({ ...c, isCustom: true })),
    ];
  } catch (err) {
    console.error('Erreur lecture critères', err);
    return OFFICIAL_CRITERIA;
  }
}

export function saveCustomCriterion(newCrit: {
  code: string;
  sectionId: 'vehicule_bidons' | 'personnel';
  label: string;
  description?: string;
}): CriterionDefinition {
  const current = getStoredCriteria();
  const id = `crit_custom_${Date.now()}`;
  const sectionTitle =
    newCrit.sectionId === 'vehicule_bidons'
      ? 'États et propreté véhicules/bidons à la réception des laits'
      : 'Personnel faisant la manipulation';
  const category =
    newCrit.sectionId === 'vehicule_bidons'
      ? 'A. Camion et bidons'
      : 'B. Personnel';

  const criterion: CriterionDefinition = {
    id,
    code: newCrit.code.trim().toUpperCase(),
    sectionId: newCrit.sectionId,
    sectionTitle,
    category,
    label: newCrit.label.trim(),
    description: newCrit.description?.trim() || '',
    isCustom: true,
  };

  const updated = [...current, criterion];
  localStorage.setItem(STORAGE_KEY_CRITERIA, JSON.stringify(updated));

  saveCriterionToFirestore(criterion).catch((err) => {
    console.warn('Erreur synchro critère Firestore:', err);
  });

  return criterion;
}

export function deleteCustomCriterion(criterionId: string): void {
  const current = getStoredCriteria();
  // On ne supprime que si ce n'est pas un critère de base officiel
  const updated = current.filter((c) => c.id !== criterionId);
  localStorage.setItem(STORAGE_KEY_CRITERIA, JSON.stringify(updated));

  deleteCriterionFromFirestore(criterionId).catch((err) => {
    console.warn('Erreur suppression critère Firestore:', err);
  });
}

export function getNextCriterionCode(
  criteria: CriterionDefinition[],
  sectionId: 'vehicule_bidons' | 'personnel'
): string {
  const prefix = sectionId === 'vehicule_bidons' ? 'A' : 'B';
  const numbers = criteria
    .filter((c) => c.sectionId === sectionId)
    .map((c) => {
      const match = c.code.match(/^[AB]\.?(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n));

  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `${prefix}.${max + 1}`;
}

export function getISOWeekString(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return 'S01';
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return `S${weekNumber.toString().padStart(2, '0')}`;
  } catch {
    return 'S01';
  }
}

export function getStoredSuppliers(): SupplierOption[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUPPLIERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(DEFAULT_SUPPLIERS));
      return DEFAULT_SUPPLIERS;
    }
    const parsed: SupplierOption[] = JSON.parse(raw);
    // S'assurer que les 8 fournisseurs officiels sont tous présents
    const missingOfficial = DEFAULT_SUPPLIERS.filter(
      (def) => !parsed.some((p) => p.name.trim().toLowerCase() === def.name.trim().toLowerCase())
    );
    if (missingOfficial.length > 0) {
      const merged = [...DEFAULT_SUPPLIERS, ...parsed.filter(p => !DEFAULT_SUPPLIERS.some(d => d.name.toLowerCase() === p.name.toLowerCase()))];
      localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(merged));
      return merged;
    }
    return parsed;
  } catch {
    return DEFAULT_SUPPLIERS;
  }
}

export function saveSupplier(supplierName: string): SupplierOption {
  const list = getStoredSuppliers();
  const existing = list.find((s) => s.name.toLowerCase() === supplierName.trim().toLowerCase());
  if (existing) return existing;

  const newSupplier: SupplierOption = {
    id: 'sup_' + Date.now(),
    name: supplierName.trim(),
  };
  const updated = [newSupplier, ...list];
  localStorage.setItem(STORAGE_KEY_SUPPLIERS, JSON.stringify(updated));

  saveSupplierToFirestore(newSupplier).catch((err) => {
    console.warn('Erreur synchro fournisseur Firestore:', err);
  });

  return newSupplier;
}

export function generateInspectionReference(supplierName?: string, dateStr?: string, weekStr?: string): string {
  const cleanDate = dateStr || new Date().toISOString().slice(0, 10);
  const year = cleanDate.slice(0, 4);
  const week = weekStr || getISOWeekString(cleanDate);
  const cleanSupplier = (supplierName && supplierName.trim()) ? supplierName.trim() : 'FOURNISSEUR';
  return `${cleanSupplier}-${year}-${week}`;
}

export function getStoredInspections(): Inspection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INSPECTIONS);
    if (!raw) {
      const seeded = generateInitialMockInspections();
      localStorage.setItem(STORAGE_KEY_INSPECTIONS, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erreur lecture localStorage', err);
    return [];
  }
}

export function saveInspection(inspection: Inspection): void {
  const current = getStoredInspections();
  const index = current.findIndex((i) => i.id === inspection.id);
  let updated: Inspection[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...inspection, updatedAt: new Date().toISOString() };
  } else {
    updated = [inspection, ...current];
  }
  localStorage.setItem(STORAGE_KEY_INSPECTIONS, JSON.stringify(updated));

  // Sauvegarde instantanée dans Firebase Firestore
  saveInspectionToFirestore(inspection).catch((err) => {
    console.warn('Erreur synchro Firestore inspection:', err);
  });
}

export function deleteInspection(id: string): void {
  const current = getStoredInspections();
  const filtered = current.filter((i) => i.id !== id);
  localStorage.setItem(STORAGE_KEY_INSPECTIONS, JSON.stringify(filtered));

  // Suppression instantanée dans Firebase Firestore
  deleteInspectionFromFirestore(id).catch((err) => {
    console.warn('Erreur suppression Firestore inspection:', err);
  });
}

export function getInspectionById(id: string): Inspection | undefined {
  const current = getStoredInspections();
  return current.find((i) => i.id === id);
}

function generateInitialMockInspections(): Inspection[] {
  // Inspection 1 : Conforme
  const r1 = OFFICIAL_CRITERIA.map((c) => ({
    criterionId: c.id,
    code: c.code,
    label: c.label,
    sectionId: c.sectionId,
    sectionTitle: c.sectionTitle,
    category: c.category,
    value: '1' as const,
    observation: '',
    isNonCompliant: false,
  }));

  // Inspection 2 : Non-conforme (rouille et odeur)
  const r2 = OFFICIAL_CRITERIA.map((c) => {
    if (c.id === 'crit_absence_rouille') {
      return {
        criterionId: c.id,
        code: c.code,
        label: c.label,
        sectionId: c.sectionId,
        sectionTitle: c.sectionTitle,
        category: c.category,
        value: '0' as const,
        observation: 'Traces d oxydation sur la ridelle droite et coins supérieurs des bidons 4 et 5.',
        isNonCompliant: true,
      };
    }
    if (c.id === 'crit_ambiance_odeur') {
      return {
        criterionId: c.id,
        code: c.code,
        label: c.label,
        sectionId: c.sectionId,
        sectionTitle: c.sectionTitle,
        category: c.category,
        value: '0' as const,
        observation: 'Forte odeur de carburant résiduel dans le caisson arrière.',
        isNonCompliant: true,
      };
    }
    return {
      criterionId: c.id,
      code: c.code,
      label: c.label,
      sectionId: c.sectionId,
      sectionTitle: c.sectionTitle,
      category: c.category,
      value: '1' as const,
      observation: '',
      isNonCompliant: false,
    };
  });

  // Inspection 3 : Non-conforme tenue & étanchéité
  const r3 = OFFICIAL_CRITERIA.map((c) => {
    if (c.id === 'crit_couvercles_etancheite') {
      return {
        criterionId: c.id,
        code: c.code,
        label: c.label,
        sectionId: c.sectionId,
        sectionTitle: c.sectionTitle,
        category: c.category,
        value: '0' as const,
        observation: 'Joint du bidon n°12 fendu, léger suintement de lait constaté.',
        isNonCompliant: true,
      };
    }
    if (c.id === 'crit_pers_tenues_travail') {
      return {
        criterionId: c.id,
        code: c.code,
        label: c.label,
        sectionId: c.sectionId,
        sectionTitle: c.sectionTitle,
        category: c.category,
        value: '0' as const,
        observation: 'Aide-chauffeur sans charlotte réglementaire et bottes non désinfectées.',
        isNonCompliant: true,
      };
    }
    return {
      criterionId: c.id,
      code: c.code,
      label: c.label,
      sectionId: c.sectionId,
      sectionTitle: c.sectionTitle,
      category: c.category,
      value: '1' as const,
      observation: '',
      isNonCompliant: false,
    };
  });

  return [
    {
      id: 'insp_seed_1',
      reference: 'RINDRA-2026-S38',
      date: '2026-09-14',
      time: '06:45',
      supplier: 'RINDRA',
      week: 'S38',
      driverName: 'Marc Randrian',
      inspectorName: 'Jean-Pierre Dupont (Qualité Laiterie)',
      criteriaResults: r1,
      otherObservations: 'Véhicule impeccable, protocole de lavage à quai respecté.',
      globalStatus: 'CONFORME',
      complianceRate: 100,
      totalEvaluated: 14,
      totalCompliant: 14,
      totalNonCompliant: 0,
      totalNA: 0,
      createdAt: '2026-09-14T06:50:00.000Z',
      updatedAt: '2026-09-14T06:50:00.000Z',
    },
    {
      id: 'insp_seed_2',
      reference: 'JULIANA-2026-S38',
      date: '2026-09-14',
      time: '07:30',
      supplier: 'JULIANA',
      week: 'S38',
      driverName: 'Andry Rabearisoa',
      inspectorName: 'Marie Christine Razafy (Contrôle Réception)',
      criteriaResults: r2,
      otherObservations: 'Avertissement verbal notifié au chauffeur. Nettoyage approfondi exigé avant la prochaine livraison.',
      globalStatus: 'NON CONFORME',
      complianceRate: 85.7,
      totalEvaluated: 14,
      totalCompliant: 12,
      totalNonCompliant: 2,
      totalNA: 0,
      createdAt: '2026-09-14T07:38:00.000Z',
      updatedAt: '2026-09-14T07:38:00.000Z',
    },
    {
      id: 'insp_seed_3',
      reference: 'RAKOTO-2026-S37',
      date: '2026-09-13',
      time: '08:15',
      supplier: 'RAKOTO',
      week: 'S37',
      driverName: 'Faly Rakoto',
      inspectorName: 'Laurent Mercier (Responsable Hygiène & HACCP)',
      criteriaResults: r3,
      otherObservations: 'Bidon n°12 isolé pour échantillonnage microbiologique complémentaire.',
      globalStatus: 'NON CONFORME',
      complianceRate: 85.7,
      totalEvaluated: 14,
      totalCompliant: 12,
      totalNonCompliant: 2,
      totalNA: 0,
      createdAt: '2026-09-13T08:25:00.000Z',
      updatedAt: '2026-09-13T08:25:00.000Z',
    },
  ];
}
