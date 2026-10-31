import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Trash2,
  Sparkles,
  Play,
  Layers,
  RefreshCw,
  CheckCircle2,
  Film,
  FolderArchive,
  Clock,
  X,
  Copy,
  Check,
  Image as ImageIcon,
  FileText,
  Zap,
} from 'lucide-react';
import { VideoClip, CreativeVariation, Project } from '../types';
import { DEMO_HOOKS, DEMO_BODIES, DEMO_CTAS } from '../services/demoClips';
import {
  extractVideoFirstFrameAndDuration,
  getClipFirstFrameDataUrl,
  getClipBlobUrl,
  registerClipBlob,
  compileCartesianMatrix,
  isDemoClip,
} from '../services/clipStore';
import { renderHighImpactCoverToPngBlob } from '../services/videoRenderer';
import { clearAudioBufferCache } from '../services/audioManager';
import { BatchDownloadModal } from './BatchDownloadModal';
import { checkFFmpegServerHealth, uploadClipToFFmpegServer } from '../services/ffmpegApiService';
import { Cpu, Flame } from 'lucide-react';

interface StudioViewProps {
  project: Project;
  onUpdateProject: (updated: Partial<Project>) => void;
  onOpenPlayer: (variation: CreativeVariation) => void;
  onSaveToFirebase?: (project: Project) => Promise<void>;
}

export const StudioView: React.FC<StudioViewProps> = ({
  project,
  onUpdateProject,
  onOpenPlayer,
  onSaveToFirebase,
}) => {
  const [isGeneratingMatrix, setIsGeneratingMatrix] = useState(false);
  const [isZipModalOpen, setIsZipModalOpen] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [productKeywordInput, setProductKeywordInput] = useState<string>(
    project.productKeyword || ''
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingCoverId, setDownloadingCoverId] = useState<string | null>(null);

  useEffect(() => {
    setProductKeywordInput(project.productKeyword || '');
  }, [project.id, project.productKeyword]);

  const handleCopyText = (text: string, keyId: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(keyId);
    showNotice(`${label} copiado para a área de transferência!`);
    setTimeout(() => {
      setCopiedId((prev) => (prev === keyId ? null : prev));
    }, 2500);
  };

  const handleDownloadCoverPng = async (
    e: React.MouseEvent,
    variation: CreativeVariation
  ) => {
    e.stopPropagation();
    if (downloadingCoverId) return;
    setDownloadingCoverId(variation.id);
    try {
      const blob = await renderHighImpactCoverToPngBlob(variation);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CAPA_${variation.code.replace(/\+/g, '-')}_ALTO_IMPACTO.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotice(`Capa 9:16 de Alto Impacto (${variation.code}) baixada com sucesso!`);
    } catch (err) {
      console.error('Erro ao baixar capa PNG:', err);
    } finally {
      setDownloadingCoverId(null);
    }
  };

  const handleCopyAll27SeoPack = () => {
    if (!project.generatedVariations.length) return;
    const textPack = project.generatedVariations
      .map(
        (v) =>
          `=========================================\n` +
          `VÍDEO ${v.index}/27 — COMBINAÇÃO: ${v.code}\n` +
          `=========================================\n` +
          `🔥 TÍTULO DA CAPA (ALTO IMPACTO):\n${v.coverTitle || v.headline}\n\n` +
          `📝 LEGENDA SEO PARA DESCRIÇÃO DO TIKTOK:\n${v.seoCaption}\n`
      )
      .join('\n');

    handleCopyText(
      textPack,
      'copy-all-27-seo',
      'Pacote completo com as 27 Capas + 27 Legendas SEO'
    );
  };

  // Auto-save with 2-second (2000ms) debounce on any editor change
  const AUTOSAVE_DEBOUNCE_MS = 2000;
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'pending'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string>(new Date().toLocaleTimeString('pt-BR'));
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestProjectRef = useRef<Project>(project);
  const pendingProjectRef = useRef<Project | null>(null);
  const onSaveToFirebaseRef = useRef(onSaveToFirebase);
  latestProjectRef.current = project;
  onSaveToFirebaseRef.current = onSaveToFirebase;

  // Flush any pending debounced auto-save when switching projects or unmounting StudioView
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (pendingProjectRef.current && onSaveToFirebaseRef.current) {
        const projToFlush = pendingProjectRef.current;
        pendingProjectRef.current = null;
        onSaveToFirebaseRef.current(projToFlush).catch((e) =>
          console.warn('Erro ao persistir auto-salvamento pendente:', e)
        );
      }
    };
  }, [project.id]);

  const executeSaveToFirebase = async (currentProj: Project) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingProjectRef.current = null;

    setSaveStatus('saving');
    try {
      if (onSaveToFirebaseRef.current) {
        await onSaveToFirebaseRef.current(currentProj);
      }
      setSaveStatus('saved');
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR'));
    } catch (e) {
      console.warn('Erro no auto-salvamento do projeto:', e);
      setSaveStatus('saved');
    }
  };

  const scheduleAutosave = (currentProj: Project) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    pendingProjectRef.current = currentProj;
    setSaveStatus('pending');

    debounceTimerRef.current = setTimeout(() => {
      executeSaveToFirebase(currentProj);
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const updateProjectWithSave = (updated: Partial<Project>) => {
    const merged: Project = { ...latestProjectRef.current, ...updated };
    latestProjectRef.current = merged;
    onUpdateProject(updated);
    scheduleAutosave(merged);
  };

  const handleProductKeywordChange = (value: string) => {
    setProductKeywordInput(value);
    const trimmed = value.trim();
    const currentProj = latestProjectRef.current;

    if (
      currentProj.generatedVariations.length > 0 &&
      currentProj.hooks.length > 0 &&
      currentProj.bodies.length > 0 &&
      currentProj.ctas.length > 0
    ) {
      const updatedVariations = compileCartesianMatrix(
        currentProj.hooks,
        currentProj.bodies,
        currentProj.ctas,
        [],
        currentProj.id,
        true,
        'minimal_clean',
        {
          productKeyword: trimmed,
          projectName: currentProj.name,
        }
      );
      updateProjectWithSave({
        productKeyword: trimmed,
        generatedVariations: updatedVariations,
        videosGenerated: updatedVariations.length,
      });
    } else {
      updateProjectWithSave({
        productKeyword: trimmed,
      });
    }
  };

  // File input refs for the 3 columns (bulk) and individual 9 slots
  const hookInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  const ctaInputRef = useRef<HTMLInputElement>(null);
  const slotInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const [ffmpegOnline, setFfmpegOnline] = useState<boolean>(false);

  // Verifica status do motor FFmpeg local
  useEffect(() => {
    let active = true;
    const probe = async () => {
      const st = await checkFFmpegServerHealth();
      if (active) setFfmpegOnline(st.online);
    };
    probe();
    const interval = setInterval(probe, 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const showNotice = (msg: string) => {
    setUploadNotice(msg);
    setTimeout(() => setUploadNotice(null), 5000);
  };

  // Upload direto para um slot específico (G1, G2, G3 / C1, C2, C3 / CTA1, CTA2, CTA3)
  const handleUploadSlot = async (
    type: 'hook' | 'body' | 'cta',
    slotIndex: number,
    file: File
  ) => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    const label = type === 'hook' ? 'Gancho' : type === 'body' ? 'Corpo' : 'CTA';
    const clipId = `user-${type}-${slotIndex + 1}-${Date.now()}`;
    const defaultDur = type === 'hook' ? 4.0 : type === 'body' ? 7.0 : 3.5;

    const { duration: detectedDuration, thumbnailDataUrl } =
      await extractVideoFirstFrameAndDuration(url, defaultDur);
    registerClipBlob(clipId, file, url, detectedDuration, thumbnailDataUrl);

    const newClip: VideoClip = {
      id: clipId,
      type,
      title: `${label} ${slotIndex + 1}: ${file.name.slice(0, 24)}`,
      duration: detectedDuration,
      fileUrl: url,
      fileName: file.name,
      fileSize: sizeMb,
      thumbnailDataUrl,
      colorTheme: type === 'hook' ? '#9333ea' : type === 'body' ? '#2563eb' : '#16a34a',
    };

    clearAudioBufferCache();

    // Sincroniza em segundo plano com o servidor FFmpeg local se estiver online
    const tipoBackend = type === 'hook' ? 'gancho' : type === 'body' ? 'corpo' : 'cta';
    uploadClipToFFmpegServer(file, tipoBackend, (slotIndex + 1) as 1 | 2 | 3).catch(() => {});

    const currentProj = latestProjectRef.current;
    let updatedHooks = [...currentProj.hooks];
    let updatedBodies = [...currentProj.bodies];
    let updatedCtas = [...currentProj.ctas];

    if (type === 'hook') {
      while (updatedHooks.length <= slotIndex) updatedHooks.push({} as any);
      updatedHooks[slotIndex] = newClip;
      updatedHooks = updatedHooks.filter((c) => c && c.id);
    } else if (type === 'body') {
      while (updatedBodies.length <= slotIndex) updatedBodies.push({} as any);
      updatedBodies[slotIndex] = newClip;
      updatedBodies = updatedBodies.filter((c) => c && c.id);
    } else {
      while (updatedCtas.length <= slotIndex) updatedCtas.push({} as any);
      updatedCtas[slotIndex] = newClip;
      updatedCtas = updatedCtas.filter((c) => c && c.id);
    }

    let newVariations = currentProj.generatedVariations;
    if (updatedHooks.length > 0 && updatedBodies.length > 0 && updatedCtas.length > 0) {
      newVariations = compileCartesianMatrix(
        updatedHooks,
        updatedBodies,
        updatedCtas,
        [],
        currentProj.id,
        true,
        'minimal_clean',
        {
          productKeyword: productKeywordInput.trim() || currentProj.productKeyword,
          projectName: currentProj.name,
        }
      );
    }

    updateProjectWithSave({
      hooks: updatedHooks,
      bodies: updatedBodies,
      ctas: updatedCtas,
      clipsCount: updatedHooks.length + updatedBodies.length + updatedCtas.length,
      generatedVariations: newVariations,
      videosGenerated: newVariations.length,
    });

    const codeLabel = type === 'hook' ? `G${slotIndex + 1}` : type === 'body' ? `C${slotIndex + 1}` : `CTA${slotIndex + 1}`;
    showNotice(`✓ ${label} ${slotIndex + 1} (${codeLabel}) carregado com sucesso!`);
  };

  const handleRemoveSlot = (type: 'hook' | 'body' | 'cta', slotIndex: number) => {
    clearAudioBufferCache();
    const currentProj = latestProjectRef.current;
    let updatedHooks = [...currentProj.hooks];
    let updatedBodies = [...currentProj.bodies];
    let updatedCtas = [...currentProj.ctas];

    if (type === 'hook') {
      updatedHooks.splice(slotIndex, 1);
    } else if (type === 'body') {
      updatedBodies.splice(slotIndex, 1);
    } else {
      updatedCtas.splice(slotIndex, 1);
    }

    const newVariations =
      updatedHooks.length > 0 && updatedBodies.length > 0 && updatedCtas.length > 0
        ? compileCartesianMatrix(
            updatedHooks,
            updatedBodies,
            updatedCtas,
            [],
            project.id,
            true,
            'minimal_clean',
            {
              productKeyword: productKeywordInput.trim() || project.productKeyword,
              projectName: project.name,
            }
          )
        : [];

    updateProjectWithSave({
      hooks: updatedHooks,
      bodies: updatedBodies,
      ctas: updatedCtas,
      clipsCount: updatedHooks.length + updatedBodies.length + updatedCtas.length,
      generatedVariations: newVariations,
      videosGenerated: newVariations.length,
    });
    showNotice('Clipe removido do slot.');
  };

  const triggerSingleSlotInput = (type: 'hook' | 'body' | 'cta', slotIndex: number) => {
    const key = `${type}_${slotIndex}`;
    slotInputRefs.current[key]?.click();
  };

  // Automatically backfill first-frame thumbnail for any loaded Hook clip that has a video URL but no thumbnailDataUrl yet
  useEffect(() => {
    let cancelled = false;
    const backfillHookThumbnails = async () => {
      let updatedAny = false;
      const nextHooks = await Promise.all(
        (project.hooks || []).map(async (clip) => {
          const existingThumb = getClipFirstFrameDataUrl(clip);
          if (existingThumb) {
            if (!clip.thumbnailDataUrl) {
              updatedAny = true;
              return { ...clip, thumbnailDataUrl: existingThumb };
            }
            return clip;
          }
          const url = clip.fileUrl || getClipBlobUrl(clip.id) || getClipBlobUrl(clip.fileName);
          if (!url) return clip;
          const res = await extractVideoFirstFrameAndDuration(url, clip.duration || 4.0);
          if (res.thumbnailDataUrl && !cancelled) {
            updatedAny = true;
            try {
              localStorage.setItem(`clip27_thumb_${clip.id}`, res.thumbnailDataUrl);
              if (clip.fileName) {
                localStorage.setItem(
                  `clip27_thumb_${clip.fileName.toLowerCase()}`,
                  res.thumbnailDataUrl
                );
              }
            } catch {}
            return { ...clip, thumbnailDataUrl: res.thumbnailDataUrl };
          }
          return clip;
        })
      );

      if (updatedAny && !cancelled) {
        const nextVars = (project.generatedVariations || []).map((v) => {
          const matchedHook = nextHooks[v.hookIndex - 1] || v.hookClip;
          return {
            ...v,
            hookClip: matchedHook,
          };
        });
        updateProjectWithSave({
          hooks: nextHooks,
          generatedVariations: nextVars,
        });
      }
    };

    backfillHookThumbnails();
    return () => {
      cancelled = true;
    };
  }, [project.hooks]);

  // Handle file additions for Hooks, Bodies, and CTAs (Bulk or multi-file)
  const handleAddFiles = async (
    files: FileList | null,
    type: 'hook' | 'body' | 'cta'
  ) => {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const defaultDur = type === 'hook' ? 4.0 : type === 'body' ? 7.0 : 3.5;
    const label = type === 'hook' ? 'Gancho' : type === 'body' ? 'Corpo' : 'CTA';
    const tipoBackend = type === 'hook' ? 'gancho' : type === 'body' ? 'corpo' : 'cta';

    const currentProj = latestProjectRef.current;
    let targetSlots: VideoClip[] =
      type === 'hook'
        ? [...currentProj.hooks]
        : type === 'body'
        ? [...currentProj.bodies]
        : [...currentProj.ctas];

    // Se a coluna ainda tiver clipes demo, limpamos para dar lugar aos clipes reais
    if (targetSlots.some(isDemoClip)) {
      targetSlots = [];
    }

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const url = URL.createObjectURL(file);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

      // Detecta slot inteligente baseado no nome do arquivo (ex: gancho1 -> slot 0, g2 -> slot 1, etc.)
      let targetSlotIdx = i;
      const lowerName = file.name.toLowerCase();
      if (/1|g1|c1|cta1/.test(lowerName)) targetSlotIdx = 0;
      else if (/2|g2|c2|cta2/.test(lowerName)) targetSlotIdx = 1;
      else if (/3|g3|c3|cta3/.test(lowerName)) targetSlotIdx = 2;
      else if (targetSlots.length < 3) targetSlotIdx = targetSlots.length;
      else targetSlotIdx = i % 3;

      const clipId = `user-${type}-${targetSlotIdx + 1}-${Date.now()}-${i}`;
      const { duration: detectedDuration, thumbnailDataUrl } =
        await extractVideoFirstFrameAndDuration(url, defaultDur);
      registerClipBlob(clipId, file, url, detectedDuration, thumbnailDataUrl);

      const newClip: VideoClip = {
        id: clipId,
        type,
        title: `${label} ${targetSlotIdx + 1}: ${file.name.slice(0, 24)}`,
        duration: detectedDuration,
        fileUrl: url,
        fileName: file.name,
        fileSize: sizeMb,
        thumbnailDataUrl,
        colorTheme: type === 'hook' ? '#9333ea' : type === 'body' ? '#2563eb' : '#16a34a',
      };

      while (targetSlots.length <= targetSlotIdx) {
        targetSlots.push({} as any);
      }
      targetSlots[targetSlotIdx] = newClip;

      // Envia em segundo plano para o backend FFmpeg
      uploadClipToFFmpegServer(file, tipoBackend, (targetSlotIdx + 1) as 1 | 2 | 3).catch(() => {});
    }

    targetSlots = targetSlots.filter((c) => c && c.id).slice(0, 3);
    clearAudioBufferCache();

    // Limpar o valor do input para permitir reenvio dos mesmos arquivos se necessário
    if (hookInputRef.current) hookInputRef.current.value = '';
    if (bodyInputRef.current) bodyInputRef.current.value = '';
    if (ctaInputRef.current) ctaInputRef.current.value = '';

    let updatedHooks = type === 'hook' ? targetSlots : currentProj.hooks;
    let updatedBodies = type === 'body' ? targetSlots : currentProj.bodies;
    let updatedCtas = type === 'cta' ? targetSlots : currentProj.ctas;

    let newVariations = currentProj.generatedVariations;
    if (updatedHooks.length > 0 && updatedBodies.length > 0 && updatedCtas.length > 0) {
      newVariations = compileCartesianMatrix(
        updatedHooks,
        updatedBodies,
        updatedCtas,
        [],
        currentProj.id,
        true,
        'minimal_clean',
        {
          productKeyword: productKeywordInput.trim() || currentProj.productKeyword,
          projectName: currentProj.name,
        }
      );
    }

    updateProjectWithSave({
      hooks: updatedHooks,
      bodies: updatedBodies,
      ctas: updatedCtas,
      clipsCount: updatedHooks.length + updatedBodies.length + updatedCtas.length,
      generatedVariations: newVariations,
      videosGenerated: newVariations.length,
    });

    const typeName = type === 'hook' ? 'Ganchos' : type === 'body' ? 'Corpos' : 'CTAs';
    if (updatedHooks.length === 3 && updatedBodies.length === 3 && updatedCtas.length === 3) {
      showNotice(
        `🎉 3 Ganchos + 3 Corpos + 3 CTAs prontos! 27 combinações geradas com Capa no 1º frame do MP4!`
      );
    } else {
      showNotice(`${fileList.length} arquivo(s) de ${typeName} distribuído(s) nos slots com sucesso!`);
    }
  };

  const handleRemoveClip = (type: 'hook' | 'body' | 'cta', id: string) => {
    clearAudioBufferCache();
    let updatedHooks = project.hooks;
    let updatedBodies = project.bodies;
    let updatedCtas = project.ctas;

    if (type === 'hook') {
      updatedHooks = project.hooks.filter((c) => c.id !== id);
    } else if (type === 'body') {
      updatedBodies = project.bodies.filter((c) => c.id !== id);
    } else {
      updatedCtas = project.ctas.filter((c) => c.id !== id);
    }

    const newVariations =
      updatedHooks.length > 0 && updatedBodies.length > 0 && updatedCtas.length > 0
        ? compileCartesianMatrix(
            updatedHooks,
            updatedBodies,
            updatedCtas,
            [],
            project.id,
            true,
            'minimal_clean',
            {
              productKeyword: productKeywordInput.trim() || project.productKeyword,
              projectName: project.name,
            }
          )
        : [];

    updateProjectWithSave({
      hooks: updatedHooks,
      bodies: updatedBodies,
      ctas: updatedCtas,
      clipsCount: updatedHooks.length + updatedBodies.length + updatedCtas.length,
      generatedVariations: newVariations,
      videosGenerated: newVariations.length,
    });
    showNotice('Clipe removido com sucesso.');
  };

  const handleRemoveVariation = (variationId: string) => {
    const updatedVars = project.generatedVariations.filter((v) => v.id !== variationId);
    updateProjectWithSave({
      generatedVariations: updatedVars,
      videosGenerated: updatedVars.length,
    });
    showNotice('Variação excluída com sucesso.');
  };

  const handleClearVariations = () => {
    updateProjectWithSave({
      generatedVariations: [],
      videosGenerated: 0,
    });
    showNotice('Todas as variações foram excluídas.');
  };

  const handleClearColumn = (type: 'hook' | 'body' | 'cta') => {
    const updatedHooks = type === 'hook' ? [] : project.hooks;
    const updatedBodies = type === 'body' ? [] : project.bodies;
    const updatedCtas = type === 'cta' ? [] : project.ctas;

    const newVariations =
      updatedHooks.length > 0 && updatedBodies.length > 0 && updatedCtas.length > 0
        ? compileCartesianMatrix(
            updatedHooks,
            updatedBodies,
            updatedCtas,
            [],
            project.id,
            true,
            'minimal_clean',
            {
              productKeyword: productKeywordInput.trim() || project.productKeyword,
              projectName: project.name,
            }
          )
        : [];

    updateProjectWithSave({
      hooks: updatedHooks,
      bodies: updatedBodies,
      ctas: updatedCtas,
      clipsCount: updatedHooks.length + updatedBodies.length + updatedCtas.length,
      generatedVariations: newVariations,
      videosGenerated: newVariations.length,
    });
  };

  const handleLoadDemoClips = () => {
    const demoVars = compileCartesianMatrix(
      DEMO_HOOKS,
      DEMO_BODIES,
      DEMO_CTAS,
      [],
      project.id,
      true,
      'minimal_clean',
      {
        productKeyword: productKeywordInput.trim() || project.productKeyword,
        projectName: project.name,
      }
    );

    updateProjectWithSave({
      hooks: [...DEMO_HOOKS],
      bodies: [...DEMO_BODIES],
      ctas: [...DEMO_CTAS],
      clipsCount: 9,
      generatedVariations: demoVars,
      videosGenerated: demoVars.length,
    });
    showNotice('Clipes de demonstração + 27 Capas e Legendas SEO carregados com sucesso!');
  };

  const handleClearAllClips = () => {
    updateProjectWithSave({
      hooks: [],
      bodies: [],
      ctas: [],
      clipsCount: 0,
      generatedVariations: [],
      videosGenerated: 0,
    });
    showNotice('Todos os clipes foram removidos.');
  };

  // Cartesian 3x3x3 matrix calculation
  const curProj = latestProjectRef.current;
  const totalPossible = curProj.hooks.length * curProj.bodies.length * curProj.ctas.length;

  const handleGenerateVariations = () => {
    const p = latestProjectRef.current;
    const possible = p.hooks.length * p.bodies.length * p.ctas.length;
    if (possible === 0) return;
    setIsGeneratingMatrix(true);

    setTimeout(() => {
      const current = latestProjectRef.current;
      const variations = compileCartesianMatrix(
        current.hooks,
        current.bodies,
        current.ctas,
        [],
        current.id,
        true,
        'minimal_clean',
        {
          productKeyword: productKeywordInput.trim() || current.productKeyword,
          projectName: current.name,
        }
      );

      updateProjectWithSave({
        productKeyword: productKeywordInput.trim() || current.productKeyword,
        generatedVariations: variations,
        videosGenerated: variations.length,
      });
      setIsGeneratingMatrix(false);
      showNotice(
        `${variations.length} vídeos únicos com Capa de Alto Impacto embutida no 1º frame gerados!`
      );
    }, 200);
  };

  return (
    <div id="tab-estudio" className="space-y-8 animate-fade-in pb-12">
      {/* Top Header of Studio with Autosave Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-purple-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-fuchsia-400 font-semibold tracking-wider uppercase">
            <span>Método 3x3x3</span>
            <span>·</span>
            <span>Matriz Combinatória Viral</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Estúdio Combinatório de Criativos</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {project.id}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <p className="text-sm text-slate-400">
              Carregue 3 Ganchos, 3 Corpos e 3 CTAs para gerar 27 vídeos únicos + Capa de Alto Impacto + Legenda SEO TikTok.
            </p>

            {/* Auto-save Indicator (2s Debounce) */}
            <div className="flex items-center gap-2">
              {saveStatus === 'saving' ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-mono animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin text-fuchsia-400" />
                  <span>Auto-salvando alterações...</span>
                </span>
              ) : saveStatus === 'pending' ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Auto-salvando em 2s...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Salvo automaticamente ({lastSavedAt})</span>
                </span>
              )}
            </div>

            {/* Indicador do Motor FFmpeg Nativo */}
            <div className="flex items-center gap-2">
              {ffmpegOnline ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <Cpu className="w-3 h-3 text-emerald-400" />
                  <span>Motor FFmpeg Nativo: Ativo</span>
                </span>
              ) : (
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 text-slate-400 border border-slate-700/60 text-[11px] font-mono cursor-help"
                  title="Para renderização com FFmpeg nativo super rápida e fluida, execute iniciar_motor.bat na pasta do projeto"
                >
                  <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                  <span>FFmpeg: Offline (Clique no .bat)</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {project.generatedVariations.length > 0 && (
            <button
              onClick={() => setIsZipModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 border border-fuchsia-400/50 shadow-[0_0_20px_rgba(217,70,239,0.4)] transition-all transform hover:scale-[1.02] cursor-pointer"
            >
              <FolderArchive className="w-4 h-4 text-fuchsia-200" />
              <span>Baixar Vídeos + Capas (.ZIP)</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold">
                MP4 + PNG
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px] font-mono">
                {project.generatedVariations.length}
              </span>
            </button>
          )}

          <button
            onClick={handleLoadDemoClips}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-fuchsia-200 bg-fuchsia-950/40 hover:bg-fuchsia-900/50 border border-fuchsia-500/40 shadow-[0_0_15px_rgba(217,70,239,0.2)] transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>Carregar Clipes Demo (1-Clique)</span>
          </button>
          {project.clipsCount > 0 && (
            <button
              onClick={handleClearAllClips}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 border border-purple-500/20 transition-all cursor-pointer"
              title="Limpar todos os clipes"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Upload Notification Toast */}
      {uploadNotice && (
        <div className="p-3.5 rounded-2xl bg-fuchsia-950/70 border border-fuchsia-500/40 text-fuchsia-200 text-xs flex items-center justify-between gap-3 shadow-[0_0_20px_rgba(217,70,239,0.25)] animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{uploadNotice}</span>
          </div>
          <button onClick={() => setUploadNotice(null)} className="text-slate-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3 Colunas de Upload (Ganchos, Corpos, CTAs) com 3 Slots Estruturados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Coluna 1: Ganchos (Hooks - G1, G2, G3) */}
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between border-t-2 border-t-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.15)]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/15 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-300 font-mono">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Coluna 1: Ganchos (Hooks)</h3>
                  <p className="text-[11px] text-slate-400">Primeiros 3 a 5 segundos de choque</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-500/15">
                {project.hooks.length}/3
              </span>
            </div>

            {/* 3 Slots Estruturados e Independentes (G1, G2, G3) */}
            <div className="space-y-2 mb-3">
              {[0, 1, 2].map((slotIdx) => {
                const clip = project.hooks[slotIdx];
                const code = `G${slotIdx + 1}`;
                const label = `Gancho ${slotIdx + 1}`;
                const thumbUrl = clip ? getClipFirstFrameDataUrl(clip) : undefined;
                const isDemo = clip ? isDemoClip(clip) : true;

                return (
                  <div key={`hook-slot-${slotIdx}`}>
                    <input
                      type="file"
                      ref={(el) => {
                        slotInputRefs.current[`hook_${slotIdx}`] = el;
                      }}
                      accept="video/mp4,video/quicktime,video/webm"
                      className="hidden"
                      onChange={(e) =>
                        e.target.files?.[0] && handleUploadSlot('hook', slotIdx, e.target.files[0])
                      }
                    />

                    {clip ? (
                      <div className="p-2 rounded-xl bg-slate-950/80 border border-purple-500/30 hover:border-purple-500/50 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative w-8 h-12 rounded bg-slate-900 overflow-hidden shrink-0 border border-purple-500/30">
                              {thumbUrl ? (
                                <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-purple-400/50">
                                  <Film className="w-4 h-4" />
                                </div>
                              )}
                              <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] font-mono font-bold text-purple-300 text-center">
                                {code}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-slate-200 truncate" title={clip.fileName || clip.title}>
                                  {clip.fileName || clip.title}
                                </p>
                                {!isDemo ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                    VÍDEO REAL
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                                    DEMO
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {clip.duration}s · {clip.fileSize || '3.8 MB'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => triggerSingleSlotInput('hook', slotIdx)}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-purple-300 font-semibold border border-purple-500/25 cursor-pointer"
                              title={`Substituir ${label}`}
                            >
                              Trocar
                            </button>
                            <button
                              onClick={() => handleRemoveSlot('hook', slotIdx)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer"
                              title={`Remover ${label}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => triggerSingleSlotInput('hook', slotIdx)}
                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-purple-500/30 hover:border-purple-500/70 bg-purple-950/15 hover:bg-purple-900/25 flex items-center justify-between text-xs transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold flex items-center justify-center">
                            {code}
                          </span>
                          <span className="text-slate-400 group-hover:text-purple-200 font-medium text-[11px]">
                            + Carregar {label} (.mp4, .mov)
                          </span>
                        </div>
                        <Upload className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upload Button */}
          <div className="space-y-2 pt-2 border-t border-purple-500/15">
            <input
              type="file"
              ref={hookInputRef}
              multiple
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => handleAddFiles(e.target.files, 'hook')}
            />
            <button
              onClick={() => hookInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-purple-500/40 hover:border-purple-500/80 bg-purple-950/30 hover:bg-purple-900/40 text-xs font-semibold text-purple-200 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir os 3 Ganchos de Uma Vez (.mp4, .mov)</span>
            </button>
            {project.hooks.length > 0 && (
              <button
                onClick={() => handleClearColumn('hook')}
                className="w-full py-1 text-[11px] text-slate-400 hover:text-rose-400 text-center transition-colors cursor-pointer"
              >
                Limpar esta coluna
              </button>
            )}
          </div>
        </div>

        {/* Coluna 2: Corpos (Bodies - C1, C2, C3) */}
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between border-t-2 border-t-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.15)]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/15 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-300 font-mono">
                  2
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Coluna 2: Corpos (Bodies)</h3>
                  <p className="text-[11px] text-slate-400">Demonstração do produto / retenção</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-500/15">
                {project.bodies.length}/3
              </span>
            </div>

            {/* 3 Slots Estruturados e Independentes (C1, C2, C3) */}
            <div className="space-y-2 mb-3">
              {[0, 1, 2].map((slotIdx) => {
                const clip = project.bodies[slotIdx];
                const code = `C${slotIdx + 1}`;
                const label = `Corpo ${slotIdx + 1}`;
                const thumbUrl = clip ? getClipFirstFrameDataUrl(clip) : undefined;
                const isDemo = clip ? isDemoClip(clip) : true;

                return (
                  <div key={`body-slot-${slotIdx}`}>
                    <input
                      type="file"
                      ref={(el) => {
                        slotInputRefs.current[`body_${slotIdx}`] = el;
                      }}
                      accept="video/mp4,video/quicktime,video/webm"
                      className="hidden"
                      onChange={(e) =>
                        e.target.files?.[0] && handleUploadSlot('body', slotIdx, e.target.files[0])
                      }
                    />

                    {clip ? (
                      <div className="p-2 rounded-xl bg-slate-950/80 border border-blue-500/30 hover:border-blue-500/50 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative w-8 h-12 rounded bg-slate-900 overflow-hidden shrink-0 border border-blue-500/30">
                              {thumbUrl ? (
                                <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-blue-400/50">
                                  <Film className="w-4 h-4" />
                                </div>
                              )}
                              <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] font-mono font-bold text-blue-300 text-center">
                                {code}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-slate-200 truncate" title={clip.fileName || clip.title}>
                                  {clip.fileName || clip.title}
                                </p>
                                {!isDemo ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                    VÍDEO REAL
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                                    DEMO
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {clip.duration}s · {clip.fileSize || '6.8 MB'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => triggerSingleSlotInput('body', slotIdx)}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-blue-300 font-semibold border border-blue-500/25 cursor-pointer"
                              title={`Substituir ${label}`}
                            >
                              Trocar
                            </button>
                            <button
                              onClick={() => handleRemoveSlot('body', slotIdx)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer"
                              title={`Remover ${label}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => triggerSingleSlotInput('body', slotIdx)}
                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-blue-500/30 hover:border-blue-500/70 bg-blue-950/15 hover:bg-blue-900/25 flex items-center justify-between text-xs transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono font-bold flex items-center justify-center">
                            {code}
                          </span>
                          <span className="text-slate-400 group-hover:text-blue-200 font-medium text-[11px]">
                            + Carregar {label} (.mp4, .mov)
                          </span>
                        </div>
                        <Upload className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upload Button */}
          <div className="space-y-2 pt-2 border-t border-purple-500/15">
            <input
              type="file"
              ref={bodyInputRef}
              multiple
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => handleAddFiles(e.target.files, 'body')}
            />
            <button
              onClick={() => bodyInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-blue-500/40 hover:border-blue-500/80 bg-blue-950/30 hover:bg-blue-900/40 text-xs font-semibold text-blue-200 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir os 3 Corpos de Uma Vez (.mp4, .mov)</span>
            </button>
            {project.bodies.length > 0 && (
              <button
                onClick={() => handleClearColumn('body')}
                className="w-full py-1 text-[11px] text-slate-400 hover:text-rose-400 text-center transition-colors cursor-pointer"
              >
                Limpar esta coluna
              </button>
            )}
          </div>
        </div>

        {/* Coluna 3: CTAs (CTA1, CTA2, CTA3) */}
        <div className="glass-card rounded-2xl p-4 flex flex-col justify-between border-t-2 border-t-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/15 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-300 font-mono">
                  3
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Coluna 3: CTAs (Chamada)</h3>
                  <p className="text-[11px] text-slate-400">Conversão final para o carrinho</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/15">
                {project.ctas.length}/3
              </span>
            </div>

            {/* 3 Slots Estruturados e Independentes (CTA1, CTA2, CTA3) */}
            <div className="space-y-2 mb-3">
              {[0, 1, 2].map((slotIdx) => {
                const clip = project.ctas[slotIdx];
                const code = `CTA${slotIdx + 1}`;
                const label = `CTA ${slotIdx + 1}`;
                const thumbUrl = clip ? getClipFirstFrameDataUrl(clip) : undefined;
                const isDemo = clip ? isDemoClip(clip) : true;

                return (
                  <div key={`cta-slot-${slotIdx}`}>
                    <input
                      type="file"
                      ref={(el) => {
                        slotInputRefs.current[`cta_${slotIdx}`] = el;
                      }}
                      accept="video/mp4,video/quicktime,video/webm"
                      className="hidden"
                      onChange={(e) =>
                        e.target.files?.[0] && handleUploadSlot('cta', slotIdx, e.target.files[0])
                      }
                    />

                    {clip ? (
                      <div className="p-2 rounded-xl bg-slate-950/80 border border-emerald-500/30 hover:border-emerald-500/50 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative w-8 h-12 rounded bg-slate-900 overflow-hidden shrink-0 border border-emerald-500/30">
                              {thumbUrl ? (
                                <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-emerald-400/50">
                                  <Film className="w-4 h-4" />
                                </div>
                              )}
                              <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] font-mono font-bold text-emerald-300 text-center">
                                {code}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-slate-200 truncate" title={clip.fileName || clip.title}>
                                  {clip.fileName || clip.title}
                                </p>
                                {!isDemo ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                    VÍDEO REAL
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                    DEMO
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {clip.duration}s · {clip.fileSize || '3.4 MB'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => triggerSingleSlotInput('cta', slotIdx)}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-emerald-300 font-semibold border border-emerald-500/25 cursor-pointer"
                              title={`Substituir ${label}`}
                            >
                              Trocar
                            </button>
                            <button
                              onClick={() => handleRemoveSlot('cta', slotIdx)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer"
                              title={`Remover ${label}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => triggerSingleSlotInput('cta', slotIdx)}
                        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-emerald-500/30 hover:border-emerald-500/70 bg-emerald-950/15 hover:bg-emerald-900/25 flex items-center justify-between text-xs transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold flex items-center justify-center">
                            {code}
                          </span>
                          <span className="text-slate-400 group-hover:text-emerald-200 font-medium text-[11px]">
                            + Carregar {label} (.mp4, .mov)
                          </span>
                        </div>
                        <Upload className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upload Button */}
          <div className="space-y-2 pt-2 border-t border-purple-500/15">
            <input
              type="file"
              ref={ctaInputRef}
              multiple
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={(e) => handleAddFiles(e.target.files, 'cta')}
            />
            <button
              onClick={() => ctaInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-emerald-500/40 hover:border-emerald-500/80 bg-emerald-950/30 hover:bg-emerald-900/40 text-xs font-semibold text-emerald-200 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir os 3 CTAs de Uma Vez (.mp4, .mov)</span>
            </button>
            {project.ctas.length > 0 && (
              <button
                onClick={() => handleClearColumn('cta')}
                className="w-full py-1 text-[11px] text-slate-400 hover:text-rose-400 text-center transition-colors cursor-pointer"
              >
                Limpar esta coluna
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Barra de Ação Limpa: Matemática atual + Nome do Produto p/ SEO + Botão Gerar 27 Vídeos Combinados */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 border border-fuchsia-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900/80 to-fuchsia-950/30 space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-5">
          <div className="space-y-1.5 text-center lg:text-left w-full lg:w-auto">
            <p className="text-sm sm:text-base font-extrabold text-white">
              Matemática atual:{' '}
              <span className="text-purple-400 font-mono">{project.hooks.length} Ganchos</span> ×{' '}
              <span className="text-blue-400 font-mono">{project.bodies.length} Corpos</span> ×{' '}
              <span className="text-emerald-400 font-mono">{project.ctas.length} CTAs</span> ={' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-pink-400 font-black font-mono">
                {totalPossible} vídeos únicos
              </span>
            </p>
            <p className="text-xs text-slate-300">
              Ao gerar os 27 vídeos, o motor cria automaticamente <strong className="text-amber-300">27 Capas com Título de Alto Impacto</strong> e <strong className="text-emerald-300">27 Legendas SEO prontas para o TikTok</strong>.
            </p>
          </div>

          {/* Input opcional do nome do produto para personalizar Capas & Legendas SEO */}
          <div className="w-full lg:w-80 shrink-0">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-fuchsia-300 font-bold mb-1">
              Produto p/ Legenda SEO &amp; Capa (Opcional):
            </label>
            <input
              type="text"
              value={productKeywordInput}
              onChange={(e) => handleProductKeywordChange(e.target.value)}
              placeholder="Ex: Escova Alisadora 5 em 1, Mini Processador..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-purple-500/35 focus:border-fuchsia-400 text-xs text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>

          <div className="shrink-0 w-full lg:w-auto">
            <button
              onClick={handleGenerateVariations}
              disabled={totalPossible === 0 || isGeneratingMatrix}
              className="w-full lg:w-auto min-h-[48px] flex items-center justify-center gap-3 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_30px_rgba(217,70,239,0.45)] transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              {isGeneratingMatrix ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Combinando Vídeos + SEO...</span>
                </>
              ) : (
                <>
                  <Layers className="w-5 h-5" />
                  <span>Gerar 27 Vídeos Combinados</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Grade de 27 Vídeos Gerados + Capas de Alto Impacto + Legendas SEO TikTok */}
      {project.generatedVariations.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-500/15">
            <div>
              <h3 className="text-lg font-extrabold text-white flex flex-wrap items-center gap-2">
                <span>Variações Combinadas + Capas &amp; Legendas SEO TikTok</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {project.generatedVariations.length} VÍDEOS ÚNICOS
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Cada vídeo possui sua <strong className="text-amber-300">Capa com Título de Alto Impacto</strong> e <strong className="text-emerald-300">Legenda SEO pronta para copiar e colar na descrição do TikTok</strong>. O arquivo MP4 permanece 100% limpo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleCopyAll27SeoPack}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-amber-200 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 transition-all cursor-pointer"
                title="Copiar todas as 27 Capas e 27 Legendas SEO de uma vez"
              >
                {copiedId === 'copy-all-27-seo' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">27 Capas + Legendas Copiadas!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-amber-400" />
                    <span>Copiar Todas as 27 Capas + Legendas SEO</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setIsZipModalOpen(true)}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_20px_rgba(217,70,239,0.35)] transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <FolderArchive className="w-4 h-4 text-fuchsia-200" />
                <span>Baixar Vídeos + Capas (.ZIP)</span>
                <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-[10px] font-mono">
                  {project.generatedVariations.length}
                </span>
              </button>

              <button
                onClick={handleClearVariations}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 border border-purple-500/20 transition-all cursor-pointer"
                title="Excluir todas as variações"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Todas</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {project.generatedVariations.map((v) => {
              const coverTitle = v.coverTitle || v.headline || 'NÃO COMPRE ANTES DE VER ESSE TESTE!';
              const coverBadge = (v.coverBadge || '🚨 ALERTA DE COMPRA').split('·')[0].trim();
              const seoCaption = v.seoCaption || '';
              const hookThumb = getClipFirstFrameDataUrl(v.hookClip) || v.hookClip?.thumbnailDataUrl;
              const isCoverCopied = copiedId === `cover-${v.id}`;
              const isSeoCopied = copiedId === `seo-${v.id}`;
              const isDownloadingCover = downloadingCoverId === v.id;

              return (
                <div
                  key={v.id}
                  onClick={() => onOpenPlayer(v)}
                  className="glass-card glass-card-hover rounded-2xl p-4 cursor-pointer transition-all duration-200 group relative flex flex-col justify-between border border-purple-500/25"
                >
                  <div>
                    {/* Top Badge with Combination Code & Hash */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black text-fuchsia-400 bg-fuchsia-950/50 px-2 py-0.5 rounded border border-fuchsia-500/30">
                          {v.code}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-500/40">
                          CAPA 1º FRAME
                        </span>
                        <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          MP4
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-slate-400">
                          {v.estimatedDuration}s · #{v.microEdit.hashHex}
                        </span>
                        <button
                          title="Excluir Variação"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveVariation(v.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* BLOCO 1: CAPA DE ALTO IMPACTO (Visual Preview + Botão Copiar Título + Baixar Capa PNG) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-xl p-3 mb-3 bg-gradient-to-br from-slate-950 via-purple-950/60 to-rose-950/40 border-2 border-amber-400/50 shadow-[0_0_20px_rgba(250,204,21,0.12)] relative overflow-hidden"
                    >
                      {/* Fundo com o 1º frame real do gancho */}
                      {hookThumb && (
                        <img
                          src={hookThumb}
                          alt="Fundo Gancho"
                          className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none"
                        />
                      )}
                      <div className="flex items-center justify-between gap-2 mb-1.5 relative z-10">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider shadow">
                          <Zap className="w-2.5 h-2.5 fill-current" />
                          <span>CAPA ALTO IMPACTO · {coverBadge}</span>
                        </span>
                        <span className="text-[9px] font-mono text-amber-300 font-bold">
                          9:16 THUMBNAIL
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm font-black text-amber-300 leading-snug tracking-tight uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] my-2 relative z-10">
                        &ldquo;{coverTitle}&rdquo;
                      </p>

                      <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-amber-500/20 relative z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyText(coverTitle, `cover-${v.id}`, `Título da Capa (${v.code})`);
                          }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                            isCoverCopied
                              ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                              : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm'
                          }`}
                        >
                          {isCoverCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Título Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar Título da Capa</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDownloadCoverPng(e, v)}
                          disabled={isDownloadingCover}
                          title="Baixar imagem da Capa 9:16 (.PNG) pronta com esse título de alto impacto"
                          className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-slate-900/90 hover:bg-slate-800 text-amber-200 border border-amber-400/40 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          {isDownloadingCover ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-amber-300" />
                          )}
                          <span>Baixar Capa</span>
                        </button>
                      </div>
                    </div>

                    {/* BLOCO 2: LEGENDA SEO PARA TIKTOK (Pronta para copiar e colar na descrição) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-xl p-3 mb-3 bg-slate-950/85 border border-emerald-500/30 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-300 uppercase">
                          <FileText className="w-3 h-3 text-emerald-400" />
                          <span>Legenda SEO (Descrição TikTok)</span>
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          SEO + HASHTAGS
                        </span>
                      </div>

                      <div className="max-h-24 overflow-y-auto pr-1 text-[11px] text-slate-300 whitespace-pre-line leading-relaxed font-sans select-all bg-slate-900/70 p-2 rounded-lg border border-slate-800">
                        {seoCaption}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyText(seoCaption, `seo-${v.id}`, `Legenda SEO TikTok (${v.code})`);
                        }}
                        className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                          isSeoCopied
                            ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                            : 'bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-sm'
                        }`}
                      >
                        {isSeoCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Legenda SEO Copiada! (Só colar no TikTok)</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Legenda SEO p/ TikTok</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Exact Combined Clips Source Badges */}
                    <div className="p-2 rounded-lg bg-slate-950/60 border border-purple-500/15 mb-3 space-y-1 text-[10px] font-mono">
                      <div className="flex items-center gap-1.5 text-fuchsia-300 truncate" title={v.hookClip?.fileName || v.hookClip?.title}>
                        <span className="text-slate-500 font-bold shrink-0">G{v.hookIndex}:</span>
                        <span className="truncate">{v.hookClip?.fileName || v.hookClip?.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sky-300 truncate" title={v.bodyClip?.fileName || v.bodyClip?.title}>
                        <span className="text-slate-500 font-bold shrink-0">C{v.bodyIndex}:</span>
                        <span className="truncate">{v.bodyClip?.fileName || v.bodyClip?.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-300 truncate" title={v.ctaClip?.fileName || v.ctaClip?.title}>
                        <span className="text-slate-500 font-bold shrink-0">CTA{v.ctaIndex}:</span>
                        <span className="truncate">{v.ctaClip?.fileName || v.ctaClip?.title}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPlayer(v);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600/80 group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-pink-600 transition-all cursor-pointer shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Reproduzir / Baixar MP4 Limpo</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Batch Download ZIP Modal */}
      <BatchDownloadModal
        isOpen={isZipModalOpen}
        onClose={() => setIsZipModalOpen(false)}
        project={project}
        variations={project.generatedVariations}
      />
    </div>
  );
};
