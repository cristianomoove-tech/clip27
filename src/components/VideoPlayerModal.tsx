import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Download,
  ShieldCheck,
  Check,
  RefreshCw,
  FolderArchive,
  Trash2,
  ArrowLeft,
  Volume2,
  VolumeX,
  Sliders,
  Copy,
  Image as ImageIcon,
  FileText,
  Zap,
} from 'lucide-react';
import { CreativeVariation } from '../types';
import {
  drawCreativeFrame,
  renderSingleVariationToBlob,
  renderHighImpactCoverToPngBlob,
  renderHighImpactCoverCanvas,
} from '../services/videoRenderer';
import { getClipBlobUrl, getClipFirstFrameDataUrl } from '../services/clipStore';
import {
  getAudioContext,
  getOrDecodeClipAudio,
  calculateNormalizationGain,
  createStudioMasteringChain,
  AudioLoudnessProfile,
} from '../services/audioManager';

interface VideoPlayerModalProps {
  variation: CreativeVariation | null;
  onClose: () => void;
  onOpenZipModal?: () => void;
  onDeleteVariation?: (variationId: string) => void;
  onUpdateVariation?: (updated: CreativeVariation) => void;
  totalVariationsCount?: number;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  variation,
  onClose,
  onOpenZipModal,
  onDeleteVariation,
  totalVariationsCount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedField, setCopiedField] = useState<'cover' | 'seo' | null>(null);
  const [isDownloadingCover, setIsDownloadingCover] = useState(false);

  // Audio Normalization: consistent loudness across Hook, Body, and CTA
  const [isNormalizationEnabled, setIsNormalizationEnabled] = useState(true);
  const [normalizationProfiles, setNormalizationProfiles] = useState<{
    hook?: AudioLoudnessProfile;
    body?: AudioLoudnessProfile;
    cta?: AudioLoudnessProfile;
  }>({});

  // Web Audio preview graph with Studio Mastering Chain & auto-gain
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterCompressorRef = useRef<AudioNode | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const currentSegmentGainRef = useRef<GainNode | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const buffersRef = useRef<{
    hook: AudioBuffer | null;
    body: AudioBuffer | null;
    cta: AudioBuffer | null;
  }>({ hook: null, body: null, cta: null });

  // Video elements positioned offscreen for visual frame decoding
  const hookVideoRef = useRef<HTMLVideoElement | null>(null);
  const bodyVideoRef = useRef<HTMLVideoElement | null>(null);
  const ctaVideoRef = useRef<HTMLVideoElement | null>(null);
  const coverCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animation frame reference
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const currentTimeRef = useRef<number>(0);
  const activeSegRef = useRef<'hook' | 'body' | 'cta'>('hook');

  const activeVariation = variation;
  const speed = activeVariation?.microEdit?.speed || 1.0;
  const hookDur = (activeVariation?.hookClip?.duration || 4.0) / speed;
  const bodyDur = (activeVariation?.bodyClip?.duration || 7.0) / speed;
  const ctaDur = (activeVariation?.ctaClip?.duration || 3.5) / speed;
  const totalDuration = hookDur + bodyDur + ctaDur;

  const hookTrimStart = activeVariation?.hookClip?.trimStart || 0;
  const bodyTrimStart = activeVariation?.bodyClip?.trimStart || 0;
  const ctaTrimStart = activeVariation?.ctaClip?.trimStart || 0;

  useEffect(() => {
    let cancelled = false;
    if (!activeVariation) return;
    renderHighImpactCoverCanvas(activeVariation).then((cvs) => {
      if (!cancelled) {
        coverCanvasRef.current = cvs;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeVariation]);

  const stopActiveAudioSource = () => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {}
      activeSourceRef.current = null;
    }
  };

  const playSegmentAudio = (
    segment: 'hook' | 'body' | 'cta',
    offsetSeconds: number = 0,
    overrideProfiles?: typeof normalizationProfiles,
    overrideNormEnabled?: boolean
  ) => {
    stopActiveAudioSource();
    if (isMuted || !isPlaying) return;

    const ctx = audioContextRef.current || getAudioContext();
    audioContextRef.current = ctx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const buffer =
      segment === 'hook'
        ? buffersRef.current.hook
        : segment === 'body'
        ? buffersRef.current.body
        : buffersRef.current.cta;

    if (!buffer) return;

    const baseTrim =
      segment === 'hook'
        ? hookTrimStart
        : segment === 'body'
        ? bodyTrimStart
        : ctaTrimStart;

    try {
      if (!masterCompressorRef.current || !masterGainNodeRef.current) {
        const masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);
        const masteringInput = createStudioMasteringChain(ctx, masterGain);
        masterCompressorRef.current = masteringInput;
        masterGainNodeRef.current = masterGain;
      }

      masterGainNodeRef.current.gain.setValueAtTime(isMuted ? 0 : 1, ctx.currentTime);

      const activeProfiles = overrideProfiles || normalizationProfiles;
      const normOn = overrideNormEnabled !== undefined ? overrideNormEnabled : isNormalizationEnabled;
      const prof = segment === 'hook' ? activeProfiles.hook : segment === 'body' ? activeProfiles.body : activeProfiles.cta;
      const targetGain = normOn && prof ? prof.normalizationGain : 1.0;

      const segGain = ctx.createGain();
      segGain.gain.setValueAtTime(0, ctx.currentTime);
      segGain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.015);
      segGain.connect(masterCompressorRef.current);
      currentSegmentGainRef.current = segGain;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speed;
      source.connect(segGain);

      const safeOffset = Math.max(0, Math.min(baseTrim + offsetSeconds * speed, buffer.duration - 0.05));
      source.start(0, safeOffset);
      activeSourceRef.current = source;
    } catch (e) {
      console.warn('[VideoPlayerModal] Aviso ao reproduzir áudio sincronizado:', e);
    }
  };

  // Pre-load and decode audio tracks from all 3 clips into Web Audio buffers
  useEffect(() => {
    if (!variation) return;

    const ctx = getAudioContext();
    audioContextRef.current = ctx;
    let mounted = true;

    Promise.all([
      getOrDecodeClipAudio(variation.hookClip, ctx),
      getOrDecodeClipAudio(variation.bodyClip, ctx),
      getOrDecodeClipAudio(variation.ctaClip, ctx),
    ]).then(([h, b, c]) => {
      if (mounted) {
        buffersRef.current = { hook: h, body: b, cta: c };

        const hProf = calculateNormalizationGain(h);
        const bProf = calculateNormalizationGain(b);
        const cProf = calculateNormalizationGain(c);
        const profiles = { hook: hProf, body: bProf, cta: cProf };
        setNormalizationProfiles(profiles);

        if (isPlaying && !isMuted) {
          playSegmentAudio('hook', 0, profiles, isNormalizationEnabled);
        }
      }
    });

    return () => {
      mounted = false;
      stopActiveAudioSource();
    };
  }, [variation?.id]);

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopActiveAudioSource();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle play/pause, continuous sequential concatenation loop (Hook -> Body -> CTA) and Web Audio sync
  useEffect(() => {
    if (!activeVariation) return;

    lastTimeRef.current = performance.now();

    const hookVideo = hookVideoRef.current;
    const bodyVideo = bodyVideoRef.current;
    const ctaVideo = ctaVideoRef.current;

    if (isPlaying) {
      const seg = activeSegRef.current;
      const t = currentTimeRef.current;
      if (seg === 'hook' && hookVideo) {
        hookVideo.muted = true;
        hookVideo.playbackRate = speed;
        hookVideo.play().catch(() => {});
        if (!isMuted && buffersRef.current.hook && !activeSourceRef.current) {
          playSegmentAudio('hook', t);
        }
      } else if (seg === 'body' && bodyVideo) {
        bodyVideo.muted = true;
        bodyVideo.playbackRate = speed;
        bodyVideo.play().catch(() => {});
        if (!isMuted && buffersRef.current.body && !activeSourceRef.current) {
          playSegmentAudio('body', Math.max(0, t - hookDur));
        }
      } else if (seg === 'cta' && ctaVideo) {
        ctaVideo.muted = true;
        ctaVideo.playbackRate = speed;
        ctaVideo.play().catch(() => {});
        if (!isMuted && buffersRef.current.cta && !activeSourceRef.current) {
          playSegmentAudio('cta', Math.max(0, t - hookDur - bodyDur));
        }
      }
    }

    let lastUiUpdateTime = 0;

    const renderLoop = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (isPlaying) {
        currentTimeRef.current += dt;
        if (currentTimeRef.current >= totalDuration) {
          currentTimeRef.current = 0; // Loop playback
          activeSegRef.current = 'hook';
          const h = hookVideoRef.current;
          if (h) {
            if (Math.abs(h.currentTime - hookTrimStart) > 0.08) {
              h.currentTime = hookTrimStart;
            }
            h.playbackRate = speed;
            h.play().catch(() => {});
          }
          if (!isMuted) {
            playSegmentAudio('hook', 0);
          }
        }

        // Throttle React state update to ~20fps to keep render loop buttery smooth
        if (now - lastUiUpdateTime > 50 || currentTimeRef.current === 0) {
          lastUiUpdateTime = now;
          setCurrentTime(currentTimeRef.current);
        }
      }

      const t = currentTimeRef.current;
      const hVideo = hookVideoRef.current;
      const bVideo = bodyVideoRef.current;
      const cVideo = ctaVideoRef.current;

      // Seamless sequential concatenation: Gancho -> Corpo -> CTA
      if (t < hookDur) {
        if (activeSegRef.current !== 'hook') {
          activeSegRef.current = 'hook';
          if (bVideo) bVideo.pause();
          if (cVideo) cVideo.pause();
          if (hVideo) {
            if (Math.abs(hVideo.currentTime - hookTrimStart) > 0.08) {
              hVideo.currentTime = hookTrimStart;
            }
            hVideo.playbackRate = speed;
            if (isPlaying) hVideo.play().catch(() => {});
          }
          if (!isMuted) {
            playSegmentAudio('hook', 0);
          }
        }
      } else if (t < hookDur + bodyDur) {
        if (activeSegRef.current !== 'body') {
          activeSegRef.current = 'body';
          if (hVideo) hVideo.pause();
          if (cVideo) cVideo.pause();
          if (bVideo) {
            if (Math.abs(bVideo.currentTime - bodyTrimStart) > 0.08) {
              bVideo.currentTime = bodyTrimStart;
            }
            bVideo.playbackRate = speed;
            if (isPlaying) bVideo.play().catch(() => {});
          }
          if (!isMuted) {
            playSegmentAudio('body', 0);
          }
        }
      } else {
        if (activeSegRef.current !== 'cta') {
          activeSegRef.current = 'cta';
          if (hVideo) hVideo.pause();
          if (bVideo) bVideo.pause();
          if (cVideo) {
            if (Math.abs(cVideo.currentTime - ctaTrimStart) > 0.08) {
              cVideo.currentTime = ctaTrimStart;
            }
            cVideo.playbackRate = speed;
            if (isPlaying) cVideo.play().catch(() => {});
          }
          if (!isMuted) {
            playSegmentAudio('cta', 0);
          }
        }
      }

      if (!isPlaying) {
        stopActiveAudioSource();
        [hVideo, bVideo, cVideo].forEach((v) => {
          if (v && !v.paused) v.pause();
        });
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (t === 0 && !isPlaying && coverCanvasRef.current) {
            ctx.drawImage(coverCanvasRef.current, 0, 0, 540, 960);
          } else {
            drawCreativeFrame(
              ctx,
              activeVariation,
              t * speed,
              hVideo,
              bVideo,
              cVideo,
              {
                isExporting: false,
              }
            );
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      stopActiveAudioSource();
      [hookVideoRef.current, bodyVideoRef.current, ctaVideoRef.current].forEach((v) => {
        if (v && !v.paused) v.pause();
      });
    };
  }, [activeVariation, isPlaying, isMuted, totalDuration, hookDur, bodyDur, ctaDur]);

  if (!activeVariation) return null;

  const currentSegment =
    currentTime < hookDur
      ? 'Gancho'
      : currentTime < hookDur + bodyDur
      ? 'Corpo'
      : 'CTA Final';

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (nextMuted) {
      stopActiveAudioSource();
      if (masterGainNodeRef.current && audioContextRef.current) {
        masterGainNodeRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      }
    } else {
      if (masterGainNodeRef.current && audioContextRef.current) {
        masterGainNodeRef.current.gain.setValueAtTime(1, audioContextRef.current.currentTime);
      }
      const seg = activeSegRef.current;
      const segOffset =
        seg === 'hook'
          ? currentTime
          : seg === 'body'
          ? currentTime - hookDur
          : currentTime - hookDur - bodyDur;
      playSegmentAudio(seg, Math.max(0, segOffset));
    }
  };

  const handleToggleNormalization = () => {
    const nextVal = !isNormalizationEnabled;
    setIsNormalizationEnabled(nextVal);

    if (currentSegmentGainRef.current && audioContextRef.current) {
      const prof =
        activeSegRef.current === 'hook'
          ? normalizationProfiles.hook
          : activeSegRef.current === 'body'
          ? normalizationProfiles.body
          : normalizationProfiles.cta;
      const targetGain = nextVal && prof ? prof.normalizationGain : 1.0;
      currentSegmentGainRef.current.gain.linearRampToValueAtTime(
        targetGain,
        audioContextRef.current.currentTime + 0.02
      );
    }
  };

  const handleSeek = (newTime: number) => {
    currentTimeRef.current = newTime;
    setCurrentTime(newTime);
    const hookVideo = hookVideoRef.current;
    const bodyVideo = bodyVideoRef.current;
    const ctaVideo = ctaVideoRef.current;

    if (newTime < hookDur) {
      activeSegRef.current = 'hook';
      if (hookVideo) {
        hookVideo.currentTime = hookTrimStart + newTime * speed;
        if (isPlaying) hookVideo.play().catch(() => {});
      }
      if (bodyVideo) bodyVideo.pause();
      if (ctaVideo) ctaVideo.pause();
      if (!isMuted && isPlaying) {
        playSegmentAudio('hook', newTime);
      }
    } else if (newTime < hookDur + bodyDur) {
      activeSegRef.current = 'body';
      const offset = newTime - hookDur;
      if (bodyVideo) {
        bodyVideo.currentTime = bodyTrimStart + offset * speed;
        if (isPlaying) bodyVideo.play().catch(() => {});
      }
      if (hookVideo) hookVideo.pause();
      if (ctaVideo) ctaVideo.pause();
      if (!isMuted && isPlaying) {
        playSegmentAudio('body', offset);
      }
    } else {
      activeSegRef.current = 'cta';
      const offset = newTime - hookDur - bodyDur;
      if (ctaVideo) {
        ctaVideo.currentTime = ctaTrimStart + offset * speed;
        if (isPlaying) ctaVideo.play().catch(() => {});
      }
      if (hookVideo) hookVideo.pause();
      if (bodyVideo) bodyVideo.pause();
      if (!isMuted && isPlaying) {
        playSegmentAudio('cta', offset);
      }
    }
  };

  const handleCloseModal = () => {
    stopActiveAudioSource();
    [hookVideoRef.current, bodyVideoRef.current, ctaVideoRef.current].forEach((v) => {
      if (v) v.pause();
    });
    onClose();
  };

  const handleDownloadMp4 = async () => {
    if (isRecording) return;
    setIsRecording(true);
    setRecordProgress(0);
    setDownloadSuccess(false);

    try {
      const safeCode = activeVariation.code.replace(/\+/g, '-');
      const hash = activeVariation.microEdit?.hashHex || 'CLEAN';

      const videoBlob = await renderSingleVariationToBlob(
        activeVariation,
        (p) => {
          setRecordProgress(p);
        },
        isNormalizationEnabled
      );

      // Download MP4 video with mastered audio and High-Impact Cover embedded as 1st frame
      const videoUrl = URL.createObjectURL(videoBlob);
      const videoLink = document.createElement('a');
      videoLink.href = videoUrl;
      videoLink.download = `clip27_${safeCode}_${hash}.mp4`;
      document.body.appendChild(videoLink);
      videoLink.click();
      document.body.removeChild(videoLink);
      URL.revokeObjectURL(videoUrl);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Erro na gravação do vídeo .MP4:', err);
    } finally {
      setIsRecording(false);
    }
  };

  const handleCopyField = (text: string, field: 'cover' | 'seo') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField((prev) => (prev === field ? null : prev));
    }, 2500);
  };

  const handleDownloadCoverPng = async () => {
    if (isDownloadingCover) return;
    setIsDownloadingCover(true);
    try {
      const blob = await renderHighImpactCoverToPngBlob(activeVariation);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CAPA_${activeVariation.code.replace(/\+/g, '-')}_ALTO_IMPACTO.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar capa PNG:', err);
    } finally {
      setIsDownloadingCover(false);
    }
  };

  const coverTitle =
    activeVariation.coverTitle ||
    activeVariation.headline ||
    'NÃO COMPRE ANTES DE VER ESSE TESTE!';
  const coverBadge = (activeVariation.coverBadge || '🚨 ALERTA DE COMPRA')
    .split('·')[0]
    .trim();
  const seoCaption = activeVariation.seoCaption || '';

  const hookThumbUrl = getClipFirstFrameDataUrl(activeVariation.hookClip);
  const hookUrl =
    activeVariation.hookClip?.fileUrl ||
    getClipBlobUrl(activeVariation.hookClip?.id) ||
    getClipBlobUrl(activeVariation.hookClip?.fileName);
  const bodyUrl =
    activeVariation.bodyClip?.fileUrl ||
    getClipBlobUrl(activeVariation.bodyClip?.id) ||
    getClipBlobUrl(activeVariation.bodyClip?.fileName);
  const ctaUrl =
    activeVariation.ctaClip?.fileUrl ||
    getClipBlobUrl(activeVariation.ctaClip?.id) ||
    getClipBlobUrl(activeVariation.ctaClip?.fileName);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4 bg-black/95 backdrop-blur-2xl animate-fade-in flex flex-col justify-start items-center min-h-screen"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCloseModal();
        }
      }}
    >
      {/* Top Floating Control Bar */}
      <div className="w-full max-w-5xl my-2 flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-purple-500/40 backdrop-blur-xl shadow-2xl z-[80]">
        <button
          onClick={handleCloseModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/30 cursor-pointer transition-all active:scale-95"
          title="Voltar ao Estúdio de Criativos"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
          <span>Voltar ao Estúdio</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black text-fuchsia-300 bg-fuchsia-950/80 px-2.5 py-1 rounded-lg border border-fuchsia-500/30">
            {activeVariation.code}
          </span>
          <span className="hidden sm:inline-flex text-[11px] font-mono font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
            MP4 LIMPO + CAPA ALTO IMPACTO + LEGENDA SEO
          </span>
        </div>

        <button
          onClick={handleCloseModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-200 font-bold text-xs border border-rose-500/40 cursor-pointer transition-all active:scale-95"
          title="Fechar Visualização (ESC)"
        >
          <span>Fechar</span>
          <X className="w-4 h-4 text-rose-300" />
        </button>
      </div>

      {/* Offscreen real video elements for visual decoding */}
      <div
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '320px',
          height: '568px',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -999,
        }}
      >
        {hookUrl && (
          <video
            ref={hookVideoRef}
            src={hookUrl}
            playsInline
            muted={true}
            preload="auto"
          />
        )}
        {bodyUrl && (
          <video
            ref={bodyVideoRef}
            src={bodyUrl}
            playsInline
            muted={true}
            preload="auto"
          />
        )}
        {ctaUrl && (
          <video
            ref={ctaVideoRef}
            src={ctaUrl}
            playsInline
            muted={true}
            preload="auto"
          />
        )}
      </div>

      {/* Main Modal Card */}
      <div className="w-full max-w-5xl my-auto flex flex-col lg:flex-row glass-card rounded-3xl border border-purple-500/30 overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.3)] relative">
        {/* Left Side: Vertical 9:16 Clean Video Canvas Player */}
        <div className="relative flex-1 bg-black flex items-center justify-center p-3 sm:p-5 min-h-[380px] sm:min-h-[520px]">
          <div className="relative aspect-[9/16] h-[360px] sm:h-[480px] md:h-[540px] max-w-full rounded-2xl overflow-hidden border border-purple-500/40 shadow-[0_0_30px_rgba(217,70,239,0.3)] bg-slate-950">
            <canvas
              ref={canvasRef}
              width={540}
              height={960}
              className="w-full h-full object-contain cursor-pointer"
              onClick={() => setIsPlaying(!isPlaying)}
            />

            {!isPlaying && (
              <div
                onClick={() => setIsPlaying(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-[0_0_25px_rgba(168,85,247,0.6)] transform hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 fill-current translate-x-0.5" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Concatenated Sequence, Cover + SEO Copy & Clean MP4 Export */}
        <div className="w-full lg:w-[450px] p-5 sm:p-6 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-purple-500/20 bg-slate-950/85 overflow-y-auto max-h-[75vh] lg:max-h-[88vh]">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-purple-500/15">
              <div>
                <div className="flex items-center gap-2 text-xs text-fuchsia-400 font-mono font-bold">
                  <span>{activeVariation.code}</span>
                  <span>·</span>
                  <span className="text-emerald-400">MP4 9:16 LIMPO</span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
                  Vídeo Combinado + Capa &amp; Legenda SEO
                </h3>
              </div>
            </div>

            {/* 1. CAPA DE ALTO IMPACTO (Com a 1ª Imagem do Gancho de Fundo) */}
            <div className="rounded-xl p-3 border-2 border-amber-400/60 space-y-2 relative overflow-hidden bg-slate-950">
              {hookThumbUrl ? (
                <img
                  src={hookThumbUrl}
                  alt="Primeira imagem do Gancho"
                  className="absolute inset-0 w-full h-full object-cover opacity-85 pointer-events-none"
                />
              ) : hookUrl ? (
                <video
                  src={`${hookUrl}#t=0.05`}
                  muted
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-cover opacity-85 pointer-events-none"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-950/80 via-slate-950 to-fuchsia-950/60 pointer-events-none" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/75 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider">
                  <Zap className="w-2.5 h-2.5 fill-current" />
                  <span>CAPA · {coverBadge}</span>
                </span>
                <span className="text-[9px] font-mono text-amber-300 font-bold bg-black/60 px-1.5 py-0.5 rounded border border-amber-400/30">
                  FUNDO: 1ª IMAGEM G{activeVariation.hookIndex}
                </span>
              </div>

              <div className="relative z-10 p-2 rounded-lg bg-slate-950/75 border border-amber-400/50 backdrop-blur-[2px]">
                <p className="text-xs font-black text-amber-300 uppercase leading-snug text-center">
                  &ldquo;{coverTitle}&rdquo;
                </p>
              </div>

              <div className="relative z-10 flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyField(coverTitle, 'cover')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                    copiedField === 'cover'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  }`}
                >
                  {copiedField === 'cover' ? (
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
                  onClick={handleDownloadCoverPng}
                  disabled={isDownloadingCover}
                  className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-amber-200 border border-amber-400/40 transition-all cursor-pointer"
                >
                  {isDownloadingCover ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span>Baixar Capa PNG</span>
                </button>
              </div>
            </div>

            {/* 2. LEGENDA SEO PARA TIKTOK */}
            <div className="rounded-xl p-3 bg-slate-900/90 border border-emerald-500/35 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-300 uppercase">
                  <FileText className="w-3 h-3 text-emerald-400" />
                  <span>Legenda SEO p/ Descrição do TikTok</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  PRONTO P/ COLAR
                </span>
              </div>

              <div className="max-h-24 overflow-y-auto p-2 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] text-slate-200 whitespace-pre-line leading-relaxed select-all">
                {seoCaption}
              </div>

              <button
                type="button"
                onClick={() => handleCopyField(seoCaption, 'seo')}
                className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  copiedField === 'seo'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {copiedField === 'seo' ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Legenda SEO Copiada! (Só colar no TikTok)</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Legenda SEO (Descrição TikTok)</span>
                  </>
                )}
              </button>
            </div>

            {/* Combined clips breakdown */}
            <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/20 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 text-[10px] uppercase tracking-wider">
                  Sequência Concatenada (Gancho → Corpo → CTA):
                </span>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => handleSeek(0)}
                  className={`w-full p-1.5 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer text-left ${
                    currentSegment === 'Gancho'
                      ? 'bg-fuchsia-500/25 border border-fuchsia-500/40 text-fuchsia-200'
                      : 'bg-slate-900/60 hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-4 h-4 rounded-full bg-fuchsia-500/30 text-fuchsia-300 text-[9px] font-mono flex items-center justify-center shrink-0">
                      G{activeVariation.hookIndex}
                    </span>
                    <span className="truncate text-[11px] font-semibold">
                      {activeVariation.hookClip?.fileName || activeVariation.hookClip?.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono shrink-0 text-slate-400">{hookDur.toFixed(1)}s</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSeek(hookDur + 0.05)}
                  className={`w-full p-1.5 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer text-left ${
                    currentSegment === 'Corpo'
                      ? 'bg-sky-500/25 border border-sky-500/40 text-sky-200'
                      : 'bg-slate-900/60 hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-4 h-4 rounded-full bg-sky-500/30 text-sky-300 text-[9px] font-mono flex items-center justify-center shrink-0">
                      C{activeVariation.bodyIndex}
                    </span>
                    <span className="truncate text-[11px] font-semibold">
                      {activeVariation.bodyClip?.fileName || activeVariation.bodyClip?.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono shrink-0 text-slate-400">{bodyDur.toFixed(1)}s</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSeek(hookDur + bodyDur + 0.05)}
                  className={`w-full p-1.5 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer text-left ${
                    currentSegment === 'CTA Final'
                      ? 'bg-emerald-500/25 border border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-900/60 hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/30 text-emerald-300 text-[9px] font-mono flex items-center justify-center shrink-0">
                      CTA{activeVariation.ctaIndex}
                    </span>
                    <span className="truncate text-[11px] font-semibold">
                      {activeVariation.ctaClip?.fileName || activeVariation.ctaClip?.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono shrink-0 text-slate-400">{ctaDur.toFixed(1)}s</span>
                </button>
              </div>
            </div>

            {/* Audio Normalization Panel */}
            <div className="p-2.5 rounded-xl bg-gradient-to-b from-indigo-950/40 to-purple-950/40 border border-indigo-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-white">
                      Nivelamento de Áudio (-14 LUFS)
                    </h4>
                    <p className="text-[9px] text-slate-400">
                      Nivela o volume original nos 3 vídeos concatenados
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleToggleNormalization}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                    isNormalizationEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {isNormalizationEnabled ? 'Nivelado ATIVO' : 'Desativado'}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Timeline Scrubber & Download Actions */}
          <div className="space-y-3 pt-3 mt-3 border-t border-purple-500/15">
            {/* Timeline Scrubber */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>
                  Segmento: <strong className="text-white">{currentSegment}</strong>
                </span>
                <span>
                  {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={totalDuration}
                step={0.1}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full accent-fuchsia-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold border border-purple-500/30 transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pausar' : 'Reproduzir'}</span>
              </button>

              <button
                onClick={() => handleSeek(0)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-purple-500/30 transition-colors cursor-pointer"
                title="Reiniciar do Gancho"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleToggleMute}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isMuted
                    ? 'bg-rose-950/50 text-rose-400 border-rose-500/30'
                    : 'bg-slate-900 text-emerald-400 border-purple-500/30 hover:bg-slate-800'
                }`}
                title={isMuted ? 'Ativar Som' : 'Silenciar'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {onDeleteVariation && (
                <button
                  onClick={() => {
                    onDeleteVariation(activeVariation.id);
                    handleCloseModal();
                  }}
                  className="p-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                  title="Excluir esta variação"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Export / Download MP4 Button */}
            <div className="space-y-2">
              <button
                onClick={handleDownloadMp4}
                disabled={isRecording}
                className="w-full py-3 px-4 rounded-xl font-black text-xs text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(217,70,239,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isRecording ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Renderizando Vídeo MP4 (Capa no 1º frame) ({recordProgress}%)...</span>
                  </>
                ) : downloadSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Vídeo MP4 com Capa Embutida Baixado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Baixar Vídeo (.MP4 com Capa Embutida)</span>
                  </>
                )}
              </button>

              {onOpenZipModal && (totalVariationsCount || 0) > 1 && (
                <button
                  onClick={() => {
                    handleCloseModal();
                    onOpenZipModal();
                  }}
                  className="w-full py-2 px-4 rounded-xl font-bold text-xs text-purple-200 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>Baixar Todos os {totalVariationsCount} Vídeos (.ZIP)</span>
                </button>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 pt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Áudio Masterizado 320kbps (-14 LUFS) · Capa de alto impacto já embutida no 1º frame do MP4</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
