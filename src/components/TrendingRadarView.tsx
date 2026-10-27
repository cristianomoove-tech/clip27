import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Eye,
  Percent,
  ShoppingBag,
  Music,
  Layers,
  Flame,
  RefreshCw,
  Filter,
  CheckCircle2,
  ExternalLink,
  Key,
  ShieldCheck,
  Sliders,
  Radio,
  Share2,
  MessageCircle,
  ThumbsUp,
  Play,
  Bookmark,
  Trophy,
  DollarSign,
  Copy,
  Check,
  Video,
  TrendingUp,
} from 'lucide-react';
import { TrendingItem, ViralVideoReference } from '../types';
import { fetchTrendingVirals } from '../services/trendingService';
import { validateApifyToken, ApifyUserInfo } from '../services/apifyService';
import { getStoredSettings, saveStoredSettings } from '../services/aiService';

interface TrendingRadarViewProps {
  onCloneToStudio: (item: TrendingItem) => void;
  onSendToVeo3?: (item: TrendingItem) => void;
}

type SortMode = 'sales_br' | 'views_viral' | 'ctr_high';

export const TrendingRadarView: React.FC<TrendingRadarViewProps> = ({
  onCloneToStudio,
  onSendToVeo3,
}) => {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [selectedNiche, setSelectedNiche] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('sales_br');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [clonedId, setClonedId] = useState<string | null>(null);
  const [copiedHookId, setCopiedHookId] = useState<string | null>(null);

  // Track which viral video tab is active inside each product card
  const [selectedVideoIdxByCard, setSelectedVideoIdxByCard] = useState<Record<string, number>>({});

  // Apify state
  const [apifyToken, setApifyToken] = useState('');
  const [apifyUser, setApifyUser] = useState<ApifyUserInfo | null>(null);
  const [isVerifyingApify, setIsVerifyingApify] = useState(false);
  const [apifyStatusMessage, setApifyStatusMessage] = useState<string | null>(null);
  const [isApifyPanelOpen, setIsApifyPanelOpen] = useState(false);
  const [activeDataSource, setActiveDataSource] = useState<'apify' | 'calibrated'>('calibrated');

  const niches = [
    'Todos',
    'Beleza & Skincare',
    'Casa & Cozinha',
    'Tecnologia & Ferramentas',
    'Moda & Estilo',
    'Saúde & Fitness',
  ];

  const quickSearchTags = [
    { label: '🏆 Top Mais Vendidos Brasil', query: 'produtos mais vendidos tiktok shop brasil' },
    { label: '🔥 Achadinhos Shopee Brasil', query: 'achadinhos mais vendidos shopee brasil' },
    { label: '💄 Beleza Mais Vendidos BR', query: 'skincare beleza mais vendido brasil' },
    { label: '🏠 Cozinha Viral Brasil', query: 'utensilios cozinha mais vendidos brasil' },
    { label: '⚡ Gadgets Campeões BR', query: 'gadgets mais vendidos brasil viral' },
  ];

  // Initialize and keep Apify token synced with cloud account settings
  useEffect(() => {
    const syncFromSettings = () => {
      const settings = getStoredSettings();
      if (settings.apifyToken !== undefined) {
        setApifyToken(settings.apifyToken);
        if (settings.apifyToken.trim().length > 5) {
          verifyToken(settings.apifyToken);
        } else {
          setApifyUser(null);
        }
      }
    };

    syncFromSettings();
    window.addEventListener('clip27-settings-updated', syncFromSettings);
    return () => {
      window.removeEventListener('clip27-settings-updated', syncFromSettings);
    };
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    if (!tokenToVerify || tokenToVerify.trim().length < 5) {
      setApifyUser(null);
      return;
    }
    setIsVerifyingApify(true);
    try {
      const res = await validateApifyToken(tokenToVerify);
      if (res.valid && res.user) {
        setApifyUser(res.user);
        setApifyStatusMessage(
          `🇧🇷 Conectado à Apify: @${res.user.username} (${res.user.plan || 'Free Tier'}) — Pesquisa Brasil Ativa`
        );
      } else {
        setApifyUser(null);
        setApifyStatusMessage(res.error || 'Token da Apify não pôde ser validado.');
      }
    } catch {
      setApifyUser(null);
      setApifyStatusMessage('Erro ao conectar com a API da Apify.');
    } finally {
      setIsVerifyingApify(false);
    }
  };

  const handleSaveApifyToken = async () => {
    const clean = apifyToken.trim();
    const settings = getStoredSettings();
    const updated = { ...settings, apifyToken: clean };
    saveStoredSettings(updated);

    if (clean) {
      await verifyToken(clean);
    } else {
      setApifyUser(null);
      setApifyStatusMessage('Token removido. Modo Ranking Brasil Calibrado ativado.');
    }
    loadData(selectedNiche, searchQuery, clean);
  };

  const loadData = async (
    niche = selectedNiche,
    query = searchQuery,
    tokenOverride?: string
  ) => {
    setIsLoading(true);
    setLoadingStep('Iniciando busca de produtos mais vendidos no Brasil 🇧🇷...');

    try {
      const currentToken = tokenOverride !== undefined ? tokenOverride : getStoredSettings().apifyToken || apifyToken;
      if (apifyUser || (currentToken && currentToken.trim().length > 5)) {
        setLoadingStep('Varrendo TikTok Brasil via Apify (Produtos Mais Vendidos + Vídeos Virais)...');
      } else {
        setLoadingStep('Carregando Ranking Brasil de Produtos Mais Vendidos e Vídeos Virais...');
      }

      const result = await fetchTrendingVirals(niche, query, currentToken);
      setItems(result.items);
      setActiveDataSource(result.source);
      if (result.message) {
        setApifyStatusMessage(result.message);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setApifyStatusMessage(`Erro na busca: ${msg}`);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  useEffect(() => {
    loadData(selectedNiche, searchQuery);
  }, [selectedNiche]);

  // Sort items dynamically by user's chosen Brazilian metric
  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      if (sortMode === 'sales_br') {
        const salesA = a.salesCountDaily || parseInt(a.salesVelocity.replace(/\D/g, ''), 10) || 0;
        const salesB = b.salesCountDaily || parseInt(b.salesVelocity.replace(/\D/g, ''), 10) || 0;
        return salesB - salesA;
      }
      if (sortMode === 'views_viral') {
        return (b.viewsCount || 0) - (a.viewsCount || 0);
      }
      if (sortMode === 'ctr_high') {
        const ctrA = parseFloat(a.ctrEstimate.replace('%', '')) || 0;
        const ctrB = parseFloat(b.ctrEstimate.replace('%', '')) || 0;
        return ctrB - ctrA;
      }
      return 0;
    });
    return copy.map((item, idx) => ({
      ...item,
      rankPosition: idx + 1,
    }));
  }, [items, sortMode]);

  const handleClone = (item: TrendingItem, activeVideo?: ViralVideoReference) => {
    setClonedId(item.id);
    const enrichedItem: TrendingItem = activeVideo
      ? {
          ...item,
          viralHook: activeVideo.hookPtBr || item.viralHook,
          audioTrack: activeVideo.audioTrack || item.audioTrack,
        }
      : item;
    setTimeout(() => {
      onCloneToStudio(enrichedItem);
    }, 300);
  };

  const handleCopyHook = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHookId(id);
    setTimeout(() => setCopiedHookId(null), 2000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-purple-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1.5 text-xs text-emerald-400 font-bold tracking-wider uppercase flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              🇧🇷 MERCADO BRASIL
            </span>
            <span>·</span>
            <span className="text-fuchsia-400">PRODUTOS MAIS VENDIDOS & VÍDEOS VIRAIS</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5 flex-wrap">
            <span>Trending Radar Brasil</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" />
              TOP VENDAS BR
            </span>
            {activeDataSource === 'apify' && (
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                AO VIVO VIA APIFY (BR)
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Descubra exatamente <strong className="text-white">quais são os produtos mais vendidos no Brasil agora</strong> e veja os <strong className="text-fuchsia-300">vídeos virais desse produto que estão mais bombando</strong> para clonar no Estúdio 3x3x3 ou gerar no Google VEO 3.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsApifyPanelOpen(!isApifyPanelOpen)}
            className={`min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
              apifyUser
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/40'
                : 'bg-purple-950/40 text-purple-300 border-purple-500/30 hover:bg-purple-900/40'
            }`}
            title="Configurar Chave da API Apify"
          >
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">
              {apifyUser ? `@${apifyUser.username}` : 'Conectar Apify'}
            </span>
            {apifyUser && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          </button>

          <button
            onClick={() => loadData(selectedNiche, searchQuery)}
            disabled={isLoading}
            className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_20px_rgba(217,70,239,0.35)] transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Buscando no Brasil...' : 'Buscar Mais Vendidos BR'}</span>
          </button>
        </div>
      </div>

      {/* API Apify Integration & Brazil Product Search Bar */}
      <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/70 border border-purple-500/25 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  loadData(selectedNiche, searchQuery);
                }
              }}
              placeholder="Digite o nome de um produto ou nicho para buscar os mais vendidos no Brasil (ex: mini processador, escova, sérum)..."
              className="w-full bg-slate-900/90 border border-purple-500/30 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
            />
          </div>

          <button
            onClick={() => loadData(selectedNiche, searchQuery)}
            disabled={isLoading}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>Pesquisar Produto no Brasil</span>
          </button>
        </div>

        {/* Quick Search Tag Pills (100% Brazil Product Search) */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="text-slate-400 font-semibold mr-1">Buscas Campeãs no Brasil:</span>
          {quickSearchTags.map((tag) => (
            <button
              key={tag.label}
              onClick={() => {
                setSearchQuery(tag.query);
                loadData(selectedNiche, tag.query);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-purple-950/40 text-purple-200 hover:text-white hover:bg-purple-900/60 border border-purple-500/20 transition-colors cursor-pointer font-medium"
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* Apify Direct Configuration Box */}
        {(isApifyPanelOpen || !apifyUser) && (
          <div className="pt-3 border-t border-purple-500/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">
                  Integração API Apify (Geolocalização Brasil 🇧🇷)
                </span>
                {apifyUser ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    🟢 CONECTADO: @{apifyUser.username} ({apifyUser.plan || 'Free'})
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    🟡 Chave não configurada
                  </span>
                )}
              </div>

              <a
                href="https://console.apify.com/account/integrations"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 self-start sm:self-auto hover:underline"
              >
                <span>Pegar meu Token grátis na Apify</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="password"
                  value={apifyToken}
                  onChange={(e) => setApifyToken(e.target.value)}
                  placeholder="Cole seu token aqui: apify_api_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-slate-900 border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button
                onClick={handleSaveApifyToken}
                disabled={isVerifyingApify}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isVerifyingApify ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Validando na Apify...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Salvar & Conectar API</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Live Status Feedback Banner */}
        {apifyStatusMessage && (
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-purple-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="font-medium">{apifyStatusMessage}</span>
            </div>
            {isLoading && (
              <span className="text-[11px] text-fuchsia-300 font-mono animate-pulse">
                {loadingStep}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Niche Filter + Sort Mode Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Filter Tabs by Niche */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
          <Filter className="w-4 h-4 text-purple-400 shrink-0 mr-1 hidden sm:inline" />
          {niches.map((niche) => {
            const isActive = selectedNiche === niche;
            return (
              <button
                key={niche}
                onClick={() => setSelectedNiche(niche)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-purple-900/60 text-white border border-fuchsia-500/60 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                    : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-purple-500/15'
                }`}
              >
                {niche}
              </button>
            );
          })}
        </div>

        {/* Sort Mode Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-purple-500/20 self-start lg:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setSortMode('sales_br')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              sortMode === 'sales_br'
                ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Mais Vendidos no Brasil</span>
          </button>
          <button
            onClick={() => setSortMode('views_viral')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              sortMode === 'views_viral'
                ? 'bg-purple-500/25 text-fuchsia-200 border border-fuchsia-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-fuchsia-400" />
            <span>Vídeos Mais Bombando</span>
          </button>
          <button
            onClick={() => setSortMode('ctr_high')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
              sortMode === 'ctr_high'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Percent className="w-3.5 h-3.5 text-emerald-400" />
            <span>Maior CTR</span>
          </button>
        </div>
      </div>

      {/* Best-Selling Products & Viral Videos Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedItems.map((item, idx) => {
          const videos = item.viralVideos && item.viralVideos.length > 0
            ? item.viralVideos
            : [
                {
                  id: `${item.id}-v1`,
                  videoTitle: `Vídeo Viral #1 (${item.views} views)`,
                  hookPtBr: item.viralHook,
                  views: item.views,
                  viewsCount: item.viewsCount,
                  likesCount: item.likesCount || 420000,
                  commentsCount: item.commentsCount || 14200,
                  sharesCount: item.sharesCount || 28500,
                  savesCount: item.savesCount || 64000,
                  authorName: item.authorName || 'Criador Shop Brasil',
                  authorUsername: item.authorUsername || '@achadinhos.brasil',
                  videoUrl: item.videoUrl || `https://www.tiktok.com/search/video?q=${encodeURIComponent(item.product)}`,
                  coverUrl: item.coverUrl,
                  audioTrack: item.audioTrack,
                  durationSec: 21,
                },
              ];

          const selectedVidIndex = selectedVideoIdxByCard[item.id] ?? 0;
          const activeVideo = videos[selectedVidIndex] || videos[0];

          return (
            <div
              key={item.id}
              className="glass-card rounded-3xl p-4 sm:p-6 border border-purple-500/25 flex flex-col justify-between transition-all duration-300 hover:border-fuchsia-500/50 shadow-2xl space-y-4"
            >
              <div className="space-y-4">
                {/* 1. TOP RANKING & SALES VELOCITY BAR */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500/25 to-orange-500/25 border border-amber-500/40 text-amber-300 font-extrabold text-[11px] flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>#{item.rankPosition || idx + 1} MAIS VENDIDO BRASIL 🇧🇷</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/20">
                      {item.niche}
                    </span>
                    {item.source === 'apify' && (
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                        Apify Live BR
                      </span>
                    )}
                  </div>

                  <span className="flex items-center gap-1 text-xs font-extrabold text-amber-300 bg-amber-950/60 px-3 py-1 rounded-full border border-amber-500/40 shadow-sm">
                    <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{item.salesVelocity}</span>
                  </span>
                </div>

                {/* 2. THE BEST-SELLING PRODUCT SHOWCASE BOX (O PRODUTO) */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-purple-950/50 via-slate-900/90 to-slate-950 border border-fuchsia-500/30 space-y-3">
                  <div className="flex items-start gap-3.5">
                    {/* Product / Video Thumbnail Preview */}
                    <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl overflow-hidden bg-slate-900 border border-purple-500/30 shrink-0 relative group">
                      {activeVideo.coverUrl || item.coverUrl ? (
                        <img
                          src={activeVideo.coverUrl || item.coverUrl}
                          alt={item.product}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/80 via-fuchsia-900/50 to-slate-950 flex flex-col items-center justify-center p-2 text-center">
                          <ShoppingBag className="w-7 h-7 text-fuchsia-300 mb-1" />
                          <span className="text-[9px] font-bold text-purple-200 uppercase leading-tight">
                            Top Produto Brasil
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-1 left-1 right-1 bg-black/80 backdrop-blur-xs rounded px-1.5 py-0.5 text-center">
                        <span className="text-[10px] font-extrabold text-emerald-400">
                          {item.priceBrl || 'R$ 39,90'}
                        </span>
                      </div>
                    </div>

                    {/* Commercial Product Identification & Details */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-fuchsia-300 font-bold">
                          Produto Campeão Identificado no Brasil:
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-extrabold text-white leading-snug">
                        {item.product}
                      </h3>

                      {item.productDescriptionPtBr && (
                        <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                          {item.productDescriptionPtBr}
                        </p>
                      )}

                      {item.whyItsSellingPtBr && (
                        <div className="pt-1 flex items-start gap-1.5 text-[11px] text-emerald-300">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>
                            <strong>Por que vende tanto no BR:</strong> {item.whyItsSellingPtBr}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product Commercial KPIs in Brazil */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-purple-500/20 text-xs">
                    <div className="p-2 rounded-xl bg-slate-950/70 border border-purple-500/15">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-emerald-400" /> Preço Médio BR
                      </span>
                      <span className="font-extrabold text-emerald-400 text-sm">
                        {item.priceBrl || 'R$ 39,90'}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950/70 border border-purple-500/15">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" /> Faturamento BR
                      </span>
                      <span className="font-extrabold text-amber-300 text-xs sm:text-sm truncate block">
                        {item.revenueEstimateBrl || 'R$ 68.400/dia'}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950/70 border border-purple-500/15">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Eye className="w-3 h-3 text-purple-400" /> Views no Produto
                      </span>
                      <span className="font-extrabold text-white text-sm tabular-nums">
                        {item.views}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950/70 border border-purple-500/15">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Percent className="w-3 h-3 text-fuchsia-400" /> CTR Conversão
                      </span>
                      <span className="font-extrabold text-fuchsia-300 text-sm tabular-nums">
                        {item.ctrEstimate}
                      </span>
                    </div>
                  </div>

                  {/* Direct Links to Inspect the Product in Brazil */}
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-400">
                      Espionar oferta real no Brasil:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <a
                        href={item.shopeeSearchUrl || `https://shopee.com.br/search?keyword=${encodeURIComponent(item.product)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-orange-500/15 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                      >
                        <span>Shopee Brasil</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      <a
                        href={item.tiktokShopSearchUrl || `https://www.tiktok.com/search/video?q=${encodeURIComponent(`${item.product} brasil`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-fuchsia-500/15 hover:bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                      >
                        <span>TikTok Shop BR</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      <a
                        href={item.mercadoLivreSearchUrl || `https://lista.mercadolivre.com.br/${encodeURIComponent(item.product)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-yellow-500/15 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                      >
                        <span>Mercado Livre</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* 3. VIRAL VIDEOS OF THIS PRODUCT BLOWING UP IN BRAZIL (OS VÍDEOS VIRAIS DESSE PRODUTO) */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/90 border border-purple-500/25 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-fuchsia-400" />
                      <span className="text-xs font-extrabold text-white uppercase tracking-wide">
                        Vídeos Virais desse Produto Bombando no Brasil ({videos.length})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/25">
                      Alta Retenção 9:16
                    </span>
                  </div>

                  {/* Viral Video Selector Pills */}
                  {videos.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {videos.map((v, vIdx) => {
                        const isSelected = vIdx === selectedVidIndex;
                        return (
                          <button
                            key={v.id}
                            onClick={() =>
                              setSelectedVideoIdxByCard((prev) => ({
                                ...prev,
                                [item.id]: vIdx,
                              }))
                            }
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-sm'
                                : 'bg-purple-950/40 text-slate-300 hover:text-white border border-purple-500/20'
                            }`}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>
                              Vídeo #{vIdx + 1} ({v.views})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Active Viral Video Details */}
                  <div className="p-3 rounded-xl bg-purple-950/25 border border-purple-500/20 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-fuchsia-200 truncate">
                          {activeVideo.videoTitle}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-purple-300 shrink-0">
                        {activeVideo.authorUsername}
                      </span>
                    </div>

                    {/* Video Engagement Metrics Bar */}
                    <div className="grid grid-cols-4 gap-1.5 py-1.5 px-2.5 rounded-lg bg-slate-950/80 border border-purple-500/15 text-[10px] text-slate-300 font-mono">
                      <span className="flex items-center gap-1" title="Curtidas no Vídeo">
                        <ThumbsUp className="w-3 h-3 text-pink-400 shrink-0" />
                        <span className="truncate">{(activeVideo.likesCount || 0).toLocaleString('pt-BR')}</span>
                      </span>
                      <span className="flex items-center gap-1" title="Comentários de Compradores">
                        <MessageCircle className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="truncate">{(activeVideo.commentsCount || 0).toLocaleString('pt-BR')}</span>
                      </span>
                      <span className="flex items-center gap-1" title="Salvos / Favoritos (Intenção de Compra)">
                        <Bookmark className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{(activeVideo.savesCount || 45000).toLocaleString('pt-BR')}</span>
                      </span>
                      <span className="flex items-center gap-1" title="Compartilhamentos">
                        <Share2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{(activeVideo.sharesCount || 0).toLocaleString('pt-BR')}</span>
                      </span>
                    </div>

                    {/* Transcribed Viral Hook in PT-BR */}
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-fuchsia-500/20">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-mono uppercase text-fuchsia-400 font-bold">
                          🎤 Gancho Viral Transcrito (Primeiros 3s em PT-BR):
                        </span>
                        <button
                          onClick={() => handleCopyHook(activeVideo.id, activeVideo.hookPtBr)}
                          className="text-[10px] text-purple-300 hover:text-white flex items-center gap-1 cursor-pointer"
                          title="Copiar gancho viral"
                        >
                          {copiedHookId === activeVideo.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar Fala</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-white italic leading-relaxed">
                        "{activeVideo.hookPtBr}"
                      </p>
                    </div>

                    {/* Audio & Direct Watch Viral Video Link */}
                    <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-400 truncate">
                        <Music className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="truncate">{activeVideo.audioTrack || item.audioTrack}</span>
                      </div>

                      <a
                        href={
                          activeVideo.videoUrl ||
                          item.videoUrl ||
                          `https://www.tiktok.com/search/video?q=${encodeURIComponent(`${item.product} viral brasil`)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-fuchsia-600/25 hover:bg-fuchsia-600/40 text-fuchsia-200 border border-fuchsia-500/40 font-bold flex items-center gap-1.5 shrink-0 transition-all"
                      >
                        <Play className="w-3 h-3 fill-current text-fuchsia-300" />
                        <span>Assistir Vídeo Viral no TikTok</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. ACTION BUTTONS: CLONE TO STUDIO 3x3x3 OR SEND TO VEO 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={() => handleClone(item, activeVideo)}
                  className={`min-h-[44px] w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-white transition-all cursor-pointer ${
                    clonedId === item.id
                      ? 'bg-emerald-600'
                      : 'bg-purple-600/90 hover:bg-purple-500 border border-purple-400/30 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                  }`}
                >
                  {clonedId === item.id ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Clonado para o Estúdio!</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      <span>Clonar no Estúdio 3x3x3</span>
                    </>
                  )}
                </button>

                {onSendToVeo3 && (
                  <button
                    onClick={() =>
                      onSendToVeo3({
                        ...item,
                        viralHook: activeVideo.hookPtBr || item.viralHook,
                      })
                    }
                    className="min-h-[44px] w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 shadow-[0_0_15px_rgba(217,70,239,0.3)] transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Gerar Prompt VEO 3 do Produto</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
