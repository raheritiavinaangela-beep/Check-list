import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, AlertCircle } from 'lucide-react';

interface PhotoCaptureModalProps {
  criterionTitle: string;
  existingPhotos: string[];
  onSavePhotos: (photos: string[]) => void;
  onClose: () => void;
}

export const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({
  criterionTitle,
  existingPhotos,
  onSavePhotos,
  onClose,
}) => {
  const [photos, setPhotos] = useState<string[]>(existingPhotos || []);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Accès caméra indisponible:', err);
      setCameraError(
        'Impossible d’accéder directement à la caméra (permission refusée ou appareil non supporté). Veuillez utiliser l’option importer une photo.'
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPhotos((prev) => [...prev, dataUrl]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    // Réinitialiser le input pour permettre de re-sélectionner le même fichier si besoin
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    stopCamera();
    onSavePhotos(photos);
    onClose();
  };

  return (
    <div
      id="photo_capture_modal_overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="photo_capture_modal_card"
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* En-tête */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-lg text-slate-50">Preuves photographiques d'anomalie</h3>
          </div>
          <button
            id="btn_close_photo_modal"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-900">
            <span className="font-medium">Critère concerné :</span> {criterionTitle}
          </div>

          {cameraError && (
            <div className="flex items-start gap-2 text-xs bg-rose-50 text-rose-800 p-3 rounded-lg border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Section Caméra active */}
          {isCameraActive ? (
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl text-center">
              <div className="relative overflow-hidden rounded-lg max-h-72 bg-black flex justify-center items-center">
                <video ref={videoRef} playsInline autoPlay className="w-full object-cover max-h-72" />
              </div>
              <div className="flex justify-center gap-3">
                <button
                  id="btn_capture_snapshot"
                  onClick={takeSnapshot}
                  type="button"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl flex items-center gap-2 shadow-sm cursor-pointer transition-transform active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  Prendre la photo
                </button>
                <button
                  id="btn_stop_camera"
                  onClick={stopCamera}
                  type="button"
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl cursor-pointer"
                >
                  Fermer caméra
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                id="btn_start_device_camera"
                type="button"
                onClick={startCamera}
                className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 hover:border-slate-500 hover:bg-slate-50 rounded-xl text-slate-700 transition-all cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-2 group-hover:bg-slate-200 transition-colors">
                  <Camera className="w-5 h-5 text-slate-700" />
                </div>
                <span className="font-semibold text-sm">Ouvrir l'appareil photo</span>
                <span className="text-xs text-slate-500 mt-0.5">Prendre un cliché en direct</span>
              </button>

              <label
                htmlFor="file_upload_input"
                className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 hover:border-slate-500 hover:bg-slate-50 rounded-xl text-slate-700 transition-all cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-2 group-hover:bg-slate-200 transition-colors">
                  <Upload className="w-5 h-5 text-slate-700" />
                </div>
                <span className="font-semibold text-sm">Importer depuis la galerie</span>
                <span className="text-xs text-slate-500 mt-0.5">JPEG, PNG (fichier existant)</span>
                <input
                  id="file_upload_input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Galerie des photos attachées */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Photos attachées ({photos.length})
              </span>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-6 border border-slate-100 rounded-xl bg-slate-50/50 text-slate-400 text-xs">
                Aucune photo ajoutée pour ce critère.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {photos.map((src, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square">
                    <img src={src} alt={`Anomalie ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      id={`btn_delete_photo_${idx}`}
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 bg-rose-600/90 text-white rounded-full p-1 opacity-90 hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                      title="Supprimer la photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pied de page */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            id="btn_cancel_photo_modal"
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            id="btn_save_photo_modal"
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            Valider ({photos.length} photo{photos.length > 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
};
