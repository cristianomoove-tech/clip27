import React, { useState, useRef } from 'react';
import { 
  Scissors, 
  Sparkles, 
  Upload, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  Play, 
  Pause, 
  Film, 
  AlertCircle,
  FileVideo,
  Clock,
  Zap,
  ArrowRight
} from 'lucide-react';
import { VideoClip } from '../types';
import { registerClipBlob, extractVideoFirstFrameAndDuration } from '../services/clipStore';
import { autoSplitVideoViaFFmpegServer } from '../services/ffmpegApiService';
import { getStoredSettings } from '../services/aiService';

interface AutoSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  ffmpegOnline: boolean;
  onClipsGenerated: (clipsBySlot: {
    slot: 1 | 2 | 3;
    hook: VideoClip;
    body: VideoClip;
    cta: VideoClip;
  }[]) => void;
}

export const AutoSplitModal: React.FC<AutoSplitModalProps> = ({
  isOpen,
  onClose,
  ffmpegOnline,
  onClipsGenerated,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepText, setCurrentStepText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).slice(0, 3);
      setSelectedFiles(files);
      setErrorMessage(null);
      setSuccessCount(null);
    }
  };

  const handleStartAutoSplit = async () => {
    if (selectedFiles.length === 0) {
      setErrorMessage('Por favor, selecione pelo menos 1 vídeo longo para fatiar.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProgressPercent(10);
    setCurrentStepText('Inicializando Auto-Splitter com IA...');

    const settings = getStoredSettings();
    const openRouterKey = settings.openRouterApiKey || '';
    const results: {
      slot: 1 | 2 | 3;
      hook: VideoClip;
      body: VideoClip;
      cta: VideoClip;
    }[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const slotIdx = (i + 1) as 1 | 2 | 3;
        const basePct = 10 + i * (80 / selectedFiles.length);

        setCurrentStepText(`[Vídeo ${slotIdx}/${selectedFiles.length}] Transcrevendo áudio com faster-whisper local...`);
        setProgressPercent(basePct + 10);

        if (ffmpegOnline) {
          // Usa o backend FFmpeg nativo + faster-whisper
          setCurrentStepText(`[Vídeo ${slotIdx}/${selectedFiles.length}] Analisando timestamps de Gancho, Corpo e CTA com IA...`);
          setProgressPercent(basePct + 25);

          const splitRes = await autoSplitVideoViaFFmpegServer(
            file,
            slotIdx,
            openRouterKey,
            settings.openRouterModel
          );

          setCurrentStepText(`[Vídeo ${slotIdx}/${selectedFiles.length}] Fatiando partes com FFmpeg e registrando no sistema...`);
          setProgressPercent(basePct + 35);

          // Baixa os binários fatiados de volta para a memória do navegador para persistência local
          const [hookBlob, bodyBlob, ctaBlob] = await Promise.all([
            fetch(splitRes.gancho.url).then((r) => r.blob()),
            fetch(splitRes.corpo.url).then((r) => r.blob()),
            fetch(splitRes.cta.url).then((r) => r.blob()),
          ]);

          const hookFile = new File([hookBlob], `gancho_${slotIdx}.mp4`, { type: 'video/mp4' });
          const bodyFile = new File([bodyBlob], `corpo_${slotIdx}.mp4`, { type: 'video/mp4' });
          const ctaFile = new File([ctaBlob], `cta_${slotIdx}.mp4`, { type: 'video/mp4' });

          const hookUrl = URL.createObjectURL(hookFile);
          const bodyUrl = URL.createObjectURL(bodyFile);
          const ctaUrl = URL.createObjectURL(ctaFile);

          const hookId = `autosplit-hook-${slotIdx}-${Date.now()}`;
          const bodyId = `autosplit-body-${slotIdx}-${Date.now()}`;
          const ctaId = `autosplit-cta-${slotIdx}-${Date.now()}`;

          const [hookMeta, bodyMeta, ctaMeta] = await Promise.all([
            extractVideoFirstFrameAndDuration(hookUrl, splitRes.gancho.duracao),
            extractVideoFirstFrameAndDuration(bodyUrl, splitRes.corpo.duracao),
            extractVideoFirstFrameAndDuration(ctaUrl, splitRes.cta.duracao),
          ]);

          registerClipBlob(hookId, hookFile, hookUrl, hookMeta.duration, hookMeta.thumbnailDataUrl);
          registerClipBlob(bodyId, bodyFile, bodyUrl, bodyMeta.duration, bodyMeta.thumbnailDataUrl);
          registerClipBlob(ctaId, ctaFile, ctaUrl, ctaMeta.duration, ctaMeta.thumbnailDataUrl);

          results.push({
            slot: slotIdx,
            hook: {
              id: hookId,
              type: 'hook',
              title: `Gancho ${slotIdx}: ${file.name.slice(0, 18)} (Auto)`,
              duration: hookMeta.duration,
              fileUrl: hookUrl,
              fileName: `gancho_${slotIdx}.mp4`,
              fileSize: (hookFile.size / (1024 * 1024)).toFixed(1) + ' MB',
              thumbnailDataUrl: hookMeta.thumbnailDataUrl,
              colorTheme: '#9333ea',
            },
            body: {
              id: bodyId,
              type: 'body',
              title: `Corpo ${slotIdx}: ${file.name.slice(0, 18)} (Auto)`,
              duration: bodyMeta.duration,
              fileUrl: bodyUrl,
              fileName: `corpo_${slotIdx}.mp4`,
              fileSize: (bodyFile.size / (1024 * 1024)).toFixed(1) + ' MB',
              thumbnailDataUrl: bodyMeta.thumbnailDataUrl,
              colorTheme: '#2563eb',
            },
            cta: {
              id: ctaId,
              type: 'cta',
              title: `CTA ${slotIdx}: ${file.name.slice(0, 18)} (Auto)`,
              duration: ctaMeta.duration,
              fileUrl: ctaUrl,
              fileName: `cta_${slotIdx}.mp4`,
              fileSize: (ctaFile.size / (1024 * 1024)).toFixed(1) + ' MB',
              thumbnailDataUrl: ctaMeta.thumbnailDataUrl,
              colorTheme: '#16a34a',
            },
          });
        } else {
          // Modo Web de contingência: calcula durações e particiona as faixas
          setCurrentStepText(`[Vídeo ${slotIdx}/${selectedFiles.length}] Processando metadados de tempo no navegador...`);
          const mainUrl = URL.createObjectURL(file);
          const meta = await extractVideoFirstFrameAndDuration(mainUrl, 20.0);
          const totalDur = meta.duration || 20.0;

          const hookDur = Math.min(4.5, totalDur * 0.22);
          const ctaDur = Math.min(4.0, totalDur * 0.18);
          const bodyDur = Math.max(2.0, totalDur - hookDur - ctaDur);

          const hookId = `autosplit-hook-${slotIdx}-${Date.now()}`;
          const bodyId = `autosplit-body-${slotIdx}-${Date.now()}`;
          const ctaId = `autosplit-cta-${slotIdx}-${Date.now()}`;

          registerClipBlob(hookId, file, mainUrl, hookDur, meta.thumbnailDataUrl);
          registerClipBlob(bodyId, file, mainUrl, bodyDur, meta.thumbnailDataUrl);
          registerClipBlob(ctaId, file, mainUrl, ctaDur, meta.thumbnailDataUrl);

          results.push({
            slot: slotIdx,
            hook: {
              id: hookId,
              type: 'hook',
              title: `Gancho ${slotIdx}: ${file.name.slice(0, 18)}`,
              duration: Number(hookDur.toFixed(1)),
              fileUrl: mainUrl,
              fileName: file.name,
              fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
              thumbnailDataUrl: meta.thumbnailDataUrl,
              colorTheme: '#9333ea',
              trimStart: 0,
            },
            body: {
              id: bodyId,
              type: 'body',
              title: `Corpo ${slotIdx}: ${file.name.slice(0, 18)}`,
              duration: Number(bodyDur.toFixed(1)),
              fileUrl: mainUrl,
              fileName: file.name,
              fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
              thumbnailDataUrl: meta.thumbnailDataUrl,
              colorTheme: '#2563eb',
              trimStart: hookDur,
            },
            cta: {
              id: ctaId,
              type: 'cta',
              title: `CTA ${slotIdx}: ${file.name.slice(0, 18)}`,
              duration: Number(ctaDur.toFixed(1)),
              fileUrl: mainUrl,
              fileName: file.name,
              fileSize: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
              thumbnailDataUrl: meta.thumbnailDataUrl,
              colorTheme: '#16a34a',
              trimStart: hookDur + bodyDur,
            },
          });
        }
      }

      setProgressPercent(100);
      setCurrentStepText('Fatiamento concluído com sucesso!');
      setSuccessCount(results.length);

      setTimeout(() => {
        onClipsGenerated(results);
        setIsProcessing(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Erro no Auto-Splitter:', err);
      setIsProcessing(false);
      setErrorMessage(err.message || 'Erro ao processar vídeo no Auto-Splitter.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 bg-black/85 backdrop-blur-md flex items-center justify-center animate-fade-in">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-950 border border-purple-500/40 p-6 shadow-[0_0_50px_rgba(168,85,247,0.35)] relative space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Auto-Splitter com IA</h3>
                <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 text-[10px] font-mono font-bold">
                  faster-whisper + LLM
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Suba de 1 a 3 vídeos inteiros sem cortes. A IA transcreve, detecta os timestamps e fatia Gancho, Corpo e CTA automaticamente.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status do Motor FFmpeg / Whisper */}
        <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${ffmpegOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300 font-medium">
              Motor FFmpeg Local &amp; faster-whisper:
            </span>
          </div>
          <span className={`font-mono font-bold ${ffmpegOnline ? 'text-emerald-300' : 'text-amber-300'}`}>
            {ffmpegOnline ? 'Conectado (Porta 5050 - Fatiamento Local Ultra-Rápido)' : 'Navegador Web (Para corte nativo ligue o .bat)'}
          </span>
        </div>

        {/* Upload Dropzone */}
        <div
          onClick={() => !isProcessing && fileInputRef.current?.click()}
          className="border-2 border-dashed border-purple-500/40 hover:border-purple-400 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-900/40 hover:bg-slate-900/70 transition-all cursor-pointer group"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
          />
          <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
            <Upload className="w-6 h-6 text-fuchsia-400" />
          </div>
          <p className="text-sm font-bold text-white mb-1">
            Clique para selecionar de 1 a 3 vídeos brutos (.mp4, .mov)
          </p>
          <p className="text-xs text-slate-400 max-w-md">
            Você pode subir 1 vídeo longo para fatiar nos primeiros slots (G1, C1, CTA1) ou subir 3 vídeos para preencher os 9 slots da matriz combinatória completa!
          </p>
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider">
              Vídeos Selecionados ({selectedFiles.length}/3):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {selectedFiles.map((f, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900 border border-purple-500/30 flex items-center gap-2.5"
                >
                  <FileVideo className="w-5 h-5 text-fuchsia-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate" title={f.name}>
                      Slot {idx + 1}: {f.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {(f.size / (1024 * 1024)).toFixed(1)} MB · Fatiará em G{idx + 1}, C{idx + 1}, CTA{idx + 1}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Bar / Processing Step */}
        {isProcessing && (
          <div className="p-4 rounded-2xl bg-fuchsia-950/40 border border-fuchsia-500/40 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-fuchsia-300">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-fuchsia-400" />
                <span>{currentStepText}</span>
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-300 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-500/20">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleStartAutoSplit}
            disabled={isProcessing || selectedFiles.length === 0}
            className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all transform hover:scale-[1.02] cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Fatiando Vídeos com IA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span>Fatiar e Preencher Slots com IA</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

