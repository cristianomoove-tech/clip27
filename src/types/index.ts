export type ClipType = 'hook' | 'body' | 'cta';

export interface VideoClip {
  id: string;
  type: ClipType;
  title: string;
  duration: number; // in seconds
  fileUrl?: string; // object URL if real file uploaded
  fileName?: string;
  fileSize?: string;
  thumbnailDataUrl?: string; // Base64 data URL of the first frame of the video
  colorTheme?: string;
  subtitleText?: string; // Custom spoken phrase / caption for this clip
  trimStart?: number; // Start offset in seconds within source video
  trimEnd?: number; // End offset in seconds within source video
  demoData?: {
    gradient: [string, string];
    badgeText: string;
    actionText: string;
    subText: string;
  };
}

export type ResolvedSubtitleStyle =
  | 'tiktok_white'
  | 'hormozi_yellow'
  | 'neon_pink'
  | 'capcut_box'
  | 'minimal_clean';

export type SubtitleStyle = 'random' | ResolvedSubtitleStyle;

export type SubtitlePosition = 'bottom' | 'middle' | 'top';

export type HeadlineStyle = 'yellow_neon' | 'tiktok_red' | 'purple_glow' | 'white_card' | 'none';

export type TransitionStyle = 'cut' | 'zoom_punch' | 'flash' | 'crossfade';

export interface MicroEditConfig {
  zoom: number; // 1.01x to 1.04x
  speed: number; // 0.98x to 1.02x
  brightness: number; // -0.02 to +0.02 (rendered as 0.98 to 1.02)
  saturation: number; // -0.02 to +0.02 (rendered as 0.98 to 1.02)
  hashHex: string; // 8 hex digits, e.g. "A7F29B01"
}

export interface CreativeVariation {
  id: string;
  code: string; // e.g., "G1+C1+CTA1"
  index: number;
  hookIndex: number;
  bodyIndex: number;
  ctaIndex: number;
  hookClip: VideoClip;
  bodyClip: VideoClip;
  ctaClip: VideoClip;
  headline: string;
  coverTitle?: string; // High-impact cover title for TikTok thumbnail
  coverBadge?: string; // High-impact trigger badge (e.g., "CHOQUE REAL", "TESTE 7 DIAS", "ALERTA")
  seoCaption?: string; // Ready-to-paste TikTok SEO description + keywords + hashtags
  headlineStyle?: HeadlineStyle;
  microEdit: MicroEditConfig;
  subtitlesEnabled?: boolean;
  subtitleStyle: SubtitleStyle;
  resolvedSubtitleStyle: ResolvedSubtitleStyle;
  subtitlePosition?: SubtitlePosition;
  transitionStyle?: TransitionStyle;
  customHookSubtitle?: string;
  customBodySubtitle?: string;
  customCtaSubtitle?: string;
  estimatedDuration: number;
  status: 'pronto' | 'gerando';
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  clipsCount: number;
  videosGenerated: number;
  status: 'Ativo' | 'Arquivado' | 'Rascunho';
  niche?: string;
  productKeyword?: string;
  hooks: VideoClip[];
  bodies: VideoClip[];
  ctas: VideoClip[];
  headlines: string[];
  headlineStyle?: HeadlineStyle;
  antiShadowbanEnabled: boolean;
  autoSubtitlesEnabled: boolean;
  subtitleStyle: SubtitleStyle;
  subtitlePosition?: SubtitlePosition;
  transitionStyle?: TransitionStyle;
  aiCorrectionEnabled: boolean;
  generatedVariations: CreativeVariation[];
}

export type ProductPhysicalAction =
  | 'Mostrando para a câmera em close'
  | 'Aplicando/Usando na prática'
  | 'Apontando para o produto na mesa'
  | 'Unboxing / Abrindo a caixa';

export type AudioEnvironmentStyle =
  | 'Voz Limpa de Microfone de Lapela'
  | 'Áudio Orgânico de Celular com Acústica de Quarto'
  | 'Voz Empolgada + Som Ambiente Sutil';

export interface VeoPromptConfig {
  objective: 'Personagem Livre' | 'UGC Vendas (TikTok Shop)';
  niche: string;
  productName: string;
  productUrl?: string;
  productVisualDescription: string;
  productPhysicalAction: ProductPhysicalAction;
  gender: 'Masculino' | 'Feminino';
  ageGroup: 'Jovem (18-25)' | 'Adulto (26-39)' | 'Maduro (40-60)' | 'Sênior (60+)';
  profession: 'Criador UGC Casual' | 'Especialista Técnico' | 'Vendedor Empolgado' | 'Dona de Casa Prática';
  visualStyle: 'Camiseta Básica' | 'Camisa Casual' | 'Moletom Street' | 'Uniforme/Avental';
  environment: 'Home Office' | 'Cozinha/Sala Real' | 'Oficina/Bancada' | 'Estúdio LED';
  posture: 'Segurando Produto no Close' | 'Sentado na Mesa' | 'Em Pé Gesticulando';
  mood: 'Entusiasmado/Chocado' | 'Confiante/Autoridade' | 'Curioso/Segredo';
  framing: 'Close-Up 9:16' | 'Plano Médio' | 'POV Primeira Pessoa';
  movementLighting: 'Handheld (Câmera na Mão) + Luz Natural' | 'Zoom In Rápido + Ring Light' | 'Estático + Cinematográfica';
  audioEnvironmentStyle: AudioEnvironmentStyle;
  scriptPtBr: string;
  sceneDialoguesPtBr?: string[];
  sceneCount: 2 | 3 | 4 | 5;
  consistencySeed: number;
}

export type Veo3SceneRole = 'HOOK' | 'BODY' | 'CTA';

export interface Veo3SceneOutput {
  scene_id: number;
  duration: '8s';
  role: Veo3SceneRole;
  master_prompt_veo3: string;
  spoken_dialogue_ptbr: string;
  sound_design: string;
}

export interface Veo3CompiledOutput {
  project_metadata: {
    engine: 'Google_Veo_3_Pro';
    aspect_ratio: '9:16';
    fps: 24;
    consistency_seed: number;
  };
  character_lock_bible: string;
  product_lock_bible: string;
  negative_prompt: string;
  scenes: Veo3SceneOutput[];
}

export interface ViralVideoReference {
  id: string;
  videoTitle: string;
  hookPtBr: string;
  views: string;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount?: number;
  authorName: string;
  authorUsername: string;
  videoUrl?: string;
  coverUrl?: string;
  audioTrack?: string;
  durationSec?: number;
}

export interface TrendingItem {
  id: string;
  title: string;
  product: string;
  niche: string;
  views: string;
  viewsCount: number;
  ctrEstimate: string;
  engagement: string;
  salesVelocity: string;
  salesCountDaily?: number;
  viralHook: string;
  suggestedHeadlines: string[];
  audioTrack: string;
  tiktokShopBadge: boolean;
  avatarSeed: string;
  // Brazilian Best-Selling Product Intelligence
  rankPosition?: number;
  region?: string;
  priceBrl?: string;
  revenueEstimateBrl?: string;
  productDescriptionPtBr?: string;
  whyItsSellingPtBr?: string;
  shopeeSearchUrl?: string;
  tiktokShopSearchUrl?: string;
  mercadoLivreSearchUrl?: string;
  viralVideos?: ViralVideoReference[];
  // Live Apify scraping metadata
  source?: 'apify' | 'calibrated';
  videoUrl?: string;
  authorName?: string;
  authorUsername?: string;
  coverUrl?: string;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  savesCount?: number;
}

export interface AppSettings {
  openRouterApiKey: string;
  openRouterModel: string;
  apifyToken: string;
}

export type UserRole = 'Admin' | 'Cliente';
export type StatusPlano = 'Trial_3_Dias' | 'Ativo_Anual' | 'Expirado' | 'Bloqueado';

export interface UsuarioLicenca {
  ID_Usuario: string;
  Nome: string;
  Email: string;
  WhatsApp: string;
  Senha?: string;
  Role: UserRole;
  Status_Plano: StatusPlano;
  Data_Cadastro: string;
  Data_Expiracao: string;
  Valor_Licenca: number;
  Data_Ultimo_Pagamento?: string | null;
  // Cloud-synced API keys per user across PC & Mobile
  OpenRouter_ApiKey?: string;
  OpenRouter_Model?: string;
  Apify_Token?: string;
}
