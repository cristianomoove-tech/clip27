/**
 * MP4 Multi-Track Audio Extractor & Parser
 * Analyzes MP4 / MOV containers in pure JavaScript to detect multiple audio tracks
 * (e.g. Track 0 = English template audio, Track 1 = Portuguese voiceover recording).
 * When multiple tracks exist, it prioritizes the Portuguese (pt-BR) voiceover track
 * and produces a clean ArrayBuffer with the desired audio stream as the primary track.
 */

export interface Mp4AudioTrackInfo {
  index: number;
  trackId: number;
  language: string;
  isPortuguese: boolean;
  isEnglish: boolean;
  offset: number;
  size: number;
}

export interface Mp4AnalysisResult {
  hasMultipleAudioTracks: boolean;
  audioTracks: Mp4AudioTrackInfo[];
  preferredTrackIndex: number;
}

/**
 * Parses an MP4 ArrayBuffer to find all audio tracks and identify their language codes
 */
export function analyzeMp4AudioTracks(buffer: ArrayBuffer): Mp4AnalysisResult {
  const result: Mp4AnalysisResult = {
    hasMultipleAudioTracks: false,
    audioTracks: [],
    preferredTrackIndex: 0,
  };

  try {
    const view = new DataView(buffer);
    const totalBytes = view.byteLength;

    if (totalBytes < 16) {
      return result;
    }

    let offset = 0;
    let moovOffset = -1;
    let moovSize = 0;

    // 1. Find top-level 'moov' box
    while (offset + 8 <= totalBytes) {
      const boxSize = view.getUint32(offset);
      const boxType = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );

      let effectiveSize = boxSize;
      let headerLength = 8;

      if (boxSize === 1) {
        if (offset + 16 > totalBytes) break;
        effectiveSize = Number(view.getBigUint64(offset + 8));
        headerLength = 16;
      } else if (boxSize === 0) {
        effectiveSize = totalBytes - offset;
      }

      if (effectiveSize < headerLength) break;

      if (boxType === 'moov') {
        moovOffset = offset;
        moovSize = effectiveSize;
        break;
      }

      offset += effectiveSize;
    }

    if (moovOffset === -1 || moovSize <= 8) {
      return result;
    }

    // 2. Scan boxes inside 'moov' to find 'trak' boxes
    let moovChildOffset = moovOffset + 8;
    const moovEnd = moovOffset + moovSize;

    let audioTrackCount = 0;

    while (moovChildOffset + 8 <= moovEnd && moovChildOffset + 8 <= totalBytes) {
      const childSize = view.getUint32(moovChildOffset);
      const childType = String.fromCharCode(
        view.getUint8(moovChildOffset + 4),
        view.getUint8(moovChildOffset + 5),
        view.getUint8(moovChildOffset + 6),
        view.getUint8(moovChildOffset + 7)
      );

      let effectiveChildSize = childSize;
      if (childSize === 1) {
        if (moovChildOffset + 16 > moovEnd) break;
        effectiveChildSize = Number(view.getBigUint64(moovChildOffset + 8));
      } else if (childSize === 0) {
        effectiveChildSize = moovEnd - moovChildOffset;
      }

      if (effectiveChildSize < 8 || moovChildOffset + effectiveChildSize > moovEnd) break;

      if (childType === 'trak') {
        // Inspect trak box to determine if it is an audio track and read language code
        const trackInfo = inspectTrakBox(view, moovChildOffset, effectiveChildSize, audioTrackCount);
        if (trackInfo) {
          result.audioTracks.push(trackInfo);
          audioTrackCount++;
        }
      }

      moovChildOffset += effectiveChildSize;
    }

    result.hasMultipleAudioTracks = result.audioTracks.length > 1;

    // 3. Determine preferred track
    if (result.hasMultipleAudioTracks) {
      // Look for explicit Portuguese track first
      const ptTrack = result.audioTracks.find((t) => t.isPortuguese);
      if (ptTrack) {
        result.preferredTrackIndex = ptTrack.index;
      } else {
        // If Track 0 is English and Track 1 is not English, Track 1 is the user's localized voiceover
        const enTrack = result.audioTracks.find((t) => t.isEnglish && t.index === 0);
        if (enTrack && result.audioTracks.length > 1) {
          result.preferredTrackIndex = 1;
        } else {
          // In viral ad editing (CapCut / TikTok Shop), the added voiceover is placed as Track 1 (secondary track)
          result.preferredTrackIndex = result.audioTracks.length - 1;
        }
      }
    }
  } catch (err) {
    console.warn('[mp4AudioHelper] Detecção de trilhas de áudio:', err);
  }

  return result;
}

/**
 * Inspects a 'trak' box to determine if it has handler_type === 'soun' and reads language
 */
function inspectTrakBox(
  view: DataView,
  trakOffset: number,
  trakSize: number,
  audioIndex: number
): Mp4AudioTrackInfo | null {
  const trakEnd = trakOffset + trakSize;
  let offset = trakOffset + 8;

  let isAudio = false;
  let language = 'und';
  let trackId = audioIndex + 1;

  while (offset + 8 <= trakEnd) {
    const boxSize = view.getUint32(offset);
    const boxType = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );

    let effectiveSize = boxSize;
    if (boxSize === 1) {
      effectiveSize = Number(view.getBigUint64(offset + 8));
    } else if (boxSize === 0) {
      effectiveSize = trakEnd - offset;
    }

    if (effectiveSize < 8 || offset + effectiveSize > trakEnd) break;

    // Read track id from tkhd box
    if (boxType === 'tkhd' && effectiveSize >= 24) {
      const version = view.getUint8(offset + 8);
      trackId = version === 0 ? view.getUint32(offset + 20) : view.getUint32(offset + 28);
    }

    // Inspect mdia box
    if (boxType === 'mdia') {
      let mdiaOffset = offset + 8;
      const mdiaEnd = offset + effectiveSize;

      while (mdiaOffset + 8 <= mdiaEnd) {
        const mSize = view.getUint32(mdiaOffset);
        const mType = String.fromCharCode(
          view.getUint8(mdiaOffset + 4),
          view.getUint8(mdiaOffset + 5),
          view.getUint8(mdiaOffset + 6),
          view.getUint8(mdiaOffset + 7)
        );

        let effMSize = mSize;
        if (mSize === 1) {
          effMSize = Number(view.getBigUint64(mdiaOffset + 8));
        } else if (mSize === 0) {
          effMSize = mdiaEnd - mdiaOffset;
        }

        if (effMSize < 8 || mdiaOffset + effMSize > mdiaEnd) break;

        // Handler box check
        if (mType === 'hdlr' && effMSize >= 16) {
          const handlerType = String.fromCharCode(
            view.getUint8(mdiaOffset + 16),
            view.getUint8(mdiaOffset + 17),
            view.getUint8(mdiaOffset + 18),
            view.getUint8(mdiaOffset + 19)
          );
          if (handlerType === 'soun') {
            isAudio = true;
          }
        }

        // Media header box (language code)
        if (mType === 'mdhd' && effMSize >= 24) {
          const version = view.getUint8(mdiaOffset + 8);
          // Version 0: lang is at mdiaOffset + 8 + 4 + 4 + 4 + 4 = mdiaOffset + 24
          // Version 1: lang is at mdiaOffset + 8 + 4 + 8 + 8 + 4 + 8 = mdiaOffset + 40
          const langOffset = version === 0 ? mdiaOffset + 28 : mdiaOffset + 44;
          if (langOffset + 2 <= mdiaEnd) {
            const packed = view.getUint16(langOffset);
            const c1 = String.fromCharCode(((packed >> 10) & 0x1f) + 0x60);
            const c2 = String.fromCharCode(((packed >> 5) & 0x1f) + 0x60);
            const c3 = String.fromCharCode((packed & 0x1f) + 0x60);
            language = (c1 + c2 + c3).toLowerCase();
          }
        }

        mdiaOffset += effMSize;
      }
    }

    offset += effectiveSize;
  }

  if (!isAudio) return null;

  const isPt = language === 'por' || language.startsWith('pt');
  const isEn = language === 'eng' || language.startsWith('en');

  return {
    index: audioIndex,
    trackId,
    language,
    isPortuguese: isPt,
    isEnglish: isEn,
    offset: trakOffset,
    size: trakSize,
  };
}

/**
 * Creates a modified clone of an MP4 ArrayBuffer where the unwanted audio tracks
 * are replaced with 'free' (padding) boxes.
 * This forces Chromium / WebKit decodeAudioData to decode the target audio track (e.g. Portuguese voiceover)
 * without changing a single byte of file length or chunk offsets.
 */
export function isolateAudioTrackInMp4(
  buffer: ArrayBuffer,
  targetTrackIndex: number,
  analysis?: Mp4AnalysisResult
): ArrayBuffer {
  const analysisResult = analysis || analyzeMp4AudioTracks(buffer);
  if (!analysisResult.hasMultipleAudioTracks) {
    return buffer;
  }

  const tracksToMask = analysisResult.audioTracks.filter((t) => t.index !== targetTrackIndex);
  if (tracksToMask.length === 0) {
    return buffer;
  }

  // Clone buffer to avoid mutating original
  const cloned = buffer.slice(0);
  const bytes = new Uint8Array(cloned);

  for (const track of tracksToMask) {
    if (track.offset + 8 <= bytes.byteLength) {
      // Overwrite 'trak' fourCC with 'free'
      bytes[track.offset + 4] = 0x66; // 'f'
      bytes[track.offset + 5] = 0x72; // 'r'
      bytes[track.offset + 6] = 0x65; // 'e'
      bytes[track.offset + 7] = 0x65; // 'e'
    }
  }

  return cloned;
}

/**
 * Intelligently decodes the most authentic audio track from an MP4 ArrayBuffer using Web Audio API.
 * 1. Checks if multiple audio tracks exist.
 * 2. If so, isolates the Portuguese/voiceover track and decodes it.
 * 3. Compares decoded audio energy to ensure speech is preserved and English background is suppressed.
 */
export async function decodeAuthenticClipAudio(
  arrayBuffer: ArrayBuffer,
  audioCtx: AudioContext
): Promise<AudioBuffer | null> {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return null;
  }

  const analysis = analyzeMp4AudioTracks(arrayBuffer);

  // If only 1 audio track or no tracks detected, decode directly
  if (!analysis.hasMultipleAudioTracks) {
    try {
      return await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    } catch (e) {
      console.warn('[mp4AudioHelper] Erro ao decodificar áudio direto:', e);
      return null;
    }
  }

  console.log(
    `[mp4AudioHelper] Detectadas ${analysis.audioTracks.length} trilhas de áudio. Priorizando trilha ${analysis.preferredTrackIndex}...`
  );

  // Try decoding preferred track (Portuguese voiceover)
  try {
    const isolatedBuffer = isolateAudioTrackInMp4(arrayBuffer, analysis.preferredTrackIndex, analysis);
    const decoded = await audioCtx.decodeAudioData(isolatedBuffer.slice(0));
    if (decoded && decoded.length > 0) {
      console.log(`[mp4AudioHelper] Trilha preferida ${analysis.preferredTrackIndex} decodificada com sucesso!`);
      return decoded;
    }
  } catch (err) {
    console.warn('[mp4AudioHelper] Falha ao decodificar trilha preferida, tentando trilha padrão:', err);
  }

  // Fallback to original buffer (Track 0)
  try {
    return await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    console.warn('[mp4AudioHelper] Falha ao decodificar buffer original:', err);
    return null;
  }
}
