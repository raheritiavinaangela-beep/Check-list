import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Inspection, SupplierOption, CriterionDefinition } from '../types';

let app: FirebaseApp;
let db: Firestore;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  // Utiliser la base de données spécifique provisionnée si définie
  if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } else {
    db = getFirestore(app);
  }
} catch (error) {
  console.error('Erreur initialisation Firebase:', error);
}

export { db };

/**
 * Nettoie les valeurs `undefined` non supportées par Firestore
 */
function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return data;
}

const COLLECTION_INSPECTIONS = 'inspections';
const COLLECTION_SUPPLIERS = 'suppliers';
const COLLECTION_CRITERIA = 'criteria';

// =========================================================================
// GESTION DES INSPECTIONS (FIRESTORE)
// =========================================================================

/**
 * Abonnement en temps réel aux inspections Firestore
 */
export function subscribeToInspections(
  onUpdate: (inspections: Inspection[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db) {
    return () => {};
  }

  try {
    const colRef = collection(db, COLLECTION_INSPECTIONS);
    const q = query(colRef);

    return onSnapshot(
      q,
      (snapshot) => {
        const list: Inspection[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Inspection;
          list.push({ ...data, id: docSnap.id });
        });
        // Tri décroissant par date de création ou de contrôle
        list.sort((a, b) => {
          const dateA = a.createdAt || a.date;
          const dateB = b.createdAt || b.date;
          return dateB.localeCompare(dateA);
        });
        onUpdate(list);
      },
      (err) => {
        console.warn('Erreur écoute Firestore inspections:', err);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.warn('Impossible de souscrire aux inspections Firestore:', err);
    return () => {};
  }
}

/**
 * Enregistrement / Mise à jour d'une inspection dans Firestore
 */
export async function saveInspectionToFirestore(inspection: Inspection): Promise<void> {
  if (!db) return;
  const docRef = doc(db, COLLECTION_INSPECTIONS, inspection.id);
  const sanitized = sanitizeForFirestore(inspection);
  await setDoc(docRef, sanitized, { merge: true });
}

/**
 * Suppression d'une inspection dans Firestore
 */
export async function deleteInspectionFromFirestore(id: string): Promise<void> {
  if (!db) return;
  const docRef = doc(db, COLLECTION_INSPECTIONS, id);
  await deleteDoc(docRef);
}

// =========================================================================
// GESTION DES FOURNISSEURS (FIRESTORE)
// =========================================================================

export function subscribeToSuppliers(
  onUpdate: (suppliers: SupplierOption[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db) return () => {};

  try {
    const colRef = collection(db, COLLECTION_SUPPLIERS);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: SupplierOption[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as SupplierOption), id: docSnap.id });
        });
        onUpdate(list);
      },
      (err) => {
        console.warn('Erreur écoute fournisseurs Firestore:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('Impossible de souscrire aux fournisseurs:', err);
    return () => {};
  }
}

export async function saveSupplierToFirestore(supplier: SupplierOption): Promise<void> {
  if (!db) return;
  const docRef = doc(db, COLLECTION_SUPPLIERS, supplier.id);
  await setDoc(docRef, sanitizeForFirestore(supplier), { merge: true });
}

// =========================================================================
// GESTION DES CRITÈRES PERSONNALISÉS (FIRESTORE)
// =========================================================================

export function subscribeToCriteria(
  onUpdate: (criteria: CriterionDefinition[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!db) return () => {};

  try {
    const colRef = collection(db, COLLECTION_CRITERIA);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: CriterionDefinition[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as CriterionDefinition), id: docSnap.id });
        });
        onUpdate(list);
      },
      (err) => {
        console.warn('Erreur écoute critères Firestore:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('Impossible de souscrire aux critères:', err);
    return () => {};
  }
}

export async function saveCriterionToFirestore(criterion: CriterionDefinition): Promise<void> {
  if (!db) return;
  const docRef = doc(db, COLLECTION_CRITERIA, criterion.id);
  await setDoc(docRef, sanitizeForFirestore(criterion), { merge: true });
}

export async function deleteCriterionFromFirestore(id: string): Promise<void> {
  if (!db) return;
  const docRef = doc(db, COLLECTION_CRITERIA, id);
  await deleteDoc(docRef);
}

// =========================================================================
// MIGRATION & AMORÇAGE INITIAL
// =========================================================================

/**
 * Vérifie si la base de données Firestore contient déjà des données.
 * Si elle est vide, on y transfère les inspections déjà saisies localement.
 */
export async function seedFirestoreIfEmpty(localInspections: Inspection[]): Promise<boolean> {
  if (!db || localInspections.length === 0) return false;

  try {
    const colRef = collection(db, COLLECTION_INSPECTIONS);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      console.log('Migration initiale des données locales vers Firebase Firestore...');
      for (const insp of localInspections) {
        await saveInspectionToFirestore(insp);
      }
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Échec de la vérification/migration Firestore:', err);
    return false;
  }
}
