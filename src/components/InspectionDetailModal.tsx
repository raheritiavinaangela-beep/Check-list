import React, { useState } from 'react';
import { Inspection } from '../types';
import {
  X,
  FileSpreadsheet,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';
import { exportInspectionsToExcel } from '../services/excelExport';
import {
  generatePrintableHTML,
  downloadPrintableSheetHTML,
} from '../services/printService';
import { deleteInspection, getStoredCriteria } from '../services/storage';

interface InspectionDetailModalProps {
  inspection: Inspection;
  onClose: () => void;
  onDeleted?: () => void;
  highlightCriterionCode?: string | null;
}

export const InspectionDetailModal: React.FC<InspectionDetailModalProps> = ({
  inspection,
  onClose,
  onDeleted,
  highlightCriterionCode,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const handleDownloadPrintable = () => {
    const html = generatePrintableHTML(inspection);
    downloadPrintableSheetHTML(html, inspection.reference);
    setNotification('Fiche téléchargée (prête à être enregistrée en PDF ou imprimée)');
    setTimeout(() => setNotification(null), 4000);
  };

  const handleExportSingleExcel = () => {
    exportInspectionsToExcel([inspection], `Fiche_${inspection.reference}`);
  };

  const handleDelete = () => {
    deleteInspection(inspection.id);
    if (onDeleted) {
      onDeleted();
    }
    onClose();
  };

  const isCompliant = inspection.globalStatus === 'CONFORME';

  // Séparer les critères par section
  const storedCriteria = getStoredCriteria();
  const section1 = inspection.criteriaResults.filter((c) => c.sectionId === 'vehicule_bidons');
  const section2 = inspection.criteriaResults.filter((c) => c.sectionId === 'personnel');

  return (
    <div
      id="inspection_detail_modal_overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static"
    >
      <div
        id="inspection_detail_modal_content"
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 flex flex-col print:shadow-none print:border-none print:max-h-none print:overflow-visible relative"
      >
        {/* Notification toast */}
        {notification && (
          <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {notification}
            </span>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-emerald-100 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Barre d'action supérieure (non imprimée) */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 print:hidden">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <span className="font-mono text-xs sm:text-sm px-2.5 py-1 rounded bg-slate-800 text-blue-300 font-bold">
              {inspection.reference}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                isCompliant
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {inspection.globalStatus}
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            <button
              id="btn_download_sheet_html"
              type="button"
              onClick={handleDownloadPrintable}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Télécharger la fiche A4 officielle (PDF/HTML)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger (PDF/HTML)</span>
            </button>

            <button
              id="btn_export_single_excel"
              type="button"
              onClick={handleExportSingleExcel}
              className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>

            <button
              id="btn_delete_single_sheet"
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="px-2.5 py-1.5 bg-rose-900/60 hover:bg-rose-700 text-rose-200 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Supprimer définitivement cette fiche"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Supprimer</span>
            </button>

            <button
              id="btn_close_detail_modal"
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Fiche de contrôle (Imprimable style officiel) */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-800 bg-white">
          {/* En-tête document officiel */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <span className="text-xs font-black tracking-widest text-slate-700 uppercase">
                  SERVICE SQH
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 uppercase tracking-tight">
                  Contrôle hygiène véhicule de livraison lait
                </h2>
                <div className="text-xs text-slate-600 mt-1.5 flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Résultat final :</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      isCompliant
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {inspection.globalStatus}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    (Taux : {inspection.complianceRate}%{inspection.totalNonCompliant > 0 ? ` • ${inspection.totalNonCompliant} anomalie${inspection.totalNonCompliant > 1 ? 's' : ''}` : ''})
                  </span>
                </div>
              </div>

              {/* Bloc Référence (à la place de l'ancien grand badge Résultat Final) */}
              <div className="border-2 border-slate-300 bg-slate-50 px-4 py-2 rounded-xl text-left sm:text-right self-start sm:self-auto min-w-[180px]">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Référence
                </div>
                <div className="text-base sm:text-lg font-black font-mono text-blue-700 mt-0.5">
                  {inspection.reference}
                </div>
                <div className="text-[11px] font-semibold text-slate-600">
                  Semaine {inspection.week || ''}
                </div>
              </div>
            </div>
          </div>

          {/* Métadonnées du contrôle */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Réf. Contrôle :</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{inspection.reference}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Date & Heure :</span>
              <span className="font-semibold text-slate-900">{inspection.date} à {inspection.time}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Fournisseur :</span>
              <span className="font-bold text-slate-900">{inspection.supplier}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Semaine S: :</span>
              <span className="font-bold text-blue-700 font-mono text-sm">{inspection.week || 'Non renseigné'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Chauffeur / Opérateur :</span>
              <span className="font-semibold text-slate-900">{inspection.driverName || 'Non renseigné'}</span>
            </div>
            <div className="sm:col-span-3">
              <span className="text-slate-500 block">Contrôleur Qualité :</span>
              <span className="font-semibold text-slate-900">{inspection.inspectorName}</span>
            </div>
          </div>

          {/* Section 1 : États et propreté véhicules/bidons */}
          <div className="space-y-3">
            <div className="bg-blue-900 border border-blue-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-between shadow-xs">
              <span>États et propreté véhicules/bidons à la réception des laits</span>
              <span className="text-xs font-semibold text-amber-300">Catégorie A. Camion et bidons</span>
            </div>

            <div className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs bg-white">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b-2 border-slate-300 divide-x-2 divide-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 w-14 text-center">N°</th>
                    <th className="py-2.5 px-4">Critère de Contrôle</th>
                    <th className="py-2.5 px-3 w-28 text-center">Évaluation</th>
                    <th className="py-2.5 px-4">Observations & Remarques</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {section1.map((c) => {
                    const isZero = c.value === '0';
                    const isHighlighted =
                      highlightCriterionCode &&
                      (c.code === highlightCriterionCode || c.criterionId === highlightCriterionCode);
                    const def = storedCriteria.find((item) => item.id === c.criterionId || item.code === c.code);
                    return (
                      <tr
                        key={c.criterionId}
                        className={`${
                          isHighlighted
                            ? 'bg-amber-100/90 ring-2 ring-amber-500 font-medium'
                            : isZero
                            ? 'bg-rose-50/70'
                            : 'hover:bg-slate-50/60'
                        } divide-x divide-slate-200 transition-colors`}
                      >
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-900 bg-slate-50/50">
                          {c.code}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{c.label}</span>
                            {isHighlighted && (
                              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-2xs">
                                Critère ciblé
                              </span>
                            )}
                          </div>
                          {def?.description && (
                            <div className="text-[11px] text-slate-500 font-normal mt-0.5">{def.description}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center font-bold px-3 py-1 rounded-md text-xs ${
                              c.value === '1'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : c.value === '0'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300 font-extrabold'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {c.value === '1' ? '1' : c.value === '0' ? '0' : 'N.A'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {c.observation ? (
                            <span className={isZero ? 'text-rose-900 font-medium' : 'text-slate-700'}>
                              {c.observation}
                            </span>
                          ) : null}

                          {c.photos && c.photos.length > 0 && (
                            <div className="flex gap-2 mt-1.5">
                              {c.photos.map((img, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setSelectedImage(img)}
                                  className="w-8 h-8 rounded border border-slate-300 overflow-hidden hover:opacity-80 cursor-pointer"
                                  title="Agrandir la photo"
                                >
                                  <img src={img} alt="preuve" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2 : Personnel faisant la manipulation */}
          <div className="space-y-3">
            <div className="bg-blue-900 border border-blue-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-between shadow-xs">
              <span>Personnel faisant la manipulation</span>
              <span className="text-xs font-semibold text-blue-200">Catégorie B. Personnel</span>
            </div>

            <div className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs bg-white">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b-2 border-slate-300 divide-x-2 divide-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 w-14 text-center">N°</th>
                    <th className="py-2.5 px-4">Critère de Contrôle</th>
                    <th className="py-2.5 px-3 w-28 text-center">Évaluation</th>
                    <th className="py-2.5 px-4">Observations & Remarques</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {section2.map((c) => {
                    const isZero = c.value === '0';
                    const isHighlighted =
                      highlightCriterionCode &&
                      (c.code === highlightCriterionCode || c.criterionId === highlightCriterionCode);
                    const def = storedCriteria.find((item) => item.id === c.criterionId || item.code === c.code);
                    return (
                      <tr
                        key={c.criterionId}
                        className={`${
                          isHighlighted
                            ? 'bg-amber-100/90 ring-2 ring-amber-500 font-medium'
                            : isZero
                            ? 'bg-rose-50/70'
                            : 'hover:bg-slate-50/60'
                        } divide-x divide-slate-200 transition-colors`}
                      >
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-900 bg-slate-50/50">
                          {c.code}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{c.label}</span>
                            {isHighlighted && (
                              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-2xs">
                                Critère ciblé
                              </span>
                            )}
                          </div>
                          {def?.description && (
                            <div className="text-[11px] text-slate-500 font-normal mt-0.5">{def.description}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center font-bold px-3 py-1 rounded-md text-xs ${
                              c.value === '1'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : c.value === '0'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300 font-extrabold'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {c.value === '1' ? '1' : c.value === '0' ? '0' : 'N.A'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {c.observation ? (
                            <span className={isZero ? 'text-rose-900 font-medium' : 'text-slate-700'}>
                              {c.observation}
                            </span>
                          ) : null}

                          {c.photos && c.photos.length > 0 && (
                            <div className="flex gap-2 mt-1.5">
                              {c.photos.map((img, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setSelectedImage(img)}
                                  className="w-8 h-8 rounded border border-slate-300 overflow-hidden hover:opacity-80 cursor-pointer"
                                  title="Agrandir la photo"
                                >
                                  <img src={img} alt="preuve" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Autres observations */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Autres observations générales
            </h4>
            <p className="text-sm text-slate-800 italic">
              {inspection.otherObservations || 'Aucune remarque générale supplémentaire mentionnée.'}
            </p>
          </div>

          {/* Signatures zone pour impression officielle */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-300 text-xs">
            <div className="border border-slate-200 rounded-xl p-4 min-h-[100px] flex flex-col justify-between">
              <span className="font-bold text-slate-700">Visa / Signature du Chauffeur - Livreur :</span>
              <div className="border-b border-dashed border-slate-300 pt-8 text-[11px] text-slate-400">
                Nom : {inspection.driverName || '...........................................'}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 min-h-[100px] flex flex-col justify-between">
              <span className="font-bold text-slate-700">Visa / Signature Contrôleur Qualité :</span>
              <div className="border-b border-dashed border-slate-300 pt-8 text-[11px] text-slate-400">
                Nom : {inspection.inspectorName}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Confirmation de Suppression */}
        {showConfirmDelete && (
          <div
            id="modal_confirm_delete_sheet"
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
                  Cette action retirera la fiche du registre d'hygiène et est irréversible.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1 font-mono text-slate-700">
                <div><span className="text-slate-400 font-sans">Référence :</span> <span className="font-bold text-blue-700">{inspection.reference}</span></div>
                <div><span className="text-slate-400 font-sans">Date :</span> {inspection.date} ({inspection.time})</div>
                <div><span className="text-slate-400 font-sans">Fournisseur :</span> <strong className="text-slate-900">{inspection.supplier}</strong></div>
                <div><span className="text-slate-400 font-sans">Semaine :</span> {inspection.week || 'N/A'}</div>
                <div><span className="text-slate-400 font-sans">Statut :</span> {inspection.globalStatus}</div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  id="btn_confirm_delete_sheet_action"
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirmer la suppression</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Lightbox Photo Agrandie */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-3xl max-h-[85vh] bg-white rounded-xl overflow-hidden p-2">
              <img src={selectedImage} alt="Agrandissement preuve" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 bg-slate-900/80 text-white p-1.5 rounded-full hover:bg-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
