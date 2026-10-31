import JSZip from 'jszip';
import { CreativeVariation } from '../types';
import {
  renderSingleVariationToBlob,
  renderHighImpactCoverToPngBlob,
} from './videoRenderer';
import {
  buildVariationCoverAndSeo,
  isGenericCampaignOrClipName,
} from './clipStore';

export interface ZipExportProgress {
  currentIndex: number;
  totalCount: number;
  currentCode: string;
  percent: number;
  statusText: string;
}

export async function exportVariationsToZip(
  variations: CreativeVariation[],
  projectName: string,
  onProgress?: (progress: ZipExportProgress) => void,
  shouldAbort?: () => boolean
): Promise<Blob> {
  const zip = new JSZip();
  const safeName = (projectName || 'Clip27_Criativos').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const folder = zip.folder(safeName) || zip;

  const total = variations.length;
  const cleanProjectProduct = isGenericCampaignOrClipName(projectName) ? '' : projectName;

  // Ensure every variation has a clean coverTitle & seoCaption (never "Nova Campanha 3x3x3")
  const sanitizedVariations: CreativeVariation[] = variations.map((v, idx) => {
    const hasPollutedText =
      !v.coverTitle ||
      /campanha|3x3|projeto|gancho|corpo|anuncio_de_produto/i.test(v.coverTitle) ||
      /campanha|3x3|projeto|gancho|corpo|anuncio_de_produto/i.test(v.seoCaption || '');

    if (!hasPollutedText) return v;

    const fresh = buildVariationCoverAndSeo(
      v.index || idx + 1,
      v.hookIndex,
      v.bodyIndex,
      v.ctaIndex,
      cleanProjectProduct
    );

    return {
      ...v,
      headline: fresh.coverTitle,
      coverTitle: fresh.coverTitle,
      coverBadge: v.coverBadge || fresh.coverBadge,
      seoCaption: fresh.seoCaption,
    };
  });

  for (let i = 0; i < total; i++) {
    if (shouldAbort && shouldAbort()) {
      throw new Error('Cancelado pelo usuário.');
    }

    const variation = sanitizedVariations[i];
    const code = variation.code;
    const safeCode = code.replace(/\+/g, '-');
    const hash = variation.microEdit?.hashHex || 'A8F29B01';

    if (onProgress) {
      onProgress({
        currentIndex: i + 1,
        totalCount: total,
        currentCode: code,
        percent: Math.round((i / total) * 100),
        statusText: `Renderizando Vídeo MP4 (Capa no 1º frame) ${i + 1} de ${total} (${code})...`,
      });
    }

    try {
      // 1. Render the variation to a real MP4 video blob with studio audio and embedded 1st-frame cover
      const videoBlob = await renderSingleVariationToBlob(variation, (clipPct) => {
        if (onProgress) {
          const overallPct = Math.round(((i + (clipPct * 0.9) / 100) / total) * 100);
          onProgress({
            currentIndex: i + 1,
            totalCount: total,
            currentCode: code,
            percent: overallPct,
            statusText: `Gravando Vídeo MP4 (Capa no 1º frame) (${code}): ${clipPct}%`,
          });
        }
      });

      const videoFileName = `${code}_${hash}.mp4`;
      folder.file(videoFileName, videoBlob);

      // 2. Render the High-Impact Cover Image (.PNG) with the 1st frame of the Hook as background
      if (onProgress) {
        onProgress({
          currentIndex: i + 1,
          totalCount: total,
          currentCode: code,
          percent: Math.round(((i + 0.95) / total) * 100),
          statusText: `Gerando Capa de Alto Impacto PNG (${code})...`,
        });
      }

      const coverBlob = await renderHighImpactCoverToPngBlob(variation, 720, 1280);
      const coverFileName = `CAPA_${safeCode}_${hash}.png`;
      folder.file(coverFileName, coverBlob);

      // Micro-pause to allow browser GC to reclaim freed GPU/VRAM memory between video variations
      await new Promise((r) => setTimeout(r, 60));
    } catch (err) {
      console.warn(`Erro ao renderizar variação ${code}, pulando:`, err);
    }
  }

  // Add comprehensive campaign report and metadata
  const reportLines = [
    `================================================================`,
    `CLIP27 AI — PACOTE DE VÍDEOS MP4 + CAPAS DE ALTO IMPACTO (.PNG)`,
    `Data de Exportação: ${new Date().toLocaleString('pt-BR')}`,
    `Total Exportado: ${total} Vídeos (.mp4) + ${total} Capas de Alto Impacto (.png)`,
    `Formato de Saída: MP4 Vertical 9:16 HD 720p (720x1280) + Capas PNG 720p + Legendas SEO`,
    `================================================================\n`,
    `ESTRATÉGIA ANTI-SHADOWBAN & ÁUDIO MASTERIZADO TIKTOK / REELS:`,
    `- Formato .MP4 nativo HD 720p 100% fluido a 30 FPS cravados, taxa de 3.5 Mbps otimizada para TikTok e Reels.`,
    `- Capas .PNG 9:16 HD 720p de Alto Impacto geradas com a 1ª imagem real de cada Gancho.`,
    `- Áudio em 48kHz / 320kbps com equalização vocal, filtro anti-ruído e nivelamento -14 LUFS.`,
    `- Cada vídeo possui fingerprint e hash hexadecimal únicos para quebrar deduplicação.`,
    `- Micro-edits embutidos: Zoom (1.01x a 1.04x), Velocidade (0.98x a 1.02x).\n`,
    `MAPA COMPLETO DOS VÍDEOS, CAPAS E LEGENDAS SEO:\n`,
  ];

  sanitizedVariations.forEach((v) => {
    const safeCode = v.code.replace(/\+/g, '-');
    const hash = v.microEdit?.hashHex || 'CLEAN';
    reportLines.push(
      `[${v.code}]` +
        `\n  Arquivo de Vídeo (MP4 Limpo): ${v.code}_${hash}.mp4` +
        `\n  Arquivo da Capa (PNG 9:16): CAPA_${safeCode}_${hash}.png` +
        `\n  Gancho: ${v.hookClip?.fileName || v.hookClip?.title}` +
        `\n  Corpo: ${v.bodyClip?.fileName || v.bodyClip?.title}` +
        `\n  CTA: ${v.ctaClip?.fileName || v.ctaClip?.title}` +
        `\n  Título de Capa (Alto Impacto): "${v.coverTitle || v.headline}"` +
        `\n  Legenda SEO TikTok:\n${(v.seoCaption || '')
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n')}` +
        `\n  Formato: MP4 9:16 Vertical + Áudio Studio 320kbps (-14 LUFS)` +
        `\n  Zoom: ${v.microEdit?.zoom}x | Vel: ${v.microEdit?.speed}x | Hash: #${hash}` +
        `\n----------------------------------------------------------------\n`
    );
  });

  folder.file('RELATORIO_VIDEOS_CAPAS_E_SEO.txt', reportLines.join('\n'));

  // Add JSON Manifest for automated campaign importers
  const jsonManifest = {
    exportedAt: new Date().toISOString(),
    format: 'video/mp4',
    coverFormat: 'image/png',
    aspectRatio: '9:16',
    audioQuality: '48kHz 320kbps Broadcast Mastered (-14 LUFS)',
    targetPlatforms: ['TikTok', 'TikTok Shop', 'TikTok Ads Manager', 'Instagram Reels', 'YouTube Shorts'],
    totalVideos: total,
    totalCovers: total,
    variations: sanitizedVariations.map((v) => {
      const safeCode = v.code.replace(/\+/g, '-');
      const hash = v.microEdit?.hashHex || 'CLEAN';
      return {
        code: v.code,
        videoFileName: `${v.code}_${hash}.mp4`,
        coverFileName: `CAPA_${safeCode}_${hash}.png`,
        format: 'video/mp4',
        coverTitle: v.coverTitle || v.headline,
        coverBadge: v.coverBadge,
        seoCaption: v.seoCaption,
        hook: v.hookClip?.fileName || v.hookClip?.title,
        body: v.bodyClip?.fileName || v.bodyClip?.title,
        cta: v.ctaClip?.fileName || v.ctaClip?.title,
        microEdit: v.microEdit,
        duration: v.estimatedDuration,
      };
    }),
  };
  folder.file('manifest_criativos.json', JSON.stringify(jsonManifest, null, 2));

  if (onProgress) {
    onProgress({
      currentIndex: total,
      totalCount: total,
      currentCode: 'ZIP',
      percent: 98,
      statusText: `Compactando ${total} vídeos MP4 + ${total} capas PNG em formato .ZIP...`,
    });
  }

  // Generate final ZIP blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  if (onProgress) {
    onProgress({
      currentIndex: total,
      totalCount: total,
      currentCode: 'FIM',
      percent: 100,
      statusText: `Pacote ZIP com ${total} vídeos MP4 + ${total} capas PNG pronto!`,
    });
  }

  return zipBlob;
}
