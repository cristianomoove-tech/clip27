import { VideoClip, CreativeVariation, Project, SubtitleStyle } from '../types';
import { generateMicroEdit } from './demoClips';
import { clearAudioBufferCache } from './audioManager';

interface StoredClipData {
  id: string;
  url: string;
  file?: File;
  duration: number;
  fileName: string;
  thumbnailDataUrl?: string;
}

// In-memory store for blob URLs, files, and first-frame thumbnails across sessions
const inMemoryClipStore = new Map<string, StoredClipData>();
const inMemoryByName = new Map<string, StoredClipData>();

export function registerClipBlob(
  clipId: string,
  file: File,
  url: string,
  duration: number,
  thumbnailDataUrl?: string
) {
  clearAudioBufferCache();

  const data: StoredClipData = {
    id: clipId,
    url,
    file,
    duration,
    fileName: file.name,
    thumbnailDataUrl,
  };
  inMemoryClipStore.set(clipId, data);
  inMemoryByName.set(file.name, data);
  inMemoryByName.set(file.name.toLowerCase(), data);

  if (file.name.includes('.')) {
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
    inMemoryByName.set(nameWithoutExt, data);
    inMemoryByName.set(nameWithoutExt.toLowerCase(), data);
  }

  if (thumbnailDataUrl) {
    try {
      localStorage.setItem(`clip27_thumb_${clipId}`, thumbnailDataUrl);
      localStorage.setItem(`clip27_thumb_${file.name.toLowerCase()}`, thumbnailDataUrl);
    } catch {
      // Ignore storage quota warnings
    }
  }
}

export function getClipBlobData(clipIdOrName?: string): StoredClipData | undefined {
  if (!clipIdOrName) return undefined;
  return (
    inMemoryClipStore.get(clipIdOrName) ||
    inMemoryByName.get(clipIdOrName) ||
    inMemoryByName.get(clipIdOrName.toLowerCase())
  );
}

export function getClipBlobUrl(clipIdOrName?: string): string | undefined {
  if (!clipIdOrName) return undefined;
  const stored =
    inMemoryClipStore.get(clipIdOrName) ||
    inMemoryByName.get(clipIdOrName) ||
    inMemoryByName.get(clipIdOrName.toLowerCase());
  if (!stored) return undefined;
  return stored.url;
}

export function getClipFirstFrameDataUrl(clip?: VideoClip | null): string | undefined {
  if (!clip) return undefined;
  if (clip.thumbnailDataUrl) return clip.thumbnailDataUrl;

  const byId = inMemoryClipStore.get(clip.id)?.thumbnailDataUrl;
  if (byId) return byId;

  if (clip.fileName) {
    const byName =
      inMemoryByName.get(clip.fileName)?.thumbnailDataUrl ||
      inMemoryByName.get(clip.fileName.toLowerCase())?.thumbnailDataUrl;
    if (byName) return byName;
  }

  try {
    const lsById = localStorage.getItem(`clip27_thumb_${clip.id}`);
    if (lsById) return lsById;
    if (clip.fileName) {
      const lsByName = localStorage.getItem(`clip27_thumb_${clip.fileName.toLowerCase()}`);
      if (lsByName) return lsByName;
    }
  } catch {}

  return undefined;
}

export function isDemoClip(clip?: VideoClip | null): boolean {
  if (!clip) return false;
  if (clip.demoData) return true;
  const isDemoId =
    clip.id === 'hook-1' ||
    clip.id === 'hook-2' ||
    clip.id === 'hook-3' ||
    clip.id === 'body-1' ||
    clip.id === 'body-2' ||
    clip.id === 'body-3' ||
    clip.id === 'cta-1' ||
    clip.id === 'cta-2' ||
    clip.id === 'cta-3';
  if (isDemoId) return true;

  const hasBlob = Boolean(
    clip.fileUrl ||
      clip.thumbnailDataUrl ||
      getClipBlobUrl(clip.id) ||
      getClipBlobUrl(clip.fileName) ||
      getClipFirstFrameDataUrl(clip)
  );
  return !hasBlob;
}

/**
 * Extracts both the real duration AND the exact first frame image (as a 9:16 DataURL)
 * from a video URL so the Hook's first frame is always available for covers.
 */
export function extractVideoFirstFrameAndDuration(
  url: string,
  defaultDur: number = 4.0
): Promise<{ duration: number; thumbnailDataUrl?: string }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '270px';
    video.style.height = '480px';
    video.style.opacity = '0.001';
    video.style.pointerEvents = 'none';
    document.body.appendChild(video);

    let resolved = false;
    let detectedDur = defaultDur;

    const finish = (thumbnailDataUrl?: string) => {
      if (resolved) return;
      resolved = true;
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      try {
        video.pause();
        if (video.parentNode) video.parentNode.removeChild(video);
      } catch {}
      resolve({ duration: detectedDur, thumbnailDataUrl });
    };

    const captureFrame = (): string | undefined => {
      try {
        const vWidth = video.videoWidth;
        const vHeight = video.videoHeight;
        if (!vWidth || !vHeight) return undefined;

        const width = 540;
        const height = 960;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return undefined;

        const scale = Math.max(width / vWidth, height / vHeight);
        const drawW = vWidth * scale;
        const drawH = vHeight * scale;
        const drawX = (width - drawW) / 2;
        const drawY = (height - drawH) / 2;

        ctx.drawImage(video, drawX, drawY, drawW, drawH);
        return canvas.toDataURL('image/jpeg', 0.88);
      } catch {
        return undefined;
      }
    };

    video.onloadedmetadata = () => {
      const dur = Number(video.duration.toFixed(1));
      if (!isNaN(dur) && dur > 0) {
        detectedDur = dur;
      }
    };

    video.onloadeddata = () => {
      const dur = Number(video.duration.toFixed(1));
      if (!isNaN(dur) && dur > 0) {
        detectedDur = dur;
      }
      try {
        // Seek slightly into the very first frame (0.05s) to avoid black 0.00s leader frames
        video.currentTime = Math.min(0.05, (detectedDur || 1) * 0.1);
      } catch {
        const thumb = captureFrame();
        finish(thumb);
      }
    };

    video.onseeked = () => {
      // Wait 1 animation frame to ensure GPU texture buffer has painted the decoded frame
      requestAnimationFrame(() => {
        const thumb = captureFrame();
        finish(thumb);
      });
    };

    video.onerror = () => {
      finish(undefined);
    };

    video.load();

    setTimeout(() => {
      if (!resolved) {
        const thumb = captureFrame();
        finish(thumb);
      }
    }, 3000);
  });
}

// Inspect actual video duration from a blob URL
export async function getVideoDuration(url: string, defaultDur: number = 4.0): Promise<number> {
  const res = await extractVideoFirstFrameAndDuration(url, defaultDur);
  return res.duration;
}

// Hydrate clips with live in-memory blob URLs and first-frame thumbnails if lost during serialization
export function hydrateClipsWithBlobs(clips: VideoClip[]): VideoClip[] {
  return (clips || []).map((clip) => {
    const stored =
      inMemoryClipStore.get(clip.id) ||
      (clip.fileName ? inMemoryByName.get(clip.fileName) : undefined) ||
      (clip.fileName ? inMemoryByName.get(clip.fileName.toLowerCase()) : undefined) ||
      inMemoryByName.get(clip.title);

    const thumb = getClipFirstFrameDataUrl(clip) || stored?.thumbnailDataUrl;

    if (stored) {
      return {
        ...clip,
        fileUrl: clip.fileUrl || stored.url,
        fileName: clip.fileName || stored.fileName,
        duration: clip.duration || stored.duration,
        thumbnailDataUrl: clip.thumbnailDataUrl || thumb,
      };
    }
    if (thumb && !clip.thumbnailDataUrl) {
      return {
        ...clip,
        thumbnailDataUrl: thumb,
      };
    }
    return clip;
  });
}

interface HighImpactAngle {
  badge: string;
  titleTemplate: (prod: string) => string;
  seoHookTemplate: (prod: string) => string;
  seoBodyTemplate: (prod: string) => string;
  seoCtaTemplate: (prod: string) => string;
}

const HIGH_IMPACT_27_ANGLES: HighImpactAngle[] = [
  {
    badge: '🚨 ALERTA DE COMPRA',
    titleTemplate: (p) => `NÃO COMPRE ${p.toUpperCase()} ANTES DE VER ESSE VÍDEO!`,
    seoHookTemplate: (p) => `🚨 Não compre ${p} antes de ver esse teste real completo!`,
    seoBodyTemplate: (p) => `Muita gente está falando desse ${p} aqui no Brasil, mas será que entrega tudo o que promete no dia a dia? Mostrei cada detalhe sem filtro para você decidir com segurança.`,
    seoCtaTemplate: () => `🛒 Toque no carrinho laranja aqui embaixo para ver o preço promocional com frete rápido no Brasil!`,
  },
  {
    badge: '😱 CHOQUE REAL',
    titleTemplate: (p) => `ISSO DEVERIA SER PROIBIDO DE TÃO BOM E BARATO!`,
    seoHookTemplate: (p) => `😱 Esse ${p} deveria ser proibido de tão prático e barato!`,
    seoBodyTemplate: (p) => `Eu achava que era só mais um vídeo viral do TikTok, até testar esse ${p} em casa. O resultado em poucos segundos explica por que está esgotando tão rápido.`,
    seoCtaTemplate: () => `⚡ Garanta o seu no link do carrinho antes que acabe o lote com desconto!`,
  },
  {
    badge: '🔥 TESTE DE 7 DIAS',
    titleTemplate: (p) => `TESTEI POR 7 DIAS: VALE CADA CENTAVO MESMO?`,
    seoHookTemplate: (p) => `🔥 Testei o famoso ${p} por 7 dias seguidos: vale a pena mesmo?`,
    seoBodyTemplate: (p) => `Aqui está o meu veredito sincero depois de uma semana inteira usando o ${p}. A diferença na prática é absurda e economiza muito tempo!`,
    seoCtaTemplate: () => `👇 Clique no produto marcado no vídeo para conferir a oferta oficial de hoje!`,
  },
  {
    badge: '🤫 SEGREDO REVELADO',
    titleTemplate: (p) => `COMO NINGUÉM ME CONTOU DESSE TRUQUE ANTES?!`,
    seoHookTemplate: (p) => `🤫 Como ninguém me contou sobre esse ${p} antes?! Mudou minha rotina!`,
    seoBodyTemplate: (p) => `Sabe aquele problema chato do dia a dia? Esse ${p} resolve em segundos sem esforço nenhum. É o típico achadinho que todo brasileiro precisa ter em casa.`,
    seoCtaTemplate: () => `🛒 Aproveite o cupom ativo clicando direto no carrinho laranja!`,
  },
  {
    badge: '⚡ ANTES X DEPOIS',
    titleTemplate: (p) => `OLHA A DIFERENÇA ABSURDA EM APENAS 10 SEGUNDOS!`,
    seoHookTemplate: (p) => `⚡ Olha o Antes x Depois desse ${p} funcionando ao vivo em 10 segundos!`,
    seoBodyTemplate: (p) => `Sem edição e sem corte: veja na prática a potência e o acabamento do ${p}. Quando o produto é bom de verdade, o resultado aparece na hora!`,
    seoCtaTemplate: () => `🔥 Clique no botão de compra aqui na tela e peça o seu ainda hoje!`,
  },
  {
    badge: '💸 ECONOMIA INTELIGENTE',
    titleTemplate: (p) => `PARE DE GASTAR CARO! ISSO FAZ O MESMO POR 1/3 DO PREÇO`,
    seoHookTemplate: (p) => `💸 Pare de pagar caro! Esse ${p} entrega qualidade premium custando muito menos.`,
    seoBodyTemplate: (p) => `Comparei o ${p} com opções que custam o triplo do valor no mercado brasileiro e fiquei impressionado com o custo-benefício.`,
    seoCtaTemplate: () => `🛒 Confira o valor atualizado no carrinho laranja abaixo e economize agora!`,
  },
  {
    badge: '🏆 MAIS VENDIDO BR',
    titleTemplate: (p) => `POR QUE ESSE É O Nº 1 MAIS VENDIDO DO TIKTOK BRASIL?`,
    seoHookTemplate: (p) => `🏆 Descobri por que esse ${p} é o campeão de vendas no TikTok Shop Brasil!`,
    seoBodyTemplate: (p) => `Mais de milhares de brasileiros já compraram e aprovaram esse ${p}. Fiz o teste definitivo para mostrar cada função de perto.`,
    seoCtaTemplate: () => `👇 Garanta o original clicando no link do produto aqui embaixo!`,
  },
  {
    badge: '⚠️ CUIDADO COM IMITAÇÃO',
    titleTemplate: (p) => `O ORIGINAL VS FALSIFICADO: VEJA O QUE ACONTECE!`,
    seoHookTemplate: (p) => `⚠️ Cuidado ao comprar ${p}: veja como identificar o modelo original que realmente funciona!`,
    seoBodyTemplate: (p) => `Mostrei todos os detalhes da construção, material e potência do ${p} original para você não jogar dinheiro fora com imitação fraca.`,
    seoCtaTemplate: () => `✅ Deixei o link 100% seguro e verificado aqui no carrinho laranja do vídeo!`,
  },
  {
    badge: '🤯 O TIKTOK ME FEZ COMPRAR',
    titleTemplate: (p) => `O TIKTOK ME FEZ COMPRAR E EU ESTOU CHOCADO!`,
    seoHookTemplate: (p) => `🤯 O TikTok me fez comprar esse ${p} e foi a melhor escolha do mês!`,
    seoBodyTemplate: (p) => `Confesso que comprei por curiosidade de tanto ver na For You, mas esse ${p} superou todas as minhas expectativas logo no primeiro uso.`,
    seoCtaTemplate: () => `🛒 Quer testar também? Toque no carrinho laranja antes que o estoque acabe!`,
  },
  {
    badge: '💥 FIM DO SOFRIMENTO',
    titleTemplate: (p) => `ADEUS DOR DE CABEÇA! RESOLVIDO EM 1 MINUTO`,
    seoHookTemplate: (p) => `💥 Diga adeus à dor de cabeça com esse ${p} super prático!`,
    seoBodyTemplate: (p) => `Se você também perdia horas tentando resolver isso do jeito antigo, veja como o ${p} simplifica tudo em menos de 1 minuto.`,
    seoCtaTemplate: () => `⚡ Clique no carrinho aqui embaixo para garantir o seu com envio imediato!`,
  },
  {
    badge: '📦 UNBOXING SINCERO',
    titleTemplate: (p) => `ABRINDO O PACOTE MAIS VIRAL DA INTERNET HOJE!`,
    seoHookTemplate: (p) => `📦 Unboxing e teste imediato do ${p} mais viral da internet!`,
    seoBodyTemplate: (p) => `Acabou de chegar aqui em casa! Abri a caixa e já coloquei o ${p} à prova na frente da câmera para você ver exatamente o que vem incluso.`,
    seoCtaTemplate: () => `🛒 Gostou? Clique no carrinho laranja e peça o seu com desconto exclusivo!`,
  },
  {
    badge: '💎 ACHADINHO DE OURO',
    titleTemplate: (p) => `O ACHADINHO DE MENOS DE R$ 100 QUE TODO MUNDO QUER!`,
    seoHookTemplate: (p) => `💎 Achadinho de ouro: o ${p} que está transformando a rotina de todo mundo!`,
    seoBodyTemplate: (p) => `Prático, resistente e com acabamento impecável. Não é à toa que esse ${p} virou febre nas casas brasileiras em 2025!`,
    seoCtaTemplate: () => `👇 Toque no botão do produto aqui no vídeo para aproveitar a promoção!`,
  },
  {
    badge: '🔬 PROVA AO VIVO',
    titleTemplate: (p) => `SÓ ACREDITO PORQUE TESTEI COM MEUS PRÓPRIOS OLHOS!`,
    seoHookTemplate: (p) => `🔬 Duvidei até testar: veja o ${p} funcionando ao vivo sem cortes!`,
    seoBodyTemplate: (p) => `Fiz questão de gravar em close todos os detalhes do ${p} em ação para provar que realmente cumpre o que promete na propaganda.`,
    seoCtaTemplate: () => `🛒 Garanta o seu agora clicando no carrinho laranja aqui embaixo!`,
  },
  {
    badge: '🚀 VIRAL DA SEMANA',
    titleTemplate: (p) => `TODO MUNDO ESTÁ COMPRANDO ISSO ESSA SEMANA!`,
    seoHookTemplate: (p) => `🚀 Por que todo mundo está comprando esse ${p} essa semana no Brasil?`,
    seoBodyTemplate: (p) => `A resposta é simples: entrega resultado profissional em casa sem complicação. Veja no vídeo como é fácil usar o ${p}!`,
    seoCtaTemplate: () => `🔥 Corra no carrinho laranja antes que o preço volte ao normal!`,
  },
  {
    badge: '🎯 NOTA 10/10',
    titleTemplate: (p) => `DEI NOTA 10/10! O MELHOR INVESTIMENTO DO ANO`,
    seoHookTemplate: (p) => `🎯 Nota 10/10! Esse ${p} foi de longe a minha compra mais útil do ano.`,
    seoBodyTemplate: (p) => `Sabe quando você compra algo e usa todos os dias? Esse ${p} vale cada centavo pela praticidade e durabilidade.`,
    seoCtaTemplate: () => `🛒 Clique no link do produto aqui na tela para garantir o seu com desconto!`,
  },
  {
    badge: '⏳ ÚLTIMAS UNIDADES',
    titleTemplate: (p) => `ESGOTANDO RÁPIDO! GARANTA ANTES QUE SAIA DO AR`,
    seoHookTemplate: (p) => `⏳ Alerta de reposição: o ${p} voltou para o estoque com preço de fábrica!`,
    seoBodyTemplate: (p) => `Na última semana esgotou em poucas horas. Se você estava esperando o ${p} voltar na promoção, essa é a sua chance.`,
    seoCtaTemplate: () => `⚡ Toque agora no carrinho laranja e feche seu pedido antes que acabe!`,
  },
  {
    badge: '🧠 GENIAL E PRÁTICO',
    titleTemplate: (p) => `QUEM INVENTOU ISSO MERECE UM PRÊMIO! QUE GENIAL`,
    seoHookTemplate: (p) => `🧠 Quem inventou esse ${p} merece um prêmio de tão genial!`,
    seoBodyTemplate: (p) => `Design inteligente pensado para resolver o problema na raiz. Olha a facilidade de manusear esse ${p} no dia a dia.`,
    seoCtaTemplate: () => `🛒 Peça o seu clicando no carrinho laranja aqui embaixo do vídeo!`,
  },
  {
    badge: '⚡ RESULTADO IMEDIATO',
    titleTemplate: (p) => `NÃO PISCQUE! VEJA O QUE ACONTECE EM 5 SEGUNDOS`,
    seoHookTemplate: (p) => `⚡ Não pisque! Veja o que esse ${p} faz em apenas 5 segundos!`,
    seoBodyTemplate: (p) => `Velocidade e eficiência absurdas. Esse ${p} entrega exatamente o resultado que você precisa sem enrolação.`,
    seoCtaTemplate: () => `👇 Clique no produto marcado na tela e aproveite o frete especial!`,
  },
  {
    badge: '🏠 INDISPENSÁVEL EM CASA',
    titleTemplate: (p) => `SE VOCÊ AINDA NÃO TEM ISSO EM CASA, ESTÁ PERDENDO TEMPO!`,
    seoHookTemplate: (p) => `🏠 Item obrigatório em casa: veja como o ${p} facilita tudo!`,
    seoBodyTemplate: (p) => `Depois que comecei a usar esse ${p}, nunca mais voltei para o método antigo. Mais rápido, mais limpo e muito mais eficiente.`,
    seoCtaTemplate: () => `🛒 Toque no carrinho laranja abaixo para garantir o seu hoje mesmo!`,
  },
  {
    badge: '🔥 QUEIMA DE ESTOQUE',
    titleTemplate: (p) => `PREÇO DE FÁBRICA LIBERADO NO CARRINHO LARANJA!`,
    seoHookTemplate: (p) => `🔥 Oportunidade única: ${p} com condição especial direto no TikTok Shop!`,
    seoBodyTemplate: (p) => `Além de mostrar o ${p} funcionando na prática, consegui encontrar o fornecedor com envio rápido no Brasil e avaliação máxima.`,
    seoCtaTemplate: () => `⚡ Clique no carrinho laranja aqui embaixo para resgatar o desconto!`,
  },
  {
    badge: '👀 VERDADE SEM FILTRO',
    titleTemplate: (p) => `A VERDADE QUE NINGUÉM TE CONTA SOBRE ESSE PRODUTO!`,
    seoHookTemplate: (p) => `👀 A verdade sincera sobre o ${p} que está bombando na For You!`,
    seoBodyTemplate: (p) => `Testei na prática os pontos fortes e como extrair 100% do desempenho do ${p}. Veja o passo a passo completo no vídeo!`,
    seoCtaTemplate: () => `🛒 Gostou do resultado? O link oficial está aqui no carrinho laranja!`,
  },
  {
    badge: '✨ TRANSFORMAÇÃO REAL',
    titleTemplate: (p) => `DEPOIS QUE DESCOBRI ISSO, MINHA ROTINA MUDOU 100%!`,
    seoHookTemplate: (p) => `✨ Como esse ${p} transformou a minha rotina logo no primeiro dia!`,
    seoBodyTemplate: (p) => `Pequenos detalhes que fazem toda a diferença. Veja a qualidade e o resultado real do ${p} em uso contínuo.`,
    seoCtaTemplate: () => `👇 Garanta o seu clicando no botão do produto aqui embaixo!`,
  },
  {
    badge: '🛑 PARE TUDO E VEJA',
    titleTemplate: (p) => `PARE DE ROLAR O FEED! VOCÊ PRECISA VER ISSO AGORA`,
    seoHookTemplate: (p) => `🛑 Pare tudo por 15 segundos e veja o que esse ${p} é capaz de fazer!`,
    seoBodyTemplate: (p) => `Um dos vídeos mais pedidos do perfil! Coloquei o ${p} em ação máxima para mostrar por que ele tem tantas avaliações 5 estrelas.`,
    seoCtaTemplate: () => `🛒 Clique no carrinho laranja agora e garanta com desconto!`,
  },
  {
    badge: '💥 TESTE EXTREMO',
    titleTemplate: (p) => `COLOQUEI À PROVA NO LIMITE! AGUENTOU O TRANCO?`,
    seoHookTemplate: (p) => `💥 Teste extremo com o ${p}: será que aguenta o uso pesado?`,
    seoBodyTemplate: (p) => `Nada de teste leve! Mostrei o ${p} resolvendo a situação mais difícil na prática e o resultado surpreendeu demais.`,
    seoCtaTemplate: () => `⚡ Aproveite a promoção clicando no carrinho laranja abaixo!`,
  },
  {
    badge: '🎁 PRESENTE PERFEITO',
    titleTemplate: (p) => `COMPREI 1 PRA TESTAR E JÁ PEDI MAIS 2 PRA FAMÍLIA!`,
    seoHookTemplate: (p) => `🎁 Comprei esse ${p} para testar e todo mundo aqui em casa quis um igual!`,
    seoBodyTemplate: (p) => `Sabe aquele produto que todo mundo que visita sua casa pergunta onde você comprou? É exatamente esse ${p}!`,
    seoCtaTemplate: () => `🛒 Clique no carrinho laranja aqui na tela para ver o preço especial!`,
  },
  {
    badge: '⚡ DICA DE OURO',
    titleTemplate: (p) => `O SEGREDO PARA FAZER EM 30 SEGUNDOS SEM ESFORÇO!`,
    seoHookTemplate: (p) => `⚡ O segredo para ter resultado profissional em 30 segundos com o ${p}!`,
    seoBodyTemplate: (p) => `Chega de complicação. Com esse ${p} qualquer pessoa consegue um resultado incrível logo na primeira tentativa.`,
    seoCtaTemplate: () => `👇 Toque no link do carrinho abaixo e garanta o seu hoje!`,
  },
  {
    badge: '🏅 APROVADO NO TESTE',
    titleTemplate: (p) => `TESTADO E APROVADO! VEJA O RESULTADO FINAL NA PRÁTICA`,
    seoHookTemplate: (p) => `🏅 Testado e 100% aprovado: veja o resultado final com o ${p}!`,
    seoBodyTemplate: (p) => `Se você estava em dúvida se o ${p} realmente funciona, esse vídeo mostra do início ao fim toda a eficiência dele.`,
    seoCtaTemplate: () => `🛒 Clique no carrinho laranja aqui embaixo e peça com garantia!`,
  },
];

/**
 * Checks if a string is a generic system/campaign/project/clip filename rather than a real product name.
 */
export function isGenericCampaignOrClipName(raw?: string): boolean {
  if (!raw) return true;
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!normalized || normalized.length < 3) return true;

  const genericPatterns = [
    /campanha/i,
    /3x3/i,
    /projeto/i,
    /^proj[-_\s0-9]/i,
    /estudio/i,
    /criativo/i,
    /multiplicador/i,
    /clip27/i,
    /^gancho/i,
    /^corpo/i,
    /^cta/i,
    /^hook/i,
    /^body/i,
    /anuncio_de_produto/i,
    /video_sem_titulo/i,
    /sem_titulo/i,
    /untitled/i,
    /whatsapp video/i,
    /lv_\d+/i,
    /capcut/i,
    /^[a-z0-9_-]+_\d{10,}/i, // e.g., gancho2_20261023194303
  ];

  return genericPatterns.some((pattern) => pattern.test(normalized));
}

function cleanProductLabel(rawName?: string): string {
  if (!rawName) return '';
  const cleaned = rawName
    .replace(/\.mp4|\.mov|\.webm/gi, '')
    .replace(/^(Gancho|Corpo|CTA)\s*\d*:\s*/i, '')
    .replace(/#\d+$/g, '')
    .trim();

  if (!cleaned || isGenericCampaignOrClipName(cleaned)) {
    return '';
  }
  return cleaned;
}

function buildSeoHashtags(productLabel: string): string {
  const baseTags = [
    '#tiktokshopbrasil',
    '#achadinhos',
    '#achadinhosdotiktok',
    '#produtoviral',
    '#testedeproduto',
    '#valeapena',
    '#comprasonline',
    '#dicasdecompras',
    '#tiktokmefezcomprar',
  ];

  if (!productLabel) {
    return baseTags.join(' ');
  }

  const words = productLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !['esse', 'produto', 'viral', 'para', 'com', 'mais', 'campanha'].includes(w));

  const customTags = words.slice(0, 3).map((w) => `#${w}`);
  if (words.length >= 2) {
    customTags.unshift(`#${words.slice(0, 2).join('')}`);
  }

  return Array.from(new Set([...customTags, ...baseTags])).join(' ');
}

export function buildVariationCoverAndSeo(
  index1Based: number,
  hookIndex: number,
  bodyIndex: number,
  ctaIndex: number,
  productOrProjectName?: string
): {
  coverBadge: string;
  coverTitle: string;
  seoCaption: string;
} {
  const angleIdx = (index1Based - 1) % HIGH_IMPACT_27_ANGLES.length;
  const angle = HIGH_IMPACT_27_ANGLES[angleIdx];
  const cleanProd = cleanProductLabel(productOrProjectName);

  // If user specified a real product name, use it; otherwise use natural high-converting viral phrasing
  const displayProdForTitle = cleanProd ? cleanProd : 'ESSE PRODUTO';
  const seoProdLabel = cleanProd ? cleanProd : 'esse produto viral';

  const rawCoverTitle = angle.titleTemplate(displayProdForTitle);
  // Make the cover title read naturally when no specific product is set
  const coverTitle = !cleanProd
    ? rawCoverTitle.replace('NÃO COMPRE ESSE PRODUTO ANTES', 'NÃO COMPRE ANTES')
    : rawCoverTitle;

  const seoHook = angle.seoHookTemplate(seoProdLabel);
  const seoBody = angle.seoBodyTemplate(seoProdLabel);
  const seoCta = angle.seoCtaTemplate(seoProdLabel);
  const hashtags = buildSeoHashtags(cleanProd);

  const seoKeywordsLine = cleanProd
    ? `🔎 Buscas relacionadas: ${cleanProd} vale a pena, ${cleanProd} funciona mesmo, ${cleanProd} onde comprar no Brasil, ${cleanProd} original com desconto.`
    : `🔎 Buscas relacionadas: produto viral tiktok shop brasil, achadinhos úteis que funcionam, teste de produto real, melhores ofertas da internet.`;

  const seoCaption = `${seoHook}\n\n${seoBody}\n\n${seoCta}\n\n${seoKeywordsLine}\n\n${hashtags}`;

  return {
    coverBadge: `${angle.badge} · G${hookIndex}+C${bodyIndex}+CTA${ctaIndex}`,
    coverTitle,
    seoCaption,
  };
}

/**
 * Compile exact Cartesian Product (G1+C1+CTA1 ... G3+C3+CTA3 = 27 unique videos) without repetition.
 * Maintains a guaranteed unique hash per combination in background, plus generates High-Impact Cover Title & TikTok SEO Caption.
 */
export function compileCartesianMatrix(
  hooks: VideoClip[],
  bodies: VideoClip[],
  ctas: VideoClip[],
  _headlines: string[] = [],
  projectId: string = 'proj',
  _antiShadowbanEnabled: boolean = true,
  _subtitleStyle: SubtitleStyle = 'minimal_clean',
  options?: {
    productKeyword?: string;
    projectName?: string;
    subtitlesEnabled?: boolean;
    subtitlePosition?: 'bottom' | 'middle' | 'top';
    headlineStyle?: 'yellow_neon' | 'tiktok_red' | 'purple_glow' | 'white_card' | 'none';
    transitionStyle?: 'cut' | 'zoom_punch' | 'flash' | 'crossfade';
  }
): CreativeVariation[] {
  const variations: CreativeVariation[] = [];

  const hydratedHooks = hydrateClipsWithBlobs(hooks);
  const hydratedBodies = hydrateClipsWithBlobs(bodies);
  const hydratedCtas = hydrateClipsWithBlobs(ctas);

  if (hydratedHooks.length === 0 || hydratedBodies.length === 0 || hydratedCtas.length === 0) {
    return [];
  }

  const usedHashes = new Set<string>();
  let counter = 0;

  // Only use productKeyword (or projectName if it's a real product name, never "Nova Campanha 3x3x3")
  const explicitProduct = cleanProductLabel(options?.productKeyword) || cleanProductLabel(options?.projectName);

  for (let g = 0; g < hydratedHooks.length; g++) {
    for (let c = 0; c < hydratedBodies.length; c++) {
      for (let cta = 0; cta < hydratedCtas.length; cta++) {
        counter++;
        const hookClip = hydratedHooks[g];
        const bodyClip = hydratedBodies[c];
        const ctaClip = hydratedCtas[cta];

        // Generate a guaranteed unique hash in background for each combination
        let microEdit = generateMicroEdit();
        while (usedHashes.has(microEdit.hashHex)) {
          microEdit = generateMicroEdit();
        }
        usedHashes.add(microEdit.hashHex);

        const hookDur = hookClip?.duration || 4.0;
        const bodyDur = bodyClip?.duration || 7.0;
        const ctaDur = ctaClip?.duration || 3.5;
        const totalDuration = Number((hookDur + bodyDur + ctaDur).toFixed(1));

        const { coverBadge, coverTitle, seoCaption } = buildVariationCoverAndSeo(
          counter,
          g + 1,
          c + 1,
          cta + 1,
          explicitProduct
        );

        variations.push({
          id: `var-${projectId}-G${g + 1}-C${c + 1}-CTA${cta + 1}`,
          code: `G${g + 1}+C${c + 1}+CTA${cta + 1}`,
          index: counter,
          hookIndex: g + 1,
          bodyIndex: c + 1,
          ctaIndex: cta + 1,
          hookClip,
          bodyClip,
          ctaClip,
          headline: coverTitle,
          coverTitle,
          coverBadge,
          seoCaption,
          headlineStyle: 'none',
          microEdit,
          subtitlesEnabled: false,
          subtitleStyle: 'minimal_clean',
          resolvedSubtitleStyle: 'minimal_clean',
          subtitlePosition: 'bottom',
          transitionStyle: 'cut',
          estimatedDuration: totalDuration,
          status: 'pronto',
        });
      }
    }
  }

  return variations;
}

// Hydrate variations so hookClip, bodyClip, and ctaClip are guaranteed to be fully populated with real video files
export function hydrateVariationsWithProject(
  variations: CreativeVariation[],
  project: Project
): CreativeVariation[] {
  const hooks = hydrateClipsWithBlobs(project.hooks || []);
  const bodies = hydrateClipsWithBlobs(project.bodies || []);
  const ctas = hydrateClipsWithBlobs(project.ctas || []);

  const totalPossible = hooks.length * bodies.length * ctas.length;
  const explicitProduct =
    cleanProductLabel(project.productKeyword) || cleanProductLabel(project.name);

  if (
    !variations ||
    variations.length === 0 ||
    (totalPossible > 0 && variations.length !== totalPossible)
  ) {
    if (hooks.length > 0 && bodies.length > 0 && ctas.length > 0) {
      return compileCartesianMatrix(hooks, bodies, ctas, [], project.id, true, 'minimal_clean', {
        productKeyword: explicitProduct,
        projectName: project.name,
      });
    }
    return [];
  }

  return (variations || []).map((v, idx) => {
    const hookClip = hooks[v.hookIndex - 1] || hooks[0] || v.hookClip;
    const bodyClip = bodies[v.bodyIndex - 1] || bodies[0] || v.bodyClip;
    const ctaClip = ctas[v.ctaIndex - 1] || ctas[0] || v.ctaClip;

    const hookDur = hookClip?.duration || 4.0;
    const bodyDur = bodyClip?.duration || 7.0;
    const ctaDur = ctaClip?.duration || 3.5;

    const freshSeo = buildVariationCoverAndSeo(
      v.index || idx + 1,
      v.hookIndex,
      v.bodyIndex,
      v.ctaIndex,
      explicitProduct
    );

    // Auto-heal any saved variation that previously contained "Campanha 3x3x3" or raw clip names
    const hasPollutedTitle =
      !v.coverTitle ||
      /campanha|3x3|projeto|gancho|corpo|anuncio_de_produto/i.test(v.coverTitle) ||
      /campanha|3x3|projeto|gancho|corpo|anuncio_de_produto/i.test(v.seoCaption || '');

    const resolvedCoverTitle = hasPollutedTitle ? freshSeo.coverTitle : v.coverTitle || freshSeo.coverTitle;
    const resolvedSeoCaption = hasPollutedTitle ? freshSeo.seoCaption : v.seoCaption || freshSeo.seoCaption;

    return {
      ...v,
      code: `G${v.hookIndex}+C${v.bodyIndex}+CTA${v.ctaIndex}`,
      hookClip,
      bodyClip,
      ctaClip,
      headline: resolvedCoverTitle,
      coverTitle: resolvedCoverTitle,
      coverBadge: v.coverBadge || freshSeo.coverBadge,
      seoCaption: resolvedSeoCaption,
      headlineStyle: 'none',
      subtitlesEnabled: false,
      transitionStyle: 'cut',
      estimatedDuration: Number((hookDur + bodyDur + ctaDur).toFixed(1)),
    };
  });
}
