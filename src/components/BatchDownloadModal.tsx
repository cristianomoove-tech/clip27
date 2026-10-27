import React, { useState, useRef } from 'react';
import { 
  X, 
  Download, 
  Archive, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  Video, 
  RefreshCw,
  FolderArchive
} from 'lucide-react';
import { CreativeVariation, Project } from '../types';
import { exportVariationsToZip, ZipExportProgress } from '../services/zipExporter';

interface BatchDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  variations: CreativeVariation[];
}

export const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  isOpen,
  onClose,
  project,
  variations,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ZipExportProgress | null>(null);
  const [completed, setCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef(false);

  if (!isOpen) return null;

  const handleStartExport = async (subsetCount?: number) => {
    setIsExporting(true);
    setCompleted(false);
    setErrorMsg(null);
    abortRef.current = false;

    const listToExport = subsetCount ? variations.slice(0, subsetCount) : variations;

    try {
      const blob = await exportVariationsToZip(
        listToExport,
        project.name || 'Criativos_3x3x3',
        (prog) => setProgress(prog),
        () => abortRef.current
      );

      // Trigger automatic browser download
      const safeProjectName = (project.name || 'criativos_3x3x3').replace(/[^a-zA-Z0-9_-]/g, '_');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pacote_${safeProjectName}_${listToExport.length}videos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCompleted(true);
    } catch (err: any) {
      if (err.message !== 'Cancelado pelo usuário.') {
        setErrorMsg('Ocorreu um erro ao gerar os vídeos. Tente novamente.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
    setIsExporting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-lg glass-card rounded-3xl border border-purple-500/30 p-6 sm:p-7 shadow-[0_0_60px_rgba(168,85,247,0.3)] relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-purple-500/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(217,70,239,0.4)] shrink-0">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Baixar Vídeos + Capas (.ZIP)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                  MP4 + CAPAS PNG
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                  {variations.length} vídeos + {variations.length} capas
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Empacota os vídeos MP4 9:16 com áudio masterizado junto com as Capas de Alto Impacto (.PNG) de cada vídeo.
              </p>
            </div>
          </div>

          <button
            onClick={handleCancel}
            disabled={isExporting}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {!isExporting && !completed && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/25 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-fuchsia-300 font-bold">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>O que vem incluso no arquivo .ZIP:</span>
              </div>
              <ul className="space-y-2 text-slate-300 pl-1">
                <li className="flex items-start gap-2">
                  <Video className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>{variations.length} Vídeos .MP4 Limpos + {variations.length} Capas .PNG de Alto Impacto</strong> (com a 1ª imagem do Gancho de fundo) prontos na proporção 9:16.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Áudio Masterizado 48kHz / 320kbps (-14 LUFS)</strong> com clareza vocal, filtro anti-ruído, sincronia exata e hash anti-shadowban.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <FileText className="w-3.5 h-3.5 text-fuchsia-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Relatório Completo TXT &amp; JSON</strong> com todas as Legendas SEO prontas para copiar e colar no TikTok.
                  </span>
                </li>
              </ul>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => handleStartExport()}
                className="w-full min-h-[48px] flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-black text-xs text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(217,70,239,0.35)] transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Todos os {variations.length} Vídeos + {variations.length} Capas (.ZIP)</span>
              </button>

              {variations.length > 9 && (
                <button
                  onClick={() => handleStartExport(9)}
                  className="w-full min-h-[42px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-purple-500/30 transition-all cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5 text-purple-400" />
                  <span>Baixar Pacote Rápido (9 Primeiros Vídeos + 9 Capas .ZIP)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Exporting Progress State */}
        {isExporting && (
          <div className="py-6 space-y-5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-950/60 border border-fuchsia-500/40 flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(217,70,239,0.3)]">
              <RefreshCw className="w-8 h-8 text-fuchsia-400 animate-spin" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-white">
                Renderizando e Empacotando Vídeos...
              </h4>
              <p className="text-xs text-fuchsia-300 font-mono">
                {progress?.statusText || 'Processando sequência...'}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 max-w-sm mx-auto">
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-purple-500/20 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress?.percent || 5}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono px-1">
                <span>{progress?.currentIndex || 1} de {progress?.totalCount || variations.length} vídeos</span>
                <span className="text-white font-bold">{progress?.percent || 5}%</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Por favor, não feche esta janela enquanto os vídeos são gravados e compactados em ZIP.
            </p>

            <button
              onClick={handleCancel}
              className="text-xs text-rose-400 hover:text-rose-300 underline font-medium cursor-pointer"
            >
              Cancelar Exportação
            </button>
          </div>
        )}

        {/* Completed State */}
        {completed && (
          <div className="py-6 space-y-4 text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.3)]">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">
                Download do Arquivo ZIP Iniciado!
              </h4>
              <p className="text-xs text-slate-300 max-w-xs mx-auto">
                Todos os vídeos foram montados com sucesso combinando seus clipes e salvos na sua pasta de Downloads.
              </p>
            </div>

            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-500 shadow-sm cursor-pointer"
            >
              Concluir
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
