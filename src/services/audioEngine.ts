import { VideoClip, CreativeVariation } from '../types';
import { getClipBlobData, getClipBlobUrl, isDemoClip } from './clipStore';

// Cache for decoded audio buffers to prevent re-decoding the same clip repeatedly
const audioBufferCache = new Map<string, AudioBuffer>();

/**
 * Extracts and decodes the audio track from a video clip file into an AudioBuffer using the Web Audio API.
 * This directly accesses the PCM audio samples of the MP4 / WebM / MOV file without DOM video element limitations.
 */
export async function decodeClipAudio(
  clip: VideoClip,
  audioCtx: AudioContext
): Promise<AudioBuffer | null> {
  if (!clip) return null;

  const clipId = clip.id || clip.fileName || 'unknown';
  const cached = audioBufferCache.get(clipId);
  if (cached) {
    return cached;
  }

  // If it's a procedural demo clip with no user file, return null
  if (isDemoClip(clip) && !clip.fileUrl && !getClipBlobUrl(clip.id) && !getClipBlobUrl(clip.fileName)) {
    return null;
  }

  try {
    let arrayBuffer: ArrayBuffer | null = null;

    // 1. Try to get original File object from memory store
    const blobData = getClipBlobData(clip.id) || getClipBlobData(clip.fileName);
    if (blobData?.file) {
      arrayBuffer = await blobData.file.arrayBuffer();
    } else {
      // 2. Fallback to fetching blob URL
      const url = clip.fileUrl || getClipBlobUrl(clip.id) || getClipBlobUrl(clip.fileName);
      if (url) {
        const response = await fetch(url);
        arrayBuffer = await response.arrayBuffer();
      }
    }

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return null;
    }

    // Clone the buffer slice because decodeAudioData detaches the underlying ArrayBuffer
    const bufferCopy = arrayBuffer.slice(0);
    const decodedBuffer = await audioCtx.decodeAudioData(bufferCopy);

    if (decodedBuffer) {
      audioBufferCache.set(clipId, decodedBuffer);
      if (clip.fileName) {
        audioBufferCache.set(clip.fileName, decodedBuffer);
      }
      return decodedBuffer;
    }
  } catch (err) {
    console.warn(`Aviso: Clipes ${clip.fileName || clip.id} sem trilha de áudio decodificável:`, err);
  }

  return null;
}

export interface AudioPlaybackHandle {
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

/**
 * Connects and schedules the original audio of Hook, Body, and CTA clips onto the Web Audio graph.
 * Ensures sample-accurate concatenation with proper speed matching.
 */
export async function scheduleVariationAudio(
  audioCtx: AudioContext,
  variation: CreativeVariation,
  destinationNode: AudioNode,
  startTimeOffset = 0 // Offset in seconds if seeking or starting mid-way
): Promise<AudioPlaybackHandle> {
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume().catch(() => {});
  }

  const hookDur = variation.hookClip?.duration || 4.0;
  const bodyDur = variation.bodyClip?.duration || 7.0;
  const ctaDur = variation.ctaClip?.duration || 3.5;
  const speed = variation.microEdit?.speed || 1.0;

  // Pre-decode the 3 clips in parallel
  const [hookBuffer, bodyBuffer, ctaBuffer] = await Promise.all([
    variation.hookClip ? decodeClipAudio(variation.hookClip, audioCtx) : Promise.resolve(null),
    variation.bodyClip ? decodeClipAudio(variation.bodyClip, audioCtx) : Promise.resolve(null),
    variation.ctaClip ? decodeClipAudio(variation.ctaClip, audioCtx) : Promise.resolve(null),
  ]);

  const activeSources: AudioBufferSourceNode[] = [];
  const baseTime = audioCtx.currentTime;

  // Segment 1: Hook (Gancho)
  const hookStartOnTimeline = 0;
  const hookEndOnTimeline = hookDur / speed;

  if (hookBuffer && startTimeOffset < hookEndOnTimeline) {
    const hookSource = audioCtx.createBufferSource();
    hookSource.buffer = hookBuffer;
    hookSource.playbackRate.value = speed;
    hookSource.connect(destinationNode);

    const delay = Math.max(0, hookStartOnTimeline - startTimeOffset);
    const bufferOffset = Math.max(0, (startTimeOffset - hookStartOnTimeline) * speed);
    const playDuration = Math.max(0, (hookEndOnTimeline - Math.max(startTimeOffset, hookStartOnTimeline)));

    hookSource.start(baseTime + delay, bufferOffset, playDuration);
    activeSources.push(hookSource);
  }

  // Segment 2: Body (Corpo)
  const bodyStartOnTimeline = hookEndOnTimeline;
  const bodyEndOnTimeline = bodyStartOnTimeline + (bodyDur / speed);

  if (bodyBuffer && startTimeOffset < bodyEndOnTimeline) {
    const bodySource = audioCtx.createBufferSource();
    bodySource.buffer = bodyBuffer;
    bodySource.playbackRate.value = speed;
    bodySource.connect(destinationNode);

    const delay = Math.max(0, bodyStartOnTimeline - startTimeOffset);
    const bufferOffset = Math.max(0, (startTimeOffset - bodyStartOnTimeline) * speed);
    const playDuration = Math.max(0, (bodyEndOnTimeline - Math.max(startTimeOffset, bodyStartOnTimeline)));

    bodySource.start(baseTime + delay, bufferOffset, playDuration);
    activeSources.push(bodySource);
  }

  // Segment 3: CTA Final
  const ctaStartOnTimeline = bodyEndOnTimeline;
  const ctaEndOnTimeline = ctaStartOnTimeline + (ctaDur / speed);

  if (ctaBuffer && startTimeOffset < ctaEndOnTimeline) {
    const ctaSource = audioCtx.createBufferSource();
    ctaSource.buffer = ctaBuffer;
    ctaSource.playbackRate.value = speed;
    ctaSource.connect(destinationNode);

    const delay = Math.max(0, ctaStartOnTimeline - startTimeOffset);
    const bufferOffset = Math.max(0, (startTimeOffset - ctaStartOnTimeline) * speed);
    const playDuration = Math.max(0, (ctaEndOnTimeline - Math.max(startTimeOffset, ctaStartOnTimeline)));

    ctaSource.start(baseTime + delay, bufferOffset, playDuration);
    activeSources.push(ctaSource);
  }

  return {
    stop: () => {
      activeSources.forEach((src) => {
        try {
          src.stop();
          src.disconnect();
        } catch {}
      });
      activeSources.length = 0;
    },
    pause: () => {
      activeSources.forEach((src) => {
        try {
          src.stop();
          src.disconnect();
        } catch {}
      });
      activeSources.length = 0;
    },
    resume: () => {},
  };
}
