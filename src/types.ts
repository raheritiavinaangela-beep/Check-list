export type EvaluationValue = '1' | '0' | 'NA' | null;

export interface CriterionDefinition {
  id: string;
  code: string;
  sectionId: 'vehicule_bidons' | 'personnel';
  sectionTitle: string;
  category: string;
  label: string;
  description?: string;
  isCustom?: boolean;
}

export interface InspectionCriterionResult {
  criterionId: string;
  code: string;
  label: string;
  sectionId: 'vehicule_bidons' | 'personnel';
  sectionTitle: string;
  category: string;
  value: EvaluationValue;
  observation: string;
  isNonCompliant: boolean;
  photos?: string[];
}

export type GlobalStatus = 'CONFORME' | 'NON CONFORME' | 'EN COURS';

export interface Inspection {
  id: string;
  reference: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  supplier: string;
  week: string; // ex: S38 ou Semaine 38
  vehiclePlate?: string;
  driverName: string;
  inspectorName: string;
  criteriaResults: InspectionCriterionResult[];
  otherObservations: string;
  globalStatus: GlobalStatus;
  complianceRate: number; // percentage (0 - 100)
  totalEvaluated: number;
  totalCompliant: number;
  totalNonCompliant: number;
  totalNA: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierOption {
  id: string;
  name: string;
  code?: string;
}
