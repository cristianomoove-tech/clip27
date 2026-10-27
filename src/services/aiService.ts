import { AppSettings, VeoPromptConfig, Veo3CompiledOutput, Veo3SceneOutput, Veo3SceneRole } from '../types';
import { getStoredActiveLicense, saveUserApiKeysToFirestore } from './licensingService';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};

export const DEFAULT_SETTINGS: AppSettings = {
  openRouterApiKey: env.VITE_OPENROUTER_API_KEY || '',
  openRouterModel: env.VITE_OPENROUTER_MODEL || 'google/gemini-3.8-flash',
  apifyToken: env.VITE_APIFY_TOKEN || '',
};

export function getStoredSettings(): AppSettings {
  try {
    const activeUser = getStoredActiveLicense();
    const userScopedKey = activeUser ? `ai_creative_engine_settings_${activeUser.ID_Usuario}` : null;

    // 1. Read user-scoped localStorage or global fallback
    const rawUser = userScopedKey ? localStorage.getItem(userScopedKey) : null;
    const rawGlobal = localStorage.getItem('ai_creative_engine_settings');
    const parsedLocal = rawUser ? JSON.parse(rawUser) : rawGlobal ? JSON.parse(rawGlobal) : {};

    // 2. Merge with active user's cloud-synced keys or Vercel environment variables
    const merged: AppSettings = {
      openRouterApiKey:
        activeUser?.OpenRouter_ApiKey ||
        parsedLocal.openRouterApiKey ||
        DEFAULT_SETTINGS.openRouterApiKey ||
        '',
      openRouterModel:
        activeUser?.OpenRouter_Model ||
        parsedLocal.openRouterModel ||
        DEFAULT_SETTINGS.openRouterModel,
      apifyToken:
        activeUser?.Apify_Token ||
        parsedLocal.apifyToken ||
        DEFAULT_SETTINGS.apifyToken ||
        '',
    };

    if (
      !merged.openRouterModel ||
      merged.openRouterModel.includes('gemini-2.0') ||
      merged.openRouterModel.includes('gemini-1.5')
    ) {
      merged.openRouterModel = 'google/gemini-3.8-flash';
    }

    return merged;
  } catch (err) {
    console.error('Erro ao ler configurações:', err);
  }
  return DEFAULT_SETTINGS;
}

export function saveStoredSettings(settings: AppSettings, skipCloudSync: boolean = false): void {
  try {
    const cleanSettings: AppSettings = {
      openRouterApiKey: (settings.openRouterApiKey || '').trim(),
      openRouterModel: settings.openRouterModel || DEFAULT_SETTINGS.openRouterModel,
      apifyToken: (settings.apifyToken || '').trim(),
    };

    localStorage.setItem('ai_creative_engine_settings', JSON.stringify(cleanSettings));

    const activeUser = getStoredActiveLicense();
    if (activeUser?.ID_Usuario) {
      localStorage.setItem(
        `ai_creative_engine_settings_${activeUser.ID_Usuario}`,
        JSON.stringify(cleanSettings)
      );
      if (!skipCloudSync) {
        saveUserApiKeysToFirestore(activeUser.ID_Usuario, cleanSettings).catch((e) =>
          console.warn('Erro ao salvar chaves na nuvem:', e)
        );
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clip27-settings-updated', { detail: cleanSettings }));
    }
  } catch (err) {
    console.error('Erro ao salvar configurações:', err);
  }
}

// Fallback high-CTR headlines in Portuguese for immediate zero-latency execution
const VIRAL_HEADLINES_DATABASE = [
  'NÃO COMPRE ANTES DE VER ESSE TESTE!',
  'ISSO DEVERIA SER PROIBIDO DE TÃO BARATO',
  'COMO NINGUÉM ME CONTOU DESSE PRODUTO ANTES?',
  'O SEGREDO QUE AS GRANDES MARCAS ESCONDEM',
  'TESTEI POR 7 DIAS E O RESULTADO CHOCOU',
  'O TIKTOK ME FEZ COMPRAR E VALEU CADA CENTAVO',
  'PARE DE JOGAR DINHEIRO FORA COM IMITAÇÃO',
  'O TRUQUE DEFINITIVO QUE VOCÊ PRECISA HOJE',
  'ESTOQUE ESGOTANDO NO TIKTOK SHOP BRASIL',
  'RESOLVEU MEU MAIOR PROBLEMA EM 10 SEGUNDOS',
  'SÓ ACREDITO PORQUE VI COM OS MEUS OLHOS',
  'SE VOCÊ TEM ISSO EM CASA, TEM UMA MINA DE OURO',
  'O ACHADINHO MAIS BIZARRO E ÚTIL DO ANO',
  'DEPOIS DISSO NUNCA MAIS VOLTO AO JEITO ANTIGO',
  'MELHOR INVESTIMENTO DE MENOS DE R$ 100 REAIS',
];

export async function generateViralHeadlines(productOrNiche: string): Promise<string[]> {
  const settings = getStoredSettings();
  
  if (settings.openRouterApiKey && settings.openRouterApiKey.trim().length > 5) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openRouterApiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AI Creative Engine',
        },
        body: JSON.stringify({
          model: settings.openRouterModel || 'google/gemini-3.8-flash',
          messages: [
            {
              role: 'system',
              content: 'Você é um estrategista de anúncios virais de topo de funil para TikTok Shop, Reels e Shorts no Brasil. Retorne APENAS 5 manchetes curtas (em CAIXA ALTA, máximo 7 palavras por linha, altamente apelativas com curiosidade, choque ou benefício irrecusável), uma por linha, sem numeração ou marcadores.',
            },
            {
              role: 'user',
              content: `Gere 5 manchetes de alto CTR para criativos de: ${productOrNiche || 'Produto viral do TikTok Shop'}`,
            },
          ],
          temperature: 0.8,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          const lines = text
            .split('\n')
            .map((l: string) => l.replace(/^[\d\s.\-•*#]+/, '').trim().toUpperCase())
            .filter((l: string) => l.length > 5);
          if (lines.length >= 3) {
            return lines.slice(0, 5);
          }
        }
      }
    } catch (e) {
      console.warn('OpenRouter request falhou, usando gerador inteligente local:', e);
    }
  }

  // Smart local generator tailored to productOrNiche
  const nicheLower = (productOrNiche || '').toLowerCase();
  let specialized: string[] = [];

  if (nicheLower.includes('beleza') || nicheLower.includes('pele') || nicheLower.includes('skincare')) {
    specialized = [
      'MINHA PELE MUDOU EM EXATAMENTE 3 DIAS',
      'DERMATOLOGISTAS NÃO QUEREM QUE VOCÊ VEJA ISSO',
      'PARECE CIRURGIA PLÁSTICA MAS É SÓ ESSE FRASCO',
      'FINALMENTE ACABEI COM AS MANCHAS NO ROSTO',
      'O PRODUTO QUE DEIXOU TODAS AS BLOGUEIRAS EM CHOQUE',
    ];
  } else if (nicheLower.includes('tech') || nicheLower.includes('gadget') || nicheLower.includes('ferramenta')) {
    specialized = [
      'ESSE APARELHO PARECE SAÍDO DE 2050',
      'COMO ESSA FERRAMENTA RESOLVE TUDO TÃO RÁPIDO?',
      'ECONOMIZEI 4 HORAS DO MEU DIA COM ISSO',
      'O DISPOSITIVO QUE TODO MUNDO ESTÁ CAÇANDO NO BRASIL',
      'TESTANDO O GADGET MAIS VENDIDO DA INTERNET',
    ];
  } else if (nicheLower.includes('casa') || nicheLower.includes('cozinha') || nicheLower.includes('limpeza')) {
    specialized = [
      'MINHA CASA NUNCA MAIS FOI A MESMA DEPOIS DISSO',
      'COMO LIMPAR TUDO EM 5 MINUTOS SEM ESFORÇO',
      'O ACHADO DE COZINHA QUE DEVERIA CUSTAR O DOBRO',
      'POR QUE NINGUÉM FEZ ESSA INVENÇÃO ANTES?',
      'A SOLUÇÃO DEFINITIVA PARA A BAGUNÇA DE CASA',
    ];
  } else {
    // Shuffle and pick 5 from the database
    const shuffled = [...VIRAL_HEADLINES_DATABASE].sort(() => 0.5 - Math.random());
    specialized = shuffled.slice(0, 5);
  }

  return specialized;
}

export async function generateVeoScriptWithAi(config: Partial<VeoPromptConfig>): Promise<string> {
  const settings = getStoredSettings();
  const promptContext = `Nicho: ${config.niche || 'Geral'}. Produto: ${config.productName || 'Produto Inovador'}. Faixa Etária: ${config.ageGroup || 'Adulto'}. Humor: ${config.mood || 'Entusiasmado'}. Arquétipo: ${config.profession || 'Criador UGC'}.`;

  if (settings.openRouterApiKey && settings.openRouterApiKey.trim().length > 5) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openRouterApiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AI Creative Engine',
        },
        body: JSON.stringify({
          model: settings.openRouterModel || 'google/gemini-3.8-flash',
          messages: [
            {
              role: 'system',
              content: 'Você é um roteirista profissional de UGC viral para TikTok Shop e Google Veo 3 no Brasil. Escreva a fala falada do criador em português do Brasil (pt-BR) em primeira pessoa, natural, sem rodeios, com gancho agressivo no primeiro segundo, demonstração do problema e chamada direta para o carrinho/bio. Máximo 4 frases pontuais e ritmadas.',
            },
            {
              role: 'user',
              content: `Escreva o roteiro em português do Brasil para o seguinte anúncio: ${promptContext}`,
            },
          ],
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const script = data.choices?.[0]?.message?.content?.trim();
        if (script) return script;
      }
    } catch (e) {
      console.warn('Erro ao chamar OpenRouter para roteiro, usando fallback:', e);
    }
  }

  // Smart local script generator in authentic PT-BR UGC style
  const prod = config.productName || 'esse produto';
  return `Você não vai acreditar no que aconteceu quando testei ${prod}! Eu já estava quase desistindo de procurar uma solução real, mas isso aqui mudou completamente minha rotina em minutos. Olha a facilidade e a precisão disso na prática. Se você quer garantir o seu com o desconto exclusivo do TikTok Shop antes que esgote o lote, clica agora no link aqui embaixo!`;
}

export async function analyzeProductLinkOrName(query: string): Promise<{
  productName: string;
  niche: string;
  visualDescription: string;
  keyBenefits: string[];
  suggestedScript: string;
}> {
  const clean = query.trim();
  let detectedNiche = 'Tecnologia & Ferramentas';
  let visualDescription = 'Corpo ergonômico compacto em polímero fosco premium com acabamento moderno, cabendo perfeitamente na palma da mão com detalhes em LED.';
  const lower = clean.toLowerCase();

  if (lower.includes('creme') || lower.includes('serum') || lower.includes('pele') || lower.includes('skincare') || lower.includes('batom') || lower.includes('glow') || lower.includes('escova')) {
    detectedNiche = 'Beleza & Skincare';
    visualDescription = 'Frasco cilíndrico minimalista de 50ml com acabamento fosco translúcido, tampa metálica prateada com conta-gotas de vidro e textura fluida brilhante.';
  } else if (lower.includes('camisa') || lower.includes('vestido') || lower.includes('tenis') || lower.includes('moda') || lower.includes('relogio') || lower.includes('sutia')) {
    detectedNiche = 'Moda & Estilo';
    visualDescription = 'Tecido tecnológico de alta elasticidade sem costura aparente, toque acetinado fosco e caimento estruturado anatômico.';
  } else if (lower.includes('whey') || lower.includes('creatina') || lower.includes('treino') || lower.includes('fitness') || lower.includes('postura')) {
    detectedNiche = 'Saúde & Fitness';
    visualDescription = 'Design anatômico esportivo em neoprene respirável preto com visor digital LCD discreto no centro e acabamento reforçado.';
  } else if (lower.includes('panela') || lower.includes('liquidificador') || lower.includes('aspirador') || lower.includes('mop') || lower.includes('cozinha') || lower.includes('seladora')) {
    detectedNiche = 'Casa & Cozinha';
    visualDescription = 'Utensílio portátil compacto em ABS branco acetinado e detalhes cinza, tamanho de 12cm na mão, textura lisa resistente à água.';
  }

  return {
    productName: clean || 'Produto Viral TikTok',
    niche: detectedNiche,
    visualDescription,
    keyBenefits: [
      'Resultado visível nos primeiros 10 segundos de uso',
      'Facilidade extrema sem necessidade de manual complicado',
      'Excelente relação custo-benefício frente aos concorrentes tradicionais',
    ],
    suggestedScript: `Para tudo! Você não vai acreditar no que esse ${clean || 'achado'} faz em poucos segundos aqui em casa! Olha na prática como ele resolve o problema sem esforço nenhum e economiza muito tempo no dia a dia. Clica agora no carrinho laranja do TikTok Shop aqui embaixo antes que o estoque promocional acabe!`,
  };
}

/**
 * Splits or generates 8-second scene blocks (15 to 20 words per scene) structured as:
 * Scene 1 (HOOK: Gancho de Choque) -> Scene 2 (BODY: Demonstração de Benefício) -> Scene 3 (CTA: Carrinho)
 */
export async function optimizeVeoScript3x3x3(config: VeoPromptConfig): Promise<{
  fullScript: string;
  sceneDialogues: string[];
}> {
  const settings = getStoredSettings();
  const sceneCount = config.sceneCount || 3;
  const prod = config.productName || 'esse produto';

  if (settings.openRouterApiKey && settings.openRouterApiKey.trim().length > 5) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openRouterApiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Clip27 IA - Veo 3 Engine',
        },
        body: JSON.stringify({
          model: settings.openRouterModel || 'google/gemini-3.8-flash',
          messages: [
            {
              role: 'system',
              content: `Você é um especialista em engenharia de roteiro para Google Veo 3 (8 segundos exatos por cena).
Divida ou reescreva o roteiro do usuário em exatamente ${sceneCount} cenas em Português do Brasil (pt-BR) natural e conversacional.
REGRA OBRIGATÓRIA DE TEMPO (8 SEGUNDOS): Cada cena DEVE conter entre 15 e 20 palavras (nem muito curta, nem longa demais para 8s de lip-sync).
Estrutura obrigatória:
- Cena 1 (HOOK): Gancho de Choque / Interrupção de padrão imediata.
- Cena 2 (BODY): Demonstração prática de benefício irresistível do produto.
${sceneCount > 3 ? `- Cenas intermediárias (BODY): Prova social e detalhe de funcionamento prático.\n` : ''}- Última Cena (CTA): Chamada urgente para clicar no carrinho laranja do TikTok Shop abaixo.
Retorne APENAS um JSON válido no formato: {"scenes": ["fala cena 1", "fala cena 2", "fala cena 3"]}`,
            },
            {
              role: 'user',
              content: `Produto: ${prod}. Descrição visual: ${config.productVisualDescription || 'N/A'}. Nicho: ${config.niche}. Roteiro base atual: "${config.scriptPtBr}"`,
            },
          ],
          temperature: 0.65,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content?.trim() || '';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.scenes) && parsed.scenes.length >= 2) {
            const cleanScenes = parsed.scenes.slice(0, sceneCount).map((s: string) => s.trim());
            return {
              fullScript: cleanScenes.join(' '),
              sceneDialogues: cleanScenes,
            };
          }
        }
      }
    } catch (e) {
      console.warn('Fallback local para otimização 3x3x3 de 8s:', e);
    }
  }

  // Deterministic Local 8-second (15-20 words per scene) Optimizer
  const hookLine = `Para tudo! Você não vai acreditar no que esse ${prod} acabou de fazer aqui em casa em segundos!`;
  const bodyLine = `Eu estava super cética, mas olha na prática como ele funciona rápido, sem esforço e resolve de primeira!`;
  const bodyLine2 = `O acabamento é impecável, cabe certinho na mão e economiza horas da minha rotina todos os dias com perfeição!`;
  const bodyLine3 = `Comparei com vários modelos caros do mercado e esse entregou o dobro de potência custando uma fração do preço!`;
  const ctaLine = `Não perde tempo! Clica agora no carrinho laranja aqui embaixo e garante o seu antes que o estoque acabe!`;

  let dialogues: string[] = [];
  if (sceneCount === 2) {
    dialogues = [hookLine, ctaLine];
  } else if (sceneCount === 3) {
    dialogues = [hookLine, bodyLine, ctaLine];
  } else if (sceneCount === 4) {
    dialogues = [hookLine, bodyLine, bodyLine2, ctaLine];
  } else {
    dialogues = [hookLine, bodyLine, bodyLine2, bodyLine3, ctaLine];
  }

  return {
    fullScript: dialogues.join(' '),
    sceneDialogues: dialogues,
  };
}

/**
 * Helper to resolve PT-BR scene dialogues without ever re-injecting demo scripts when cleared by the user
 */
export function resolveSceneDialogues(config: VeoPromptConfig): string[] {
  const count = config.sceneCount || 3;
  if (Array.isArray(config.sceneDialoguesPtBr)) {
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(config.sceneDialoguesPtBr[i] ?? '');
    }
    return result;
  }

  const rawSentences = (config.scriptPtBr || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i === count - 1 && rawSentences.length >= count) {
      result.push(rawSentences.slice(i).join(' '));
    } else if (rawSentences[i]) {
      result.push(rawSentences[i]);
    } else {
      result.push('');
    }
  }
  return result;
}

/**
 * Deterministic Local Compiler for Google Veo 3 Pro Master JSON
 * Guarantees 100% Character Lock, Product Lock, 8s Lip-Sync PT-BR, and Realistic Physics
 */
export function buildLocalVeo3MasterJson(config: VeoPromptConfig): Veo3CompiledOutput {
  const genderEn = config.gender === 'Masculino' ? 'Brazilian man' : 'Brazilian woman';
  const ageMap: Record<string, string> = {
    'Jovem (18-25)': '22 years old, youthful energetic features',
    'Adulto (26-39)': '31 years old, relatable authentic adult features',
    'Maduro (40-60)': '46 years old, experienced and trustworthy presence with natural fine expression lines',
    'Sênior (60+)': '64 years old, warm charismatic senior presence with authentic silver hair and natural skin texture',
  };
  const ageEn = ageMap[config.ageGroup] || '28 years old';

  const attireMap: Record<string, string> = {
    'Camiseta Básica': 'wearing a fitted solid neutral cotton t-shirt with realistic fabric weave and zero brand logos',
    'Camisa Casual': 'wearing a smart casual linen button-down shirt with natural fabric folds and zero logos',
    'Moletom Street': 'wearing a cozy matte streetwear hoodie with realistic cotton texture and zero graphics',
    'Uniforme/Avental': 'wearing a clean professional utility apron over a neutral crew-neck shirt',
  };
  const attireEn = attireMap[config.visualStyle] || 'wearing a plain casual cotton t-shirt';

  const moodMap: Record<string, string> = {
    'Entusiasmado/Chocado': 'wide expressive eyes, raised eyebrows, genuine amazed micro-expressions and high-energy authentic smile',
    'Confiante/Autoridade': 'composed confident gaze, authoritative nod, persuasive and trustworthy facial micro-expressions',
    'Curioso/Segredo': 'intriguing leaning-in posture, raised eyebrow, sharing an insider secret expression',
  };
  const moodEn = moodMap[config.mood] || 'expressive and natural facial micro-expressions';

  const envMap: Record<string, string> = {
    'Home Office': 'inside a real lived-in Brazilian home office with warm wood desk, soft-focus monitor and indoor plant in background',
    'Cozinha/Sala Real': 'inside a bright contemporary Brazilian kitchen and living room with granite countertop and warm domestic ambiance',
    'Oficina/Bancada': 'at a clean technical workbench with organized tools and realistic workshop depth in soft bokeh',
    'Estúdio LED': 'in a modern creator studio with subtle magenta and warm tungsten practical LED tube accents in the background',
  };
  const envEn = envMap[config.environment] || 'inside an authentic Brazilian home interior';

  const lightingMap: Record<string, string> = {
    'Handheld (Câmera na Mão) + Luz Natural': 'soft directional natural daylight from a side window at 5600K with organic skin subsurface scattering',
    'Zoom In Rápido + Ring Light': 'crisp 18-inch frontal ring-light catchlights in the pupils with balanced 5000K key light and soft fill',
    'Estático + Cinematográfica': 'Three-point cinematic commercial lighting with warm 4500K key light, soft Rim hair light and natural shadow falloff',
  };
  const lightEn = lightingMap[config.movementLighting] || 'natural soft window key light at 5600K';

  const hairAndFeatures =
    config.gender === 'Masculino'
      ? 'short dark-brown wavy hair with natural tapered sides, warm olive-tan Brazilian complexion, dark-brown eyes, subtle trimmed stubble'
      : 'shoulder-length dark-brown layered wavy hair with subtle caramel highlights, warm olive-tan Brazilian complexion, expressive dark-brown eyes, natural everyday makeup';

  // IMMUTABLE CHARACTER LOCK BIBLE
  const characterLockBible = `CHARACTER LOCK [Seed #${config.consistencySeed}]: Authentic ${genderEn}, exact age ${ageEn}, ${hairAndFeatures}. Ultra-realistic human skin texture with visible microscopic pores, natural vellus hair, realistic subsurface scattering, zero plastic or airbrushed AI smoothing. Expression: ${moodEn}. Wardrobe: ${attireEn}. Setting: ${envEn}. Lighting: ${lightEn}.`;

  // IMMUTABLE PRODUCT LOCK BIBLE
  const visualDescRaw =
    config.productVisualDescription?.trim() ||
    'compact ergonomic handheld consumer product with matte finish, clean geometric proportions and premium build quality';
  const productLockBible = `PRODUCT LOCK: "${config.productName || 'Produto'}" — Physical specification: ${visualDescRaw}. Strict rigid-body physics, invariant geometry, consistent scale relative to human hand (approx. 12-15cm), accurate surface reflections, natural finger occlusion and realistic grip pressure without morphing or warping.`;

  const negativePrompt =
    'morphed hands, extra fingers, distorted product label, gibberish text, blurry face, robotic movement, plastic skin, watermark, subtitles on screen';

  const physicalActionMap: Record<string, string> = {
    'Mostrando para a câmera em close':
      'holding the product steadily in the foreground near the lens with one hand while pointing to its details with the index finger of the other hand',
    'Aplicando/Usando na prática':
      'actively demonstrating and operating the product in real time with realistic hand mechanics and tactile physical interaction',
    'Apontando para o produto na mesa':
      'standing beside a table, gesturing dynamically and pointing directly at the product resting on the surface in sharp focus',
    'Unboxing / Abrindo a caixa':
      'unboxing and lifting the product out of its packaging with genuine excitement and tactile hand precision',
  };
  const basePhysicalActionEn =
    physicalActionMap[config.productPhysicalAction] ||
    'holding and demonstrating the product naturally in front of the camera';

  const audioStyleMap: Record<string, string> = {
    'Voz Limpa de Microfone de Lapela':
      'Crisp close-mic lavalier vocal capture (24-bit/48kHz), dry studio clarity, zero room echo, accompanied by subtle tactile product foley.',
    'Áudio Orgânico de Celular com Acústica de Quarto':
      'Authentic iPhone 16 Pro built-in condenser microphone audio with natural bedroom/living-room acoustic reflections and realistic hand-movement foley.',
    'Voz Empolgada + Som Ambiente Sutil':
      'High-energy dynamic vocal projection with subtle domestic room tone and crisp realistic foley of fingers handling the product.',
  };
  const baseSoundDesign =
    audioStyleMap[config.audioEnvironmentStyle] ||
    'Crisp close-mic vocal capture with realistic tactile product foley.';

  const dialogues = resolveSceneDialogues(config);
  const count = config.sceneCount || 3;
  const scenes: Veo3SceneOutput[] = [];

  for (let i = 0; i < count; i++) {
    const idx = i + 1;
    let role: Veo3SceneRole = 'BODY';
    if (i === 0) role = 'HOOK';
    else if (i === count - 1) role = 'CTA';

    const spokenPtBr = dialogues[i] ?? '';

    let cameraLensAndMotion = '';
    let sceneSpecificAction = '';
    let sceneSoundFoley = '';

    if (role === 'HOOK') {
      cameraLensAndMotion =
        'Vertical 9:16 aspect ratio, 24fps, 35mm prime lens f/1.8, handheld smartphone micro-jitter with a subtle fast push-in during the first 2 seconds to stop the scroll.';
      sceneSpecificAction = `Scene Action (HOOK): The presenter looks directly into the camera lens with immediate pattern-interrupt energy, ${basePhysicalActionEn}.`;
      sceneSoundFoley = `${baseSoundDesign} Sharp initial breath intake, crisp finger tap on the product casing, immediate vocal presence.`;
    } else if (role === 'BODY') {
      cameraLensAndMotion =
        'Vertical 9:16 aspect ratio, 24fps, 50mm lens f/2.0, smooth handheld tracking from medium close-up to detailed product action in the presenter’s hands with shallow optical bokeh.';
      sceneSpecificAction = `Scene Action (BODY DEMONSTRATION): The presenter demonstrates the core benefit in real time, ${basePhysicalActionEn}, maintaining natural eye contact with the lens between glances at the product.`;
      sceneSoundFoley = `${baseSoundDesign} Authentic mechanical/tactile foley of "${config.productName}" being operated, subtle cloth rustle, natural breathing between phrases.`;
    } else {
      cameraLensAndMotion =
        'Vertical 9:16 aspect ratio, 24fps, 35mm lens f/1.8, eye-level medium close-up with an energetic slight camera tilt as the presenter points downward toward the bottom-left shopping cart area.';
      sceneSpecificAction = `Scene Action (CTA CONVERSION): Holding "${config.productName}" clearly in one hand at chest level while pointing emphatically downward with the other hand toward the TikTok Shop cart button with an urgent, welcoming smile.`;
      sceneSoundFoley = `${baseSoundDesign} Upbeat vocal cadence, crisp hand gesture movement sound, clean acoustic finish.`;
    }

    const masterPromptVeo3 = `${characterLockBible} ${productLockBible} ${sceneSpecificAction} Camera & Lens: ${cameraLensAndMotion} The character speaks naturally in Brazilian Portuguese with perfect lip-sync: "${spokenPtBr}" Audio & Foley: ${sceneSoundFoley} Avoid: ${negativePrompt}.`;

    scenes.push({
      scene_id: idx,
      duration: '8s',
      role,
      master_prompt_veo3: masterPromptVeo3,
      spoken_dialogue_ptbr: spokenPtBr,
      sound_design: sceneSoundFoley,
    });
  }

  return {
    project_metadata: {
      engine: 'Google_Veo_3_Pro',
      aspect_ratio: '9:16',
      fps: 24,
      consistency_seed: config.consistencySeed,
    },
    character_lock_bible: characterLockBible,
    product_lock_bible: productLockBible,
    negative_prompt: negativePrompt,
    scenes,
  };
}

/**
 * Compiles the full Veo 3 Pro Master JSON using OpenRouter AI (if configured) or deterministic local compiler
 */
export async function compileVeo3MasterJson(config: VeoPromptConfig): Promise<Veo3CompiledOutput> {
  const settings = getStoredSettings();
  const localBase = buildLocalVeo3MasterJson(config);

  if (settings.openRouterApiKey && settings.openRouterApiKey.trim().length > 5) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openRouterApiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Clip27 IA - Veo 3 Pro Compiler',
        },
        body: JSON.stringify({
          model: settings.openRouterModel || 'google/gemini-3.8-flash',
          messages: [
            {
              role: 'system',
              content: `You are a Senior Google Veo 3 Pro Prompt Engineer specializing in hyper-realistic Brazilian UGC ads (9:16 vertical, 24fps, 8s per scene) with strict Character Lock, Product Lock, and Brazilian Portuguese (pt-BR) lip-sync.
Return ONLY a valid JSON object matching this exact schema:
{
  "project_metadata": { "engine": "Google_Veo_3_Pro", "aspect_ratio": "9:16", "fps": 24, "consistency_seed": number },
  "character_lock_bible": "Immutable technical English description of the Brazilian presenter (exact ethnicity, exact age, micro-expressions, realistic skin texture with visible pores, exact wardrobe and lighting) that MUST be injected identically into every scene",
  "product_lock_bible": "Exact physical English description of the product to keep proportions, colors, and textures faithful in the actor's hands",
  "negative_prompt": "morphed hands, extra fingers, distorted product label, gibberish text, blurry face, robotic movement, plastic skin, watermark, subtitles on screen",
  "scenes": [
    {
      "scene_id": number,
      "duration": "8s",
      "role": "HOOK" | "BODY" | "CTA",
      "master_prompt_veo3": "Complete unified prompt ready to paste into Veo 3 combining [Character Lock] + [Product Lock & Scene Physical Action] + [Camera Movement and 35mm/50mm Lens] + [Lighting] + [The character speaks naturally in Brazilian Portuguese with perfect lip-sync: \\"<exact pt-BR dialogue>\\"]",
      "spoken_dialogue_ptbr": "Only the spoken dialogue for this scene in Brazilian Portuguese",
      "sound_design": "Description of acoustics and real product foley sound effects"
    }
  ]
}`,
            },
            {
              role: 'user',
              content: `Compile the Veo 3 Pro JSON for these settings:
${JSON.stringify(config, null, 2)}
Reference baseline:
${JSON.stringify(localBase, null, 2)}`,
            },
          ],
          temperature: 0.4,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content?.trim() || '';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (
            parsed.project_metadata &&
            parsed.character_lock_bible &&
            parsed.product_lock_bible &&
            Array.isArray(parsed.scenes) &&
            parsed.scenes.length > 0
          ) {
            return {
              project_metadata: {
                engine: 'Google_Veo_3_Pro',
                aspect_ratio: '9:16',
                fps: 24,
                consistency_seed: config.consistencySeed,
              },
              character_lock_bible: parsed.character_lock_bible,
              product_lock_bible: parsed.product_lock_bible,
              negative_prompt:
                parsed.negative_prompt ||
                'morphed hands, extra fingers, distorted product label, gibberish text, blurry face, robotic movement, plastic skin, watermark, subtitles on screen',
              scenes: parsed.scenes.map((s: Veo3SceneOutput, idx: number) => ({
                scene_id: s.scene_id || idx + 1,
                duration: '8s',
                role: s.role || (idx === 0 ? 'HOOK' : idx === parsed.scenes.length - 1 ? 'CTA' : 'BODY'),
                master_prompt_veo3: s.master_prompt_veo3 || localBase.scenes[idx]?.master_prompt_veo3 || '',
                spoken_dialogue_ptbr: s.spoken_dialogue_ptbr || localBase.scenes[idx]?.spoken_dialogue_ptbr || '',
                sound_design: s.sound_design || localBase.scenes[idx]?.sound_design || '',
              })),
            };
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao compilar JSON via OpenRouter, utilizando compilador local Veo 3 Pro:', e);
    }
  }

  return localBase;
}

export async function generateClipSubtitlesWithAi(
  campaignName: string
): Promise<{
  hooks: string[];
  bodies: string[];
  ctas: string[];
}> {
  const settings = getStoredSettings();
  const topic = campaignName || 'Produto Viral TikTok Shop';

  if (settings.openRouterApiKey && settings.openRouterApiKey.trim().length > 5) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openRouterApiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Clip27 IA',
        },
        body: JSON.stringify({
          model: settings.openRouterModel || 'google/gemini-3.8-flash',
          messages: [
            {
              role: 'system',
              content:
                'Você é especialista em legendas dinâmicas de alta retenção para TikTok Shop Brasil. Retorne um JSON puro com as chaves "hooks" (3 frases curtas de gancho de 3-4s), "bodies" (3 frases de demonstração/benefício de 6-7s) e "ctas" (3 chamadas para ação urgentes de 3s). Todas em português do Brasil natural e persuasivo.',
            },
            {
              role: 'user',
              content: `Gere as legendas para a campanha: ${topic}`,
            },
          ],
          temperature: 0.75,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data.choices?.[0]?.message?.content?.trim() || '';
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (
            Array.isArray(parsed.hooks) &&
            Array.isArray(parsed.bodies) &&
            Array.isArray(parsed.ctas)
          ) {
            return {
              hooks: parsed.hooks.slice(0, 3),
              bodies: parsed.bodies.slice(0, 3),
              ctas: parsed.ctas.slice(0, 3),
            };
          }
        }
      }
    } catch (err) {
      console.warn('Fallback local para legendas de clipes:', err);
    }
  }

  return {
    hooks: [
      `Para tudo! Você precisa ver o que esse ${topic.slice(0, 22)} faz!`,
      'Eu não acreditava até testar isso aqui em casa hoje!',
      'Por que ninguém me contou desse segredo antes no TikTok?',
    ],
    bodies: [
      'Olha como resolve em segundos sem complicação e com resultado imediato na prática.',
      'Além de super resistente, economiza tempo todo dia e entrega qualidade absurda.',
      'Comparei com os mais caros do mercado e esse ganhou disparado no custo-benefício!',
    ],
    ctas: [
      'Clica agora no carrinho laranja aqui embaixo e garante o seu!',
      'Corre no link abaixo antes que o estoque promocional esgote!',
      'Aproveita o frete especial de hoje clicando no botão aqui embaixo!',
    ],
  };
}


