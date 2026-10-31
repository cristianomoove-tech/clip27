import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  Archive, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  Video, 
  RefreshCw,
  FolderArchive,
  Cpu,
  Flame
} from 'lucide-react';
import { CreativeVariation, Project } from '../types';
import { exportVariationsToZip, ZipExportProgress } from '../services/zipExporter';
import { 
  checkFFmpegServerHealth, 
  triggerFFmpegBatchRender, 
  pollFFmpegProgress, 
  getFFmpegZipDownloadUrl,
  FFmpegServerStatus 
} from '../services/ffmpegApiService';

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
  const [ffmpegStatus, setFfmpegStatus] = useState<FFmpegServerStatus | null>(null);
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [microEdits, setMicroEdits] = useState(true);
  const [isNativeFFmpegRunning, setIsNativeFFmpegRunning] = useState(false);
  const abortRef = useRef(false);

  // Check FFmpeg server status on open
  useEffect(() => {
    if (isOpen) {
      checkFFmpegServerHealth().then(setFfmpegStatus);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Native FFmpeg 27 Video Generation
  const handleStartNativeFFmpeg = async () => {
    setIsExporting(true);
    setIsNativeFFmpegRunning(true);
    setCompleted(false);
    setErrorMsg(null);

    const manchetes = variations.map((v) => v.headline || v.coverTitle).filter(Boolean);

    const startRes = await triggerFFmpegBatchRender({
      resolucao: resolution,
      micro_edits: microEdits,
      manchetes: manchetes.length > 0 ? manchetes : undefined,
    });

    if (!startRes.sucesso) {
      setErrorMsg(startRes.erro || 'Não foi possível disparar o motor FFmpeg.');
      setIsExporting(false);
      setIsNativeFFmpegRunning(false);
      return;
    }

    // Poll progress until completion
    const pollInterval = setInterval(async () => {
      const p = await pollFFmpegProgress();
      if (!p) return;

      setProgress({
        currentIndex: p.indice_atual || 0,
        totalCount: p.total_videos || 27,
        currentCode: p.video_atual || 'Preparando...',
        percent: p.progresso_percent || 0,
        statusText: p.status_texto || 'Processando com FFmpeg nativo...',
      });

      if (p.concluido) {
        clearInterval(pollInterval);
        setIsExporting(false);
        setIsNativeFFmpegRunning(false);
        setCompleted(true);

        // Download ZIP directly from local server
        window.location.href = getFFmpegZipDownloadUrl();
      } else if (p.erro) {
        clearInterval(pollInterval);
        setIsExporting(false);
        setIsNativeFFmpegRunning(false);
        setErrorMsg(`Erro no FFmpeg: ${p.erro}`);
      }
    }, 600);
  };

  // Browser-based canvas fallback export
  const handleStartBrowserExport = async (subsetCount?: number) => {
    setIsExporting(true);
    setIsNativeFFmpegRunning(false);
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
    setIsNativeFFmpegRunning(false);
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
                  MP4 + CAPA NO 1º FRAME
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                  {variations.length} vídeos
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Gera as combinações com áudio sincronizado e a capa embutida no início do vídeo.
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
            {/* Status do Motor FFmpeg Nativo */}
            {ffmpegStatus?.online ? (
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span>Motor FFmpeg Nativo Conectado (Porta 5050)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[10px] font-mono font-bold">
                    ALTA PERFORMANCE
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Renderiza diretamente pelo seu processador com FFmpeg nativo. Sem travamento de abas, sem atraso de áudio e 4x mais rápido.
                </p>

                {/* Seleção de Resolução e Opções */}
                <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Qualidade:</span>
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value as any)}
                      className="bg-slate-900 border border-emerald-500/30 rounded-lg px-2 py-1 text-xs text-emerald-300 font-semibold focus:outline-none"
                    >
                      <option value="720p">720p Vertical (720x1280) - Mais Leve</option>
                      <option value="1080p">1080p Full HD (1080x1920)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={microEdits}
                      onChange={(e) => setMicroEdits(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span>Micro-Edits TikTok</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-slate-300 space-y-1">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Dica de Especialista:</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Para renderizar com FFmpeg nativo super leve e sem travamento, abra a pasta do projeto e dê 2 cliques em <strong className="text-purple-300">iniciar_motor.bat</strong>.
                </p>
              </div>
            )}

            {/* O que vem incluso */}
            <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/20 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-fuchsia-300 font-bold">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>O que vem incluso no arquivo .ZIP:</span>
              </div>
              <ul className="space-y-1.5 text-slate-300 pl-1">
                <li className="flex items-start gap-2">
                  <Video className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>{variations.length} Vídeos .MP4 Limpos</strong> com Capa de Alto Impacto integrada no 1º frame (sem precisar baixar nada separado).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Áudio Perfeitamente Sincronizado</strong> (AAC 128k estéreo) e metadados zerados (-map_metadata -1).
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
              {ffmpegStatus?.online ? (
                <button
                  onClick={handleStartNativeFFmpeg}
                  className="w-full min-h-[48px] flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-black text-xs text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Flame className="w-4 h-4 text-yellow-300" />
                  <span>Gerar 27 Vídeos com FFmpeg Nativo ({resolution})</span>
                </button>
              ) : null}

              <button
                onClick={() => handleStartBrowserExport()}
                className={`w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  ffmpegStatus?.online
                    ? 'text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-purple-500/30'
                    : 'text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(217,70,239,0.35)]'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>
                  {ffmpegStatus?.online
                    ? `Renderizar via Navegador (Alternativo)`
                    : `Baixar Todos os ${variations.length} Vídeos (.ZIP)`}
                </span>
              </button>
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
                {isNativeFFmpegRunning
                  ? 'Renderizando com FFmpeg Nativo...'
                  : 'Renderizando e Empacotando Vídeos...'}
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
              Por favor, não feche esta janela enquanto os vídeos são processados.
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
                Todos os 27 vídeos foram renderizados com qualidade perfeita e a capa inserida no 1º frame!
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
