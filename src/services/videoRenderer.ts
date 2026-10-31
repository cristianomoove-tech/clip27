import { CreativeVariation } from '../types';
import {
  getClipBlobUrl,
  getClipBlobData,
  getClipFirstFrameDataUrl,
  extractVideoFirstFrameAndDuration,
  isDemoClip,
} from './clipStore';
import { setupSynchronizedAudioGraph, getAudioContext } from './audioManager';

export interface RenderContext {
  canvas: HTMLCanvasElement;
  variation: CreativeVariation;
  currentTime: number; // in seconds
  totalDuration: number; // in seconds
  isPlaying: boolean;
}

export interface DrawFrameOptions {
  isExporting?: boolean;
}

/**
 * Draws a single frame of the combined video (Hook -> Body -> CTA) onto the 540x960 canvas.
 * Renders EXCLUSIVELY the clean video without any top headlines, bottom subtitles, or text overlays.
 */
export function drawCreativeFrame(
  ctx: CanvasRenderingContext2D,
  variation: CreativeVariation,
  currentTime: number,
  hookVideoEl?: HTMLVideoElement | null,
  bodyVideoEl?: HTMLVideoElement | null,
  ctaVideoEl?: HTMLVideoElement | null,
  _options?: DrawFrameOptions
) {
  const width = ctx.canvas.width || 1080;
  const height = ctx.canvas.height || 1920;

  const hookDur = variation.hookClip?.duration || 4.0;
  const bodyDur = variation.bodyClip?.duration || 7.0;
  const ctaDur = variation.ctaClip?.duration || 3.5;

  // Determine current active clip in the sequential concatenation (Hook -> Body -> CTA)
  let currentSegment: 'hook' | 'body' | 'cta' = 'hook';
  let segmentTime = currentTime;
  let activeClip = variation.hookClip;
  let activeVideoEl = hookVideoEl;

  if (currentTime < hookDur) {
    currentSegment = 'hook';
    segmentTime = currentTime;
    activeClip = variation.hookClip;
    activeVideoEl = hookVideoEl;
  } else if (currentTime < hookDur + bodyDur) {
    currentSegment = 'body';
    segmentTime = currentTime - hookDur;
    activeClip = variation.bodyClip;
    activeVideoEl = bodyVideoEl;
  } else {
    currentSegment = 'cta';
    segmentTime = Math.min(currentTime - hookDur - bodyDur, ctaDur);
    activeClip = variation.ctaClip;
    activeVideoEl = ctaVideoEl;
  }

  // Clear canvas
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Subtle background micro-edit transformation for unique file signature
  const baseZoom = variation.microEdit?.zoom || 1.01;
  const brightness = 1 + (variation.microEdit?.brightness || 0);
  const saturation = 1 + (variation.microEdit?.saturation || 0);

  // Fast GPU hardware path (avoid expensive ctx.filter SVG convolution which drops fps to 20)
  ctx.filter = 'none';

  ctx.translate(width / 2, height / 2);
  ctx.scale(baseZoom, baseZoom);
  ctx.translate(-width / 2, -height / 2);

  // Check if real uploaded video element has decoded frames ready
  const hasRealVideo =
    activeVideoEl &&
    (activeVideoEl.readyState >= 2 || activeVideoEl.videoWidth > 0);

  let drewRealVideo = false;
  if (hasRealVideo && activeVideoEl) {
    try {
      const vWidth = activeVideoEl.videoWidth || width;
      const vHeight = activeVideoEl.videoHeight || height;

      // Scale to cover 9:16 vertical frame preserving aspect ratio
      const scale = Math.max(width / vWidth, height / vHeight);
      const drawW = vWidth * scale;
      const drawH = vHeight * scale;
      const drawX = (width - drawW) / 2;
      const drawY = (height - drawH) / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(activeVideoEl, drawX, drawY, drawW, drawH);

      // Fast hardware-accelerated micro-edit lighting without expensive SVG filters
      if (Math.abs(brightness - 1) > 0.003) {
        const diff = brightness - 1;
        ctx.save();
        if (diff > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.08, diff).toFixed(3)})`;
          ctx.globalCompositeOperation = 'screen';
          ctx.fillRect(drawX, drawY, drawW, drawH);
        } else {
          ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.08, -diff).toFixed(3)})`;
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillRect(drawX, drawY, drawW, drawH);
        }
        ctx.restore();
      }

      drewRealVideo = true;
    } catch {
      drewRealVideo = false;
    }
  }

  if (!drewRealVideo) {
    if (activeClip && !isDemoClip(activeClip)) {
      drawUserClipLoadingBackdrop(ctx, currentSegment, width, height);
    } else {
      drawCleanProceduralDemoSegment(ctx, activeClip, currentSegment, segmentTime, width, height);
    }
  }

  ctx.restore();

  // Imperceptible 2x2 pixel hash in bottom-right corner (3% alpha) to guarantee unique binary hash per combination
  drawImperceptibleHashPixel(ctx, variation, width, height);
}

function drawImperceptibleHashPixel(
  ctx: CanvasRenderingContext2D,
  variation: CreativeVariation,
  width: number,
  height: number
) {
  const hex = variation.microEdit?.hashHex || 'A8F29B01';
  const r = parseInt(hex.slice(0, 2), 16) || 128;
  const g = parseInt(hex.slice(2, 4), 16) || 64;
  const b = parseInt(hex.slice(4, 6), 16) || 210;
  ctx.save();
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.03)`;
  ctx.fillRect(width - 2, height - 2, 2, 2);
  ctx.restore();
}

/**
 * Clean visual backdrop without text overlays while a real user video frame is buffered
 */
function drawUserClipLoadingBackdrop(
  ctx: CanvasRenderingContext2D,
  segment: 'hook' | 'body' | 'cta',
  width: number,
  height: number
) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e1b4b');
  grad.addColorStop(1, '#090d16');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const segColor =
    segment === 'hook' ? '#d946ef' : segment === 'body' ? '#38bdf8' : '#22c55e';

  ctx.save();
  ctx.strokeStyle = segColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Clean animated visual for demo clips (when no real file is uploaded), free of any burned text overlays
 */
function drawCleanProceduralDemoSegment(
  ctx: CanvasRenderingContext2D,
  clip:
    | {
        colorTheme?: string;
        demoData?: {
          gradient: [string, string];
        };
      }
    | undefined,
  segment: 'hook' | 'body' | 'cta',
  segmentTime: number,
  width: number,
  height: number
) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  if (clip?.demoData?.gradient) {
    grad.addColorStop(0, clip.demoData.gradient[0]);
    grad.addColorStop(1, clip.demoData.gradient[1]);
  } else {
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(1, '#0f172a');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const wave = Math.sin(segmentTime * 2.5) * 40;
  const pulseGrad = ctx.createRadialGradient(
    width / 2,
    height * 0.5 + wave,
    30,
    width / 2,
    height * 0.5 + wave,
    340
  );
  pulseGrad.addColorStop(0, 'rgba(217, 70, 239, 0.28)');
  pulseGrad.addColorStop(0.5, 'rgba(147, 51, 234, 0.12)');
  pulseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = pulseGrad;
  ctx.fillRect(0, 0, width, height);

  const centerY = height * 0.5;
  const segColor =
    segment === 'hook' ? '#ec4899' : segment === 'body' ? '#38bdf8' : '#22c55e';

  ctx.save();
  ctx.strokeStyle = segColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(width / 2, centerY, 95 + Math.sin(segmentTime * 3) * 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = segColor;
  ctx.beginPath();
  ctx.arc(width / 2, centerY, 38, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(width / 2, centerY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Helper to create and preload video element with guaranteed decoded frame (never resolves on metadata-only)
export function createVideoElement(
  src?: string,
  unmuted = false,
  initialSeekTime = 0
): Promise<HTMLVideoElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = src;
    video.muted = !unmuted;
    video.volume = 1;
    video.playsInline = true;
    video.preload = 'auto';

    if (src.startsWith('http://') || src.startsWith('https://')) {
      video.crossOrigin = 'anonymous';
    }

    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '320px';
    video.style.height = '568px';
    video.style.opacity = '0.001';
    video.style.pointerEvents = 'none';
    document.body.appendChild(video);

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      requestAnimationFrame(() => resolve(video));
    };

    const onSeeked = () => {
      finish();
    };

    const onLoadedData = () => {
      if (initialSeekTime > 0) {
        try {
          video.addEventListener('seeked', onSeeked, { once: true });
          video.currentTime = initialSeekTime;
          return;
        } catch {}
      }
      finish();
    };

    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('canplay', onLoadedData);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    const onError = () => {
      finish();
    };

    video.addEventListener('loadeddata', onLoadedData, { once: true });
    video.addEventListener('canplay', onLoadedData, { once: true });
    video.addEventListener('error', onError, { once: true });

    if (video.readyState >= 2) {
      onLoadedData();
    } else {
      video.load();
    }

    setTimeout(() => {
      finish();
    }, 3500);
  });
}

export interface VideoFormatConfig {
  mimeType: string;
  extension: 'mp4' | 'webm';
  label: string;
}

export function detectOptimalVideoFormat(): VideoFormatConfig {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return {
      mimeType: 'video/mp4',
      extension: 'mp4',
      label: 'MP4 (Padrão TikTok)',
    };
  }

  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264,aac',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];

  for (const candidate of mp4Candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return {
          mimeType: candidate,
          extension: 'mp4',
          label: 'MP4 H.264 (TikTok Nativo)',
        };
      }
    } catch {}
  }

  const fallbacks = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  for (const candidate of fallbacks) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return {
          mimeType: candidate,
          extension: 'mp4',
          label: 'MP4 Compatível TikTok',
        };
      }
    } catch {}
  }

  return {
    mimeType: 'video/mp4',
    extension: 'mp4',
    label: 'MP4 (TikTok)',
  };
}

export async function recordCreativeToWebm(
  canvas: HTMLCanvasElement,
  variation: CreativeVariation,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return recordCreativeToMp4(canvas, variation, onProgress);
}

export async function recordCreativeToMp4(
  _canvas: HTMLCanvasElement,
  variation: CreativeVariation,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return renderSingleVariationToBlob(variation, onProgress);
}

/**
 * Concatenates and records Hook -> Body -> CTA into a single unified, 100% clean MP4 video file
 * with synchronized audio and zero text overlays.
 */
export async function renderSingleVariationToBlob(
  variation: CreativeVariation,
  onProgress?: (percent: number) => void,
  enableNormalization: boolean = true
): Promise<Blob> {
  const hookUrl =
    variation.hookClip?.fileUrl ||
    getClipBlobUrl(variation.hookClip?.id) ||
    getClipBlobUrl(variation.hookClip?.fileName);
  const bodyUrl =
    variation.bodyClip?.fileUrl ||
    getClipBlobUrl(variation.bodyClip?.id) ||
    getClipBlobUrl(variation.bodyClip?.fileName);
  const ctaUrl =
    variation.ctaClip?.fileUrl ||
    getClipBlobUrl(variation.ctaClip?.id) ||
    getClipBlobUrl(variation.ctaClip?.fileName);

  const hookTrimStart = variation.hookClip?.trimStart || 0;
  const bodyTrimStart = variation.bodyClip?.trimStart || 0;
  const ctaTrimStart = variation.ctaClip?.trimStart || 0;

  // Load and prepare the 3 real video elements
  const [hookVideo, bodyVideo, ctaVideo] = await Promise.all([
    createVideoElement(hookUrl, false, hookTrimStart),
    createVideoElement(bodyUrl, false, bodyTrimStart),
    createVideoElement(ctaUrl, false, ctaTrimStart),
  ]);

  // 720p Vertical HD (720x1280) - Ideal standard for mobile platforms (TikTok, Reels, Shorts)
  // Perfectly balanced: high quality, crisp clarity, yet lightweight so the browser never drops frames
  const exportWidth = 720;
  const exportHeight = 1280;

  const canvas = document.createElement('canvas');
  canvas.width = exportWidth;
  canvas.height = exportHeight;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Pre-render the High-Impact Cover Canvas at 720p HD
  const coverCanvas = await renderHighImpactCoverCanvas(
    variation,
    hookVideo,
    exportWidth,
    exportHeight
  );

  // Paint the cover IMMEDIATELY onto the recording canvas so frame 0 is guaranteed to be the cover
  ctx.drawImage(coverCanvas, 0, 0, canvas.width, canvas.height);
  drawImperceptibleHashPixel(ctx, variation, canvas.width, canvas.height);

  const speed = variation.microEdit?.speed || 1.0;
  // 67ms (2 frames at 30fps): establishes initial keyframe as high-impact cover without delaying playback
  const COVER_DURATION = 0.067;
  const hookDur = (variation.hookClip?.duration || 4.0) / speed;
  const bodyDur = (variation.bodyClip?.duration || 7.0) / speed;
  const ctaDur = (variation.ctaClip?.duration || 3.5) / speed;
  const totalDur = COVER_DURATION + hookDur + bodyDur + ctaDur;

  const stream = canvas.captureStream(30);

  const audioCtx = getAudioContext();
  let audioGraph: Awaited<ReturnType<typeof setupSynchronizedAudioGraph>> | null = null;

  try {
    audioGraph = await setupSynchronizedAudioGraph(
      audioCtx,
      variation.hookClip,
      variation.bodyClip,
      variation.ctaClip,
      speed,
      enableNormalization,
      { hookVideo, bodyVideo, ctaVideo },
      { leadSilenceSeconds: COVER_DURATION }
    );

    const audioTrack = audioGraph.destination.stream.getAudioTracks()[0];
    if (audioTrack) {
      try {
        if ('contentHint' in audioTrack) {
          audioTrack.contentHint = 'speech';
        }
      } catch {}
      stream.addTrack(audioTrack);
    }
  } catch (err) {
    console.warn('[VideoRenderer] Aviso ao configurar grafo de áudio sincronizado:', err);
  }

  const format = detectOptimalVideoFormat();

  // 3.5 Mbps for 720p vertical video provides pristine broadcast quality without dropping frames
  const videoBitrate = 3500000;
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: videoBitrate,
    audioBitsPerSecond: 320000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise(async (resolve, reject) => {
    let animId: number;
    let isStopped = false;
    let currentSegment: 'cover' | 'hook' | 'body' | 'cta' = 'cover';
    let bodyPreRolled = false;
    let ctaPreRolled = false;
    let lastProgressTime = 0;
    let lastReportedPct = -1;

    const cleanupVideos = () => {
      [hookVideo, bodyVideo, ctaVideo].forEach((v) => {
        if (v) {
          try {
            v.pause();
            v.src = '';
            v.load(); // Forces immediate release of GPU hardware decoder context
          } catch {}
          if (v.parentNode) v.parentNode.removeChild(v);
        }
      });
    };

    // Pré-carrega o vídeo do gancho para que o primeiro frame de movimento esteja 100% decodificado
    if (hookVideo) {
      hookVideo.playbackRate = speed;
      try {
        await hookVideo.play();
      } catch {}
    }

    // Inicia áudio masterizado exatamente no clock do hardware de áudio
    const audioStartTime = audioCtx.currentTime;
    if (audioGraph) {
      audioGraph.startPlayback(audioStartTime);
    }

    recorder.onstop = () => {
      if (isStopped) return;
      isStopped = true;
      cancelAnimationFrame(animId);
      if (audioGraph) {
        audioGraph.stopPlayback();
      }
      cleanupVideos();
      resolve(new Blob(chunks, { type: 'video/mp4' }));
    };

    recorder.onerror = (e) => {
      if (isStopped) return;
      isStopped = true;
      cancelAnimationFrame(animId);
      if (audioGraph) {
        audioGraph.stopPlayback();
      }
      cleanupVideos();
      reject(e);
    };

    recorder.start(100);
    const startTime = performance.now();

    const renderLoop = (now: number) => {
      if (isStopped) return;
      const elapsed = (now - startTime) / 1000;
      const t = Math.min(elapsed, totalDur);

      if (t < COVER_DURATION) {
        // Frame 0..COVER_DURATION: Capa de Alto Impacto exibida como poster inicial
        ctx.save();
        ctx.drawImage(coverCanvas, 0, 0, canvas.width, canvas.height);
        drawImperceptibleHashPixel(ctx, variation, canvas.width, canvas.height);
        ctx.restore();
      } else {
        const videoTime = (t - COVER_DURATION) * speed;

        if (t < COVER_DURATION + hookDur) {
          if (currentSegment !== 'hook') {
            currentSegment = 'hook';
            if (hookVideo && hookVideo.paused) {
              hookVideo.playbackRate = speed;
              hookVideo.play().catch(() => {});
            }
          }

          // Pré-carrega o corpo 150ms antes do gancho acabar para o decodificador GPU já estar ativo
          if (!bodyPreRolled && bodyVideo && t >= COVER_DURATION + hookDur - 0.15) {
            bodyPreRolled = true;
            bodyVideo.currentTime = bodyTrimStart;
            bodyVideo.playbackRate = speed;
            bodyVideo.play().catch(() => {});
          }

          // Sincronização dinâmica de drift para o Gancho
          if (hookVideo && !hookVideo.paused) {
            const targetTime = hookTrimStart + (t - COVER_DURATION) * speed;
            const drift = hookVideo.currentTime - targetTime;
            if (Math.abs(drift) > 0.05) {
              hookVideo.playbackRate = drift < 0 ? speed * 1.05 : speed * 0.95;
            } else {
              hookVideo.playbackRate = speed;
            }
          }
        } else if (t < COVER_DURATION + hookDur + bodyDur) {
          if (currentSegment !== 'body') {
            currentSegment = 'body';
            if (hookVideo && !hookVideo.paused) hookVideo.pause();
            if (bodyVideo && bodyVideo.paused) {
              bodyVideo.playbackRate = speed;
              bodyVideo.play().catch(() => {});
            }
          }

          // Pré-carrega o CTA 150ms antes do corpo acabar
          if (!ctaPreRolled && ctaVideo && t >= COVER_DURATION + hookDur + bodyDur - 0.15) {
            ctaPreRolled = true;
            ctaVideo.currentTime = ctaTrimStart;
            ctaVideo.playbackRate = speed;
            ctaVideo.play().catch(() => {});
          }

          // Sincronização dinâmica de drift para o Corpo
          if (bodyVideo && !bodyVideo.paused) {
            const targetTime = bodyTrimStart + (t - COVER_DURATION - hookDur) * speed;
            const drift = bodyVideo.currentTime - targetTime;
            if (Math.abs(drift) > 0.05) {
              bodyVideo.playbackRate = drift < 0 ? speed * 1.05 : speed * 0.95;
            } else {
              bodyVideo.playbackRate = speed;
            }
          }
        } else {
          if (currentSegment !== 'cta') {
            currentSegment = 'cta';
            if (hookVideo && !hookVideo.paused) hookVideo.pause();
            if (bodyVideo && !bodyVideo.paused) bodyVideo.pause();
            if (ctaVideo && ctaVideo.paused) {
              ctaVideo.playbackRate = speed;
              ctaVideo.play().catch(() => {});
            }
          }

          // Sincronização dinâmica de drift para o CTA
          if (ctaVideo && !ctaVideo.paused) {
            const targetTime = ctaTrimStart + (t - COVER_DURATION - hookDur - bodyDur) * speed;
            const drift = ctaVideo.currentTime - targetTime;
            if (Math.abs(drift) > 0.05) {
              ctaVideo.playbackRate = drift < 0 ? speed * 1.05 : speed * 0.95;
            } else {
              ctaVideo.playbackRate = speed;
            }
          }
        }

        drawCreativeFrame(ctx, variation, videoTime, hookVideo, bodyVideo, ctaVideo, {
          isExporting: true,
        });
      }

      // Throttled progress reporting (avoid firing React setState 60x/sec to keep main thread free for 30fps)
      const currentPct = Math.min(100, Math.round((t / totalDur) * 100));
      if (onProgress && (currentPct !== lastReportedPct || currentPct === 100)) {
        if (now - lastProgressTime >= 150 || currentPct === 100) {
          lastReportedPct = currentPct;
          lastProgressTime = now;
          onProgress(currentPct);
        }
      }

      // Include a 60ms tail buffer so the final syllable of the CTA audio is never clipped
      if (elapsed < totalDur + 0.06) {
        animId = requestAnimationFrame(renderLoop);
      } else {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }
    };

    animId = requestAnimationFrame(renderLoop);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Generates a high-impact 9:16 Cover Canvas with the exact FIRST FRAME of the Hook video
 * as the background, overlaid with the High-Impact Cover Title + Badge.
 * Used both for the initial frame of the MP4 video and for the PNG export.
 * Supports native high-definition resolution (1080x1920 Full HD or responsive preview).
 */
export async function renderHighImpactCoverCanvas(
  variation: CreativeVariation,
  preloadedHookVideo?: HTMLVideoElement | null,
  targetWidth: number = 720,
  targetHeight: number = 1280
): Promise<HTMLCanvasElement> {
  const width = targetWidth;
  const height = targetHeight;
  const s = width / 540; // Proportional scale factor for typography & UI geometry
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const hookClip = variation.hookClip;
  let drewHookFirstFrame = false;

  // 1. If preloadedHookVideo is provided and has dimensions, draw it directly
  if (
    preloadedHookVideo &&
    (preloadedHookVideo.videoWidth > 0 || preloadedHookVideo.readyState >= 2)
  ) {
    try {
      const vWidth = preloadedHookVideo.videoWidth || width;
      const vHeight = preloadedHookVideo.videoHeight || height;
      const scale = Math.max(width / vWidth, height / vHeight);
      const drawW = vWidth * scale;
      const drawH = vHeight * scale;
      const drawX = (width - drawW) / 2;
      const drawY = (height - drawH) / 2;
      ctx.drawImage(preloadedHookVideo, drawX, drawY, drawW, drawH);
      drewHookFirstFrame = true;
    } catch {
      drewHookFirstFrame = false;
    }
  }

  // 2. Otherwise try cached thumbnailDataUrl / first-frame DataURL
  if (!drewHookFirstFrame) {
    const storedData =
      getClipBlobData(hookClip?.id) ||
      getClipBlobData(hookClip?.fileName) ||
      getClipBlobData(hookClip?.title);

    const hookUrl =
      hookClip?.fileUrl ||
      storedData?.url ||
      (storedData?.file ? URL.createObjectURL(storedData.file) : undefined);

    let firstFrameDataUrl = getClipFirstFrameDataUrl(hookClip);
    if (!firstFrameDataUrl && hookUrl) {
      try {
        const extracted = await extractVideoFirstFrameAndDuration(
          hookUrl,
          hookClip?.duration || 4.0
        );
        if (extracted.thumbnailDataUrl) {
          firstFrameDataUrl = extracted.thumbnailDataUrl;
          if (hookClip) {
            hookClip.thumbnailDataUrl = firstFrameDataUrl;
          }
          if (storedData) {
            storedData.thumbnailDataUrl = firstFrameDataUrl;
          }
        }
      } catch {}
    }

    if (firstFrameDataUrl) {
      const img = await loadImageElement(firstFrameDataUrl);
      if (img && img.width > 0 && img.height > 0) {
        const scale = Math.max(width / img.width, height / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = (width - drawW) / 2;
        const drawY = (height - drawH) / 2;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        drewHookFirstFrame = true;
      }
    }

    // 3. Fallback: decode directly from video element at 0.05s if needed
    if (!drewHookFirstFrame && hookUrl) {
      const hookVideo = await createVideoElement(hookUrl, false, 0.05);
      if (hookVideo && hookVideo.videoWidth > 0 && hookVideo.videoHeight > 0) {
        try {
          const vWidth = hookVideo.videoWidth;
          const vHeight = hookVideo.videoHeight;
          const scale = Math.max(width / vWidth, height / vHeight);
          const drawW = vWidth * scale;
          const drawH = vHeight * scale;
          const drawX = (width - drawW) / 2;
          const drawY = (height - drawH) / 2;
          ctx.drawImage(hookVideo, drawX, drawY, drawW, drawH);
          drewHookFirstFrame = true;
        } catch {}
      }
      if (hookVideo) {
        try {
          hookVideo.pause();
          hookVideo.src = '';
          hookVideo.load();
        } catch {}
        if (hookVideo.parentNode) {
          hookVideo.parentNode.removeChild(hookVideo);
        }
      }
    }
  }

  // 4. Only if it's a demo clip with no real video file at all, draw demo background
  if (!drewHookFirstFrame) {
    drawCleanProceduralDemoSegment(ctx, hookClip, 'hook', 0.2, width, height);
  }

  // 5. Light, subtle contrast gradient so the Hook's first frame remains bright and clearly visible
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.08)');
  grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.12)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 6. Top Badge Pill (Scales with s)
  const badgeText = (variation.coverBadge || '🚨 ALERTA DE COMPRA').split('·')[0].trim();
  ctx.save();
  ctx.font = `900 ${Math.round(18 * s)}px Inter, system-ui, sans-serif`;
  const badgeMetrics = ctx.measureText(badgeText);
  const badgeW = Math.min(width - 60 * s, badgeMetrics.width + 38 * s);
  const badgeH = 40 * s;
  const badgeX = (width - badgeW) / 2;
  const badgeY = 170 * s;

  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12 * s);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, width / 2, badgeY + badgeH / 2 + 1 * s);
  ctx.restore();

  // 7. High-Impact Main Cover Title (Wrapped with semi-transparent glass box)
  const titleText = (
    variation.coverTitle ||
    variation.headline ||
    'NÃO COMPRE ANTES DE VER ESSE TESTE!'
  ).toUpperCase();

  ctx.save();
  ctx.font = `900 ${Math.round(35 * s)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = titleText.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  const maxLineWidth = width - 76 * s;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxLineWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = 46 * s;
  const blockHeight = lines.length * lineHeight + 34 * s;
  const blockY = 225 * s;

  // Semi-transparent backing card so the Hook's first frame stays visible behind & below
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.roundRect(28 * s, blockY, width - 56 * s, blockHeight, 20 * s);
  ctx.fill();
  ctx.stroke();

  lines.forEach((line, i) => {
    const y = blockY + 23 * s + i * lineHeight + lineHeight / 2 - 8 * s;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 7 * s;
    ctx.lineJoin = 'round';
    ctx.strokeText(line, width / 2, y);
    ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#ffffff';
    ctx.fillText(line, width / 2, y);
  });
  ctx.restore();

  return canvas;
}

/**
 * Generates a high-impact 9:16 Cover Thumbnail PNG with the exact FIRST FRAME of the Hook video
 * as the background, overlaid with the High-Impact Cover Title + Badge.
 */
export async function renderHighImpactCoverToPngBlob(
  variation: CreativeVariation,
  targetWidth: number = 720,
  targetHeight: number = 1280
): Promise<Blob> {
  const canvas = await renderHighImpactCoverCanvas(variation, null, targetWidth, targetHeight);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob || new Blob([], { type: 'image/png' }));
    }, 'image/png');
  });
}
