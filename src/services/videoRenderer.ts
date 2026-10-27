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
  const width = 540;
  const height = 960;

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

  ctx.filter = `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(3)})`;

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
      const vWidth = activeVideoEl.videoWidth || 540;
      const vHeight = activeVideoEl.videoHeight || 960;

      // Scale to cover 9:16 vertical frame preserving aspect ratio
      const scale = Math.max(width / vWidth, height / vHeight);
      const drawW = vWidth * scale;
      const drawH = vHeight * scale;
      const drawX = (width - drawW) / 2;
      const drawY = (height - drawH) / 2;

      ctx.drawImage(activeVideoEl, drawX, drawY, drawW, drawH);
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

    video.load();

    setTimeout(() => {
      finish();
    }, 2500);
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
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 960;
  const ctx = canvas.getContext('2d')!;

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

  const speed = variation.microEdit?.speed || 1.0;
  const hookDur = (variation.hookClip?.duration || 4.0) / speed;
  const bodyDur = (variation.bodyClip?.duration || 7.0) / speed;
  const ctaDur = (variation.ctaClip?.duration || 3.5) / speed;
  const totalDur = hookDur + bodyDur + ctaDur;

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
      { hookVideo, bodyVideo, ctaVideo }
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

  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: 6000000,
    audioBitsPerSecond: 320000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    let animId: number;
    let currentActiveSegment = '';
    const startTime = performance.now();

    recorder.onstop = () => {
      cancelAnimationFrame(animId);
      if (audioGraph) {
        audioGraph.stopPlayback();
      }
      [hookVideo, bodyVideo, ctaVideo].forEach((v) => {
        if (v && v.parentNode) v.parentNode.removeChild(v);
      });
      resolve(new Blob(chunks, { type: 'video/mp4' }));
    };

    recorder.onerror = (e) => {
      cancelAnimationFrame(animId);
      if (audioGraph) {
        audioGraph.stopPlayback();
      }
      reject(e);
    };

    recorder.start(100);
    if (audioGraph) {
      audioGraph.startPlayback();
    }

    const renderLoop = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const t = Math.min(elapsed, totalDur);

      if (t < hookDur) {
        if (currentActiveSegment !== 'hook') {
          currentActiveSegment = 'hook';
          if (audioGraph) audioGraph.setActiveSegment('hook');
          if (bodyVideo) bodyVideo.pause();
          if (ctaVideo) ctaVideo.pause();
          if (hookVideo) {
            hookVideo.currentTime = hookTrimStart;
            hookVideo.playbackRate = speed;
            hookVideo.play().catch(() => {});
          }
        }
      } else if (t < hookDur + bodyDur) {
        if (currentActiveSegment !== 'body') {
          currentActiveSegment = 'body';
          if (audioGraph) audioGraph.setActiveSegment('body');
          if (hookVideo) hookVideo.pause();
          if (ctaVideo) ctaVideo.pause();
          if (bodyVideo) {
            bodyVideo.currentTime = bodyTrimStart;
            bodyVideo.playbackRate = speed;
            bodyVideo.play().catch(() => {});
          }
        }
      } else {
        if (currentActiveSegment !== 'cta') {
          currentActiveSegment = 'cta';
          if (audioGraph) audioGraph.setActiveSegment('cta');
          if (hookVideo) hookVideo.pause();
          if (bodyVideo) bodyVideo.pause();
          if (ctaVideo) {
            ctaVideo.currentTime = ctaTrimStart;
            ctaVideo.playbackRate = speed;
            ctaVideo.play().catch(() => {});
          }
        }
      }

      drawCreativeFrame(ctx, variation, t * speed, hookVideo, bodyVideo, ctaVideo, {
        isExporting: true,
      });

      if (onProgress) {
        onProgress(Math.min(100, Math.round((t / totalDur) * 100)));
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
 * Generates a high-impact 9:16 Cover Thumbnail PNG with the exact FIRST FRAME of the Hook video
 * as the background, overlaid with the High-Impact Cover Title + Badge.
 * Note: This is strictly for the separate Cover Image (.png); the MP4 video remains 100% clean.
 */
export async function renderHighImpactCoverToPngBlob(
  variation: CreativeVariation
): Promise<Blob> {
  const width = 540;
  const height = 960;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const hookClip = variation.hookClip;
  const storedData =
    getClipBlobData(hookClip?.id) ||
    getClipBlobData(hookClip?.fileName) ||
    getClipBlobData(hookClip?.title);

  const hookUrl =
    hookClip?.fileUrl ||
    storedData?.url ||
    (storedData?.file ? URL.createObjectURL(storedData.file) : undefined);

  // 1. Try cached first-frame DataURL or extract live from the Hook video's first frame (0.05s)
  let firstFrameDataUrl = getClipFirstFrameDataUrl(hookClip);
  if (!firstFrameDataUrl && hookUrl) {
    const extracted = await extractVideoFirstFrameAndDuration(hookUrl, hookClip?.duration || 4.0);
    if (extracted.thumbnailDataUrl) {
      firstFrameDataUrl = extracted.thumbnailDataUrl;
      if (hookClip) {
        hookClip.thumbnailDataUrl = firstFrameDataUrl;
      }
      if (storedData) {
        storedData.thumbnailDataUrl = firstFrameDataUrl;
      }
    }
  }

  let drewHookFirstFrame = false;

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

  // Fallback: decode directly from video element at 0.05s if needed
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
    if (hookVideo && hookVideo.parentNode) {
      hookVideo.parentNode.removeChild(hookVideo);
    }
  }

  // Only if it's a demo clip with no real video file at all, draw demo background
  if (!drewHookFirstFrame) {
    drawCleanProceduralDemoSegment(ctx, hookClip, 'hook', 0.2, width, height);
  }

  // Light, subtle contrast gradient so the Hook's first frame remains bright and clearly visible
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(0.3, 'rgba(0, 0, 0, 0.08)');
  grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.12)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Top Badge Pill
  const badgeText = (variation.coverBadge || '🚨 ALERTA DE COMPRA').split('·')[0].trim();
  ctx.save();
  ctx.font = '900 18px Inter, system-ui, sans-serif';
  const badgeMetrics = ctx.measureText(badgeText);
  const badgeW = Math.min(width - 60, badgeMetrics.width + 38);
  const badgeH = 40;
  const badgeX = (width - badgeW) / 2;
  const badgeY = 170;

  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, width / 2, badgeY + badgeH / 2 + 1);
  ctx.restore();

  // High-Impact Main Cover Title (Wrapped with semi-transparent glass box so the Hook image shines through)
  const titleText = (
    variation.coverTitle ||
    variation.headline ||
    'NÃO COMPRE ANTES DE VER ESSE TESTE!'
  ).toUpperCase();

  ctx.save();
  ctx.font = '900 35px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = titleText.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  const maxLineWidth = width - 76;

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

  const lineHeight = 46;
  const blockHeight = lines.length * lineHeight + 34;
  const blockY = 225;

  // Semi-transparent backing card so the Hook's first frame stays visible behind & below
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(28, blockY, width - 56, blockHeight, 20);
  ctx.fill();
  ctx.stroke();

  lines.forEach((line, i) => {
    const y = blockY + 23 + i * lineHeight + lineHeight / 2 - 8;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.strokeText(line, width / 2, y);
    ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#ffffff';
    ctx.fillText(line, width / 2, y);
  });
  ctx.restore();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob || new Blob([], { type: 'image/png' }));
    }, 'image/png');
  });
}
