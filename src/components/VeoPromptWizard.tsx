import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  Copy, 
  Check, 
  Download, 
  RefreshCw, 
  Wand2, 
  Layers, 
  ShieldCheck, 
  Zap,
  Mic,
  Package,
  Film,
  Code2,
  Lock,
  Volume2,
  Eye,
  Hand,
  Trash2
} from 'lucide-react';
import { 
  VeoPromptConfig, 
  ProductPhysicalAction, 
  AudioEnvironmentStyle, 
  Veo3CompiledOutput,
  TrendingItem
} from '../types';
import { 
  generateVeoScriptWithAi, 
  analyzeProductLinkOrName, 
  optimizeVeoScript3x3x3, 
  buildLocalVeo3MasterJson, 
  compileVeo3MasterJson,
  resolveSceneDialogues
} from '../services/aiService';

export const INITIAL_VEO_CONFIG: VeoPromptConfig = {
  objective: 'UGC Vendas (TikTok Shop)',
  niche: 'Tecnologia & Ferramentas',
  productName: '',
  productUrl: '',
  productVisualDescription: '',
  productPhysicalAction: 'Mostrando para a câmera em close',
  gender: 'Feminino',
  ageGroup: 'Jovem (18-25)',
  profession: 'Criador UGC Casual',
  visualStyle: 'Camiseta Básica',
  environment: 'Home Office',
  posture: 'Segurando Produto no Close',
  mood: 'Entusiasmado/Chocado',
  framing: 'Close-Up 9:16',
  movementLighting: 'Handheld (Câmera na Mão) + Luz Natural',
  audioEnvironmentStyle: 'Voz Limpa de Microfone de Lapela',
  scriptPtBr: '',
  sceneDialoguesPtBr: ['', '', ''],
  sceneCount: 3,
  consistencySeed: 7894201,
};

const PHYSICAL_ACTIONS: { id: ProductPhysicalAction; label: string; desc: string }[] = [
  {
    id: 'Mostrando para a câmera em close',
    label: 'Mostrando para a câmera em close',
    desc: 'Foco nítido no rótulo/textura em primeiro plano com mão firme.',
  },
  {
    id: 'Aplicando/Usando na prática',
    label: 'Aplicando/Usando na prática',
    desc: 'Demonstração real de funcionamento e física do produto ao vivo.',
  },
  {
    id: 'Apontando para o produto na mesa',
    label: 'Apontando para o produto na mesa',
    desc: 'Apresentador gesticula e aponta para o item apoiado na bancada.',
  },
  {
    id: 'Unboxing / Abrindo a caixa',
    label: 'Unboxing / Abrindo a caixa',
    desc: 'Retirando o produto da embalagem original com reação espontânea.',
  },
];

const AUDIO_STYLES: { id: AudioEnvironmentStyle; label: string; desc: string }[] = [
  {
    id: 'Voz Limpa de Microfone de Lapela',
    label: 'Voz Limpa de Microfone de Lapela',
    desc: 'Captação seca e cristalina de criador profissional sem eco de sala.',
  },
  {
    id: 'Áudio Orgânico de Celular com Acústica de Quarto',
    label: 'Áudio Orgânico de Celular com Acústica de Quarto',
    desc: 'Som hiper-realista de iPhone nativo com reverberação natural de ambiente.',
  },
  {
    id: 'Voz Empolgada + Som Ambiente Sutil',
    label: 'Voz Empolgada + Som Ambiente Sutil',
    desc: 'Projeção vocal dinâmica com foley tátil nítido do manuseio do produto.',
  },
];

interface VeoPromptWizardProps {
  initialTrendingProduct?: TrendingItem | null;
}

export const VeoPromptWizard: React.FC<VeoPromptWizardProps> = ({ initialTrendingProduct }) => {
  const [config, setConfig] = useState<VeoPromptConfig>(INITIAL_VEO_CONFIG);
  const [currentStep, setCurrentStep] = useState(1);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isOptimizing3x3x3, setIsOptimizing3x3x3] = useState(false);
  const [isAnalyzingProduct, setIsAnalyzingProduct] = useState(false);
  const [isCompilingPrompt, setIsCompilingPrompt] = useState(false);

  // Compiled output state
  const [compiledOutput, setCompiledOutput] = useState<Veo3CompiledOutput>(() =>
    buildLocalVeo3MasterJson(INITIAL_VEO_CONFIG)
  );
  const [activeOutputTab, setActiveOutputTab] = useState<'scenes' | 'json'>('scenes');
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedSceneId, setCopiedSceneId] = useState<number | null>(null);
  const [copiedLock, setCopiedLock] = useState<'char' | 'prod' | null>(null);

  const outputSectionRef = useRef<HTMLDivElement>(null);

  const totalSteps = 14;

  // Hydrate when a product is sent from Trending Radar Brasil
  useEffect(() => {
    if (!initialTrendingProduct) return;
    const hookScene = initialTrendingProduct.viralHook || `Para tudo! Olha o que esse ${initialTrendingProduct.product} faz em segundos!`;
    const bodyScene = `Eu testei aqui em casa o ${initialTrendingProduct.product} que é o mais vendido no Brasil e o resultado na prática é surreal!`;
    const ctaScene = `Clica agora no carrinho laranja aqui embaixo e garante o seu ${initialTrendingProduct.product} com desconto antes que acabe no Brasil!`;
    const scenes = [hookScene, bodyScene, ctaScene];

    setConfig((prev) => ({
      ...prev,
      objective: 'UGC Vendas (TikTok Shop)',
      niche: initialTrendingProduct.niche || prev.niche,
      productName: initialTrendingProduct.product,
      productUrl: initialTrendingProduct.shopeeSearchUrl || initialTrendingProduct.videoUrl || '',
      productVisualDescription:
        initialTrendingProduct.productDescriptionPtBr ||
        `${initialTrendingProduct.product} com acabamento premium, proporção real na mão do apresentador e detalhes nítidos de embalagem.`,
      productPhysicalAction: 'Aplicando/Usando na prática',
      scriptPtBr: scenes.join(' '),
      sceneDialoguesPtBr: scenes,
      sceneCount: 3,
    }));
  }, [initialTrendingProduct]);

  // Keep local preview synchronized whenever config changes
  useEffect(() => {
    setCompiledOutput(buildLocalVeo3MasterJson(config));
  }, [config]);

  const handleSelectOption = (field: keyof VeoPromptConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    if (autoAdvance && currentStep < totalSteps) {
      setTimeout(() => {
        setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
      }, 150);
    }
  };

  const handleAnalyzeProduct = async () => {
    if (!config.productName.trim()) return;
    setIsAnalyzingProduct(true);
    try {
      const res = await analyzeProductLinkOrName(config.productName);
      setConfig((prev) => ({
        ...prev,
        niche: res.niche,
        productVisualDescription: res.visualDescription,
        scriptPtBr: res.suggestedScript,
        sceneDialoguesPtBr: undefined,
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzingProduct(false);
    }
  };

  const handleGenerateScript = async () => {
    setIsGeneratingScript(true);
    try {
      const script = await generateVeoScriptWithAi(config);
      setConfig((prev) => ({
        ...prev,
        scriptPtBr: script,
        sceneDialoguesPtBr: undefined,
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleOptimize3x3x3 = async () => {
    setIsOptimizing3x3x3(true);
    try {
      const optimized = await optimizeVeoScript3x3x3(config);
      setConfig((prev) => ({
        ...prev,
        scriptPtBr: optimized.fullScript,
        sceneDialoguesPtBr: optimized.sceneDialogues,
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsOptimizing3x3x3(false);
    }
  };

  const handleUpdateSceneDialogue = (sceneIndex: number, newText: string) => {
    const currentDialogues = [...resolveSceneDialogues(config)];
    currentDialogues[sceneIndex] = newText;
    setConfig((prev) => ({
      ...prev,
      sceneDialoguesPtBr: currentDialogues,
      scriptPtBr: currentDialogues.filter((s) => s.trim().length > 0).join(' '),
    }));
  };

  const handleClearAllScripts = () => {
    const count = config.sceneCount || 3;
    setConfig((prev) => ({
      ...prev,
      scriptPtBr: '',
      sceneDialoguesPtBr: Array(count).fill(''),
    }));
  };

  const handleCompileMasterPrompt = async () => {
    setIsCompilingPrompt(true);
    try {
      const compiled = await compileVeo3MasterJson(config);
      setCompiledOutput(compiled);
      setTimeout(() => {
        outputSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCompilingPrompt(false);
    }
  };

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(compiledOutput, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const handleCopyScenePrompt = (sceneId: number, promptText: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedSceneId(sceneId);
    setTimeout(() => setCopiedSceneId(null), 2500);
  };

  const handleCopyLockBible = (type: 'char' | 'prod', text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLock(type);
    setTimeout(() => setCopiedLock(null), 2000);
  };

  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(compiledOutput, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veo3_pro_master_${config.niche.replace(/\s+/g, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentSceneDialogues = resolveSceneDialogues(config);

  const getSceneRoleLabel = (role: 'HOOK' | 'BODY' | 'CTA', idx: number) => {
    if (role === 'HOOK') return `Cena ${idx}: Gancho (HOOK)`;
    if (role === 'CTA') return `Cena ${idx}: Chamada p/ Ação (CTA)`;
    return `Cena ${idx}: Corpo / Demonstração (BODY)`;
  };

  const countWords = (text: string) =>
    text
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-purple-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-fuchsia-400 font-semibold tracking-wider uppercase">
            <span>Google Veo 3 Pro</span>
            <span>·</span>
            <span>Character Lock + Lip-Sync pt-BR + Física Realista</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex flex-wrap items-center gap-3">
            <span>Engenharia de Prompt VEO 3</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-fuchsia-300 border border-purple-500/30">
              CHARACTER LOCK
            </span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              8s / CENA (24 FPS)
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Motor profissional de prompts cinematográficos e UGC com consistência imutável de rosto, física de produto e sincronia labial em Português do Brasil.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-purple-500/40"
            />
            <span>Auto-avançar etapas</span>
          </label>
        </div>
      </div>

      {/* Progress Bar Strip */}
      <div className="glass-card rounded-2xl p-4 border border-purple-500/20">
        <div className="flex items-center justify-between text-xs font-mono mb-2">
          <span className="text-purple-300 font-bold">
            Etapa {currentStep} de {totalSteps}
          </span>
          <span className="text-slate-400">
            {Math.round((currentStep / totalSteps) * 100)}% configurado
          </span>
        </div>
        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-purple-500/20">
          <div
            className="bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 h-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step dots for quick jumping */}
        <div className="flex items-center gap-1.5 sm:justify-between mt-3 pt-2 border-t border-purple-500/10 overflow-x-auto pb-1.5 no-scrollbar shrink-0">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i + 1)}
              className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full text-[11px] sm:text-[10px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                currentStep === i + 1
                  ? 'bg-fuchsia-500 text-white shadow-[0_0_10px_#d946ef]'
                  : currentStep > i + 1
                  ? 'bg-purple-900/60 text-purple-300 border border-purple-500/40'
                  : 'bg-slate-900 text-slate-500 hover:text-slate-300'
              }`}
              aria-label={`Ir para etapa ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Step Content Card */}
      <div className="glass-card rounded-3xl p-6 md:p-8 border border-purple-500/30 min-h-[420px] flex flex-col justify-between">
        {/* Step 1: Objetivo */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-mono text-purple-400 font-bold">
                Etapa 1 · Arquitetura Comercial
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Qual é o Objetivo do Criativo?</h3>
              <p className="text-xs text-slate-400">
                Selecione o formato de intenção comercial para o motor calibrar a lente, a ação física e o lip-sync.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {[
                {
                  id: 'UGC Vendas (TikTok Shop)',
                  title: 'UGC Vendas (TikTok Shop)',
                  desc: 'Foco em conversão direta, unboxing realista, prova social e chamada imediata para o carrinho.',
                },
                {
                  id: 'Personagem Livre',
                  title: 'Personagem Livre & Storytelling',
                  desc: 'Foco em retenção orgânica, conexão emocional e narrativa cinematográfica consistente.',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption('objective', opt.id)}
                  className={`p-5 rounded-2xl text-left border transition-all cursor-pointer ${
                    config.objective === opt.id
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-base font-bold text-white mb-1">{opt.title}</h4>
                  <p className="text-xs text-slate-300">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Nicho do Produto */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-mono text-purple-400 font-bold">
                Etapa 2 · Segmentação Visual
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Selecione o Nicho do Produto</h3>
              <p className="text-xs text-slate-400">
                Define a direção de arte, temperatura de iluminação e adereços de fundo (props) brasileiros.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {[
                'Beleza & Skincare',
                'Tecnologia & Ferramentas',
                'Moda & Estilo',
                'Saúde & Fitness',
                'Casa & Cozinha',
              ].map((niche) => (
                <button
                  key={niche}
                  onClick={() => handleSelectOption('niche', niche)}
                  className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                    config.niche === niche
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-sm font-bold text-white">{niche}</h4>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Link/Nome do Produto + Descrição Visual + Ação Física */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs uppercase font-mono text-fuchsia-400 font-bold">
                Etapa 3 · Product Lock Bible & Física Realista
              </span>
              <h3 className="text-xl font-bold text-white mt-1">
                Identificação, Descrição Visual e Ação Física com o Produto
              </h3>
              <p className="text-xs text-slate-400">
                Estes parâmetros travam a geometria, cor e escala do produto (`product_lock_bible`) nas mãos do apresentador em todas as cenas.
              </p>
            </div>

            <div className="space-y-5">
              {/* Nome ou Link do Produto */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>Nome ou Link do Produto</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={config.productName}
                    onChange={(e) => setConfig({ ...config, productName: e.target.value })}
                    placeholder="Ex: Escova Elétrica Modeladora 5 em 1..."
                    className="flex-1 bg-slate-950 border border-purple-500/30 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500"
                  />
                  <button
                    onClick={handleAnalyzeProduct}
                    disabled={isAnalyzingProduct}
                    className="px-4 py-3 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-500 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isAnalyzingProduct ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    <span>Auto-Preencher com IA</span>
                  </button>
                </div>
              </div>

              {/* Novo Campo: Descrição Visual do Produto */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Descrição Visual do Produto (Product Lock)</span>
                </label>
                <textarea
                  rows={2}
                  value={config.productVisualDescription}
                  onChange={(e) =>
                    setConfig({ ...config, productVisualDescription: e.target.value })
                  }
                  placeholder="Ex: Embalagem cilíndrica rosa fosco de 15cm, tampa dourada metálica, cabe na palma da mão, textura acetinada..."
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-fuchsia-500 leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  Especifique cor da embalagem, tamanho na mão e textura para evitar distorções de rótulo ou proporção no Veo 3.
                </p>
              </div>

              {/* Novo Seletor: Ação Física com o Produto */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Hand className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ação Física com o Produto</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PHYSICAL_ACTIONS.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setConfig({ ...config, productPhysicalAction: act.id })}
                      className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                        config.productPhysicalAction === act.id
                          ? 'glass-card-active'
                          : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                      }`}
                    >
                      <div className="text-xs font-bold text-white mb-0.5">{act.label}</div>
                      <div className="text-[11px] text-slate-400">{act.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Gênero */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-mono text-purple-400 font-bold">
                Etapa 4 · Character Lock Bible
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Gênero do Personagem</h3>
              <p className="text-xs text-slate-400">
                Selecione o perfil do apresentador brasileiro gerado pelo Veo 3.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 max-w-md">
              {['Feminino', 'Masculino'].map((g) => (
                <button
                  key={g}
                  onClick={() => handleSelectOption('gender', g)}
                  className={`p-5 rounded-2xl text-center border transition-all cursor-pointer ${
                    config.gender === g
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-base font-bold text-white">{g}</h4>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Faixa Etária */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-mono text-purple-400 font-bold">
                Etapa 5 · Character Lock Bible
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Faixa Etária do Apresentador</h3>
              <p className="text-xs text-slate-400">
                Trava a idade exata e a textura dérmica realista (poros visíveis, sem pele plástica) em todas as tomadas.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                'Jovem (18-25)',
                'Adulto (26-39)',
                'Maduro (40-60)',
                'Sênior (60+)',
              ].map((age) => (
                <button
                  key={age}
                  onClick={() => handleSelectOption('ageGroup', age)}
                  className={`p-4 rounded-2xl text-center border transition-all cursor-pointer ${
                    config.ageGroup === age
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-sm font-bold text-white">{age}</h4>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Profissão / Arquétipo */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-mono text-purple-400 font-bold">
                Etapa 6 · Persona & Cadência
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Profissão ou Arquétipo do Criador</h3>
              <p className="text-xs text-slate-400">
                Define a postura comunicativa e a naturalidade da fala diante da lente.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                'Criador UGC Casual',
                'Especialista Técnico',
                'Vendedor Empolgado',
                'Dona de Casa Prática',
              ].map((arch) => (
                <button
                  key={arch}
                  onClick={() => handleSelectOption('profession', arch)}
                  className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                    config.profession === arch
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-sm font-bold text-white">{arch}</h4>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 7: Visual / Roupa */}
        {currentStep === 7 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-mono text-purple-400 font-bold">
                Etapa 7 · Wardrobe Lock
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Estilo Visual / Vestimenta</h3>
              <p className="text-xs text-slate-400">
                Mantém exatamente a mesma roupa entre o Gancho, o Corpo e o CTA para continuidade absoluta.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                'Camiseta Básica',
                'Camisa Casual',
                'Moletom Street',
                'Uniforme/Avental',
              ].map((style) => (
                <button
                  key={style}
                  onClick={() => handleSelectOption('visualStyle', style)}
                  className={`p-4 rounded-2xl text-center border transition-all cursor-pointer ${
                    config.visualStyle === style
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-sm font-bold text-white">{style}</h4>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 8: Ambiente */}
        {currentStep === 8 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-mono text-purple-400 font-bold">
                Etapa 8 · Cenografia Realista
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Ambiente da Gravação</h3>
              <p className="text-xs text-slate-400">
                O fundo reproduz uma residência ou bancada brasileira autêntica com desfoque óptico natural.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                'Home Office',
                'Cozinha/Sala Real',
                'Oficina/Bancada',
                'Estúdio LED',
              ].map((env) => (
                <button
                  key={env}
                  onClick={() => handleSelectOption('environment', env)}
                  className={`p-4 rounded-2xl text-center border transition-all cursor-pointer ${
                    config.environment === env
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-sm font-bold text-white">{env}</h4>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 9: Postura */}
        {currentStep === 9 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-mono text-purple-400 font-bold">
                Etapa 9 · Blocking Corporal
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Postura Corporal Principal</h3>
              <p className="text-xs text-slate-400">
                Posição base do apresentador no início de cada tomada de 8 segundos.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {[
                'Segurando Produto no Close',
                'Sentado na Mesa',
                'Em Pé Gesticulando',
              ].map((pos) => (
                <button
                  key={pos}
                  onClick={() => handleSelectOption('posture', pos)}
                  className={`p-4 rounded-2xl text-center border transition-all cursor-pointer ${
                    config.posture === pos
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-sm font-bold text-white">{pos}</h4>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 10: Humor / Energia */}
        {currentStep === 10 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-mono text-purple-400 font-bold">
                Etapa 10 · Micro-Expressões Faciais
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Humor e Nível de Energia</h3>
              <p className="text-xs text-slate-400">
                Expressão facial que trava a atenção nos primeiros segundos do vídeo.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {[
                'Entusiasmado/Chocado',
                'Confiante/Autoridade',
                'Curioso/Segredo',
              ].map((m) => (
                <button
                  key={m}
                  onClick={() => handleSelectOption('mood', m)}
                  className={`p-4 rounded-2xl text-center border transition-all cursor-pointer ${
                    config.mood === m
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-sm font-bold text-white">{m}</h4>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 11: Enquadramento & Câmera */}
        {currentStep === 11 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-mono text-purple-400 font-bold">
                Etapa 11 · Óptica 35mm / 50mm
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Enquadramento da Lente (9:16)</h3>
              <p className="text-xs text-slate-400">
                Formato vertical 9:16 nativo a 24fps com distância focal calibrada.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {[
                'Close-Up 9:16',
                'Plano Médio',
                'POV Primeira Pessoa',
              ].map((frame) => (
                <button
                  key={frame}
                  onClick={() => handleSelectOption('framing', frame)}
                  className={`p-4 rounded-2xl text-center border transition-all cursor-pointer ${
                    config.framing === frame
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-sm font-bold text-white">{frame}</h4>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 12: Movimento & Iluminação */}
        {currentStep === 12 && (
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-mono text-purple-400 font-bold">
                Etapa 12 · Fotografia & Movimento
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Movimento de Câmera e Iluminação</h3>
              <p className="text-xs text-slate-400">
                Diretrizes cinemáticas que guiam os vetores ópticos do Google Veo 3.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {[
                'Handheld (Câmera na Mão) + Luz Natural',
                'Zoom In Rápido + Ring Light',
                'Estático + Cinematográfica',
              ].map((mov) => (
                <button
                  key={mov}
                  onClick={() => handleSelectOption('movementLighting', mov)}
                  className={`p-4 rounded-2xl text-center border transition-all cursor-pointer ${
                    config.movementLighting === mov
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-sm font-bold text-white">{mov}</h4>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 13: Roteiro em PT-BR + Otimizador 3x3x3 (8s) + Estilo de Áudio/Ambiente */}
        {currentStep === 13 && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <span className="text-xs uppercase font-mono text-fuchsia-400 font-bold">
                  Etapa 13 · Lip-Sync pt-BR (8s por Cena) & Sound Design
                </span>
                <h3 className="text-xl font-bold text-white mt-1">
                  Roteiro Sincronizado & Estilo de Áudio/Ambiente
                </h3>
                <p className="text-xs text-slate-400">
                  Otimize o roteiro em blocos de 15 a 20 palavras por cena (tempo exato de 8s do Veo 3) estruturados em Gancho → Benefício → CTA.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOptimize3x3x3}
                  disabled={isOptimizing3x3x3}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {isOptimizing3x3x3 ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Otimizando 8s/Cena...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>⚡ Otimizar Roteiro 3x3x3 com IA (8s por cena)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleGenerateScript}
                  disabled={isGeneratingScript}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-fuchsia-300 bg-fuchsia-950/50 hover:bg-fuchsia-900/60 border border-fuchsia-500/40 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingScript ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                  )}
                  <span>Novo Roteiro IA</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAllScripts}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 transition-colors cursor-pointer"
                  title="Apagar definitivamente todos os roteiros das cenas"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Apagar Roteiros</span>
                </button>
              </div>
            </div>

            {/* Blocos de 8s por Cena (Gancho -> Corpo -> CTA) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {currentSceneDialogues.map((sceneText, idx) => {
                const role: 'HOOK' | 'BODY' | 'CTA' =
                  idx === 0 ? 'HOOK' : idx === currentSceneDialogues.length - 1 ? 'CTA' : 'BODY';
                const wordCount = countWords(sceneText);
                const isIdealLength = wordCount >= 12 && wordCount <= 23;

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-950/90 border border-purple-500/25 flex flex-col justify-between space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          role === 'HOOK'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : role === 'BODY'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {role === 'HOOK'
                          ? `CENA ${idx + 1} · GANCHO DE CHOQUE`
                          : role === 'CTA'
                          ? `CENA ${idx + 1} · CTA CARRINHO`
                          : `CENA ${idx + 1} · BENEFÍCIO`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono ${
                            isIdealLength ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {wordCount} palavras (8s)
                        </span>
                        {sceneText.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleUpdateSceneDialogue(idx, '')}
                            title={`Apagar fala da Cena ${idx + 1}`}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      rows={3}
                      value={sceneText}
                      onChange={(e) => handleUpdateSceneDialogue(idx, e.target.value)}
                      placeholder={`Digite ou gere com IA a fala em português da Cena ${idx + 1} (8 segundos)...`}
                      className="w-full bg-slate-900/80 border border-purple-500/20 rounded-xl p-2.5 text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-fuchsia-500 placeholder:text-slate-600"
                    />
                  </div>
                );
              })}
            </div>

            {/* Novo Seletor: Estilo de Áudio/Ambiente */}
            <div className="space-y-2 pt-2 border-t border-purple-500/15">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Estilo de Áudio / Ambiente (Sound Design & Foley)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {AUDIO_STYLES.map((aud) => (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => setConfig({ ...config, audioEnvironmentStyle: aud.id })}
                    className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                      config.audioEnvironmentStyle === aud.id
                        ? 'glass-card-active'
                        : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                    }`}
                  >
                    <div className="text-xs font-bold text-white mb-0.5 flex items-center gap-1.5">
                      <Mic className="w-3 h-3 text-fuchsia-400 shrink-0" />
                      <span>{aud.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{aud.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 14: Configurações Finais & Compilação do JSON */}
        {currentStep === 14 && (
          <div className="space-y-6">
            <div>
              <span className="text-xs uppercase font-mono text-emerald-400 font-bold">
                Etapa 14 (Final) · Compilador Google Veo 3 Pro
              </span>
              <h3 className="text-xl font-bold text-white mt-1">
                Quantidade de Cenas, Consistency Seed & Compilação Master
              </h3>
              <p className="text-xs text-slate-400">
                Cada cena possui 8 segundos a 24fps com Character Lock e Product Lock injetados identicamente.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  onClick={() =>
                    setConfig({
                      ...config,
                      sceneCount: count as 2 | 3 | 4 | 5,
                      sceneDialoguesPtBr: undefined,
                    })
                  }
                  className={`p-4 rounded-2xl text-center border transition-all cursor-pointer ${
                    config.sceneCount === count
                      ? 'glass-card-active'
                      : 'border-purple-500/20 bg-slate-950/40 hover:border-purple-500/40'
                  }`}
                >
                  <h4 className="text-base font-bold text-white font-mono">
                    {count} Cenas {count === 3 ? '(Padrão 3x3)' : ''}
                  </h4>
                  <p className="text-[11px] text-slate-400">{count * 8}s totais (8s/cena)</p>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950/70 border border-purple-500/25 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-fuchsia-400" />
                <span className="text-slate-300">Consistency Seed (Character Lock):</span>
                <span className="text-fuchsia-400 font-bold text-sm">#{config.consistencySeed}</span>
              </div>
              <button
                onClick={() =>
                  setConfig({
                    ...config,
                    consistencySeed: Math.floor(1000000 + Math.random() * 9000000),
                  })
                }
                className="text-xs text-purple-300 hover:text-white underline cursor-pointer self-start sm:self-auto"
              >
                Sortear nova semente fixa
              </button>
            </div>

            {/* Botão Principal de Compilação */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCompileMasterPrompt}
                disabled={isCompilingPrompt}
                className="w-full py-4 rounded-2xl font-extrabold text-sm text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(217,70,239,0.45)] flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isCompilingPrompt ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Compilando Character Lock & Cenas Veo 3...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>⚡ Gerar Prompt Master VEO 3 (Character Lock + Lip-Sync pt-BR)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Wizard Navigation Footer */}
        <div className="pt-5 mt-6 border-t border-purple-500/15 flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="min-h-[44px] flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-purple-500/20 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <span className="text-xs font-mono text-slate-400">
            Etapa {currentStep} / {totalSteps}
          </span>

          {currentStep < totalSteps ? (
            <button
              onClick={() => setCurrentStep((prev) => Math.min(totalSteps, prev + 1))}
              className="min-h-[44px] flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_15px_rgba(217,70,239,0.3)] transition-all cursor-pointer"
            >
              <span>Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCompileMasterPrompt}
              disabled={isCompilingPrompt}
              className="min-h-[44px] flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Gerar Prompt</span>
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          INTERFACE DE SAÍDA DUPLA (CARDS POR CENA + JSON COMPLETO ESTRUTURADO)
         ===================================================================== */}
      <div ref={outputSectionRef} className="space-y-6">
        {/* Lock Bibles Summary Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Character Lock Bible Card */}
          <div className="glass-card rounded-2xl p-4 border border-purple-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-fuchsia-300 flex items-center gap-1.5 font-mono uppercase">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Character Lock Bible (Imutável em todas as cenas)
              </span>
              <button
                onClick={() => handleCopyLockBible('char', compiledOutput.character_lock_bible)}
                className="text-[11px] font-bold text-purple-300 hover:text-white flex items-center gap-1 bg-purple-950/50 px-2.5 py-1 rounded-lg border border-purple-500/30 cursor-pointer"
              >
                {copiedLock === 'char' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLock === 'char' ? 'Copiado!' : 'Copiar Lock'}</span>
              </button>
            </div>
            <p className="text-[11px] font-mono text-slate-300 bg-slate-950/80 p-3 rounded-xl border border-purple-500/15 leading-relaxed">
              {compiledOutput.character_lock_bible}
            </p>
          </div>

          {/* Product Lock Bible Card */}
          <div className="glass-card rounded-2xl p-4 border border-purple-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 font-mono uppercase">
                <Package className="w-4 h-4 text-amber-400" />
                Product Lock Bible (Física & Proporção Fiel)
              </span>
              <button
                onClick={() => handleCopyLockBible('prod', compiledOutput.product_lock_bible)}
                className="text-[11px] font-bold text-purple-300 hover:text-white flex items-center gap-1 bg-purple-950/50 px-2.5 py-1 rounded-lg border border-purple-500/30 cursor-pointer"
              >
                {copiedLock === 'prod' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLock === 'prod' ? 'Copiado!' : 'Copiar Lock'}</span>
              </button>
            </div>
            <p className="text-[11px] font-mono text-slate-300 bg-slate-950/80 p-3 rounded-xl border border-purple-500/15 leading-relaxed">
              {compiledOutput.product_lock_bible}
            </p>
          </div>
        </div>

        {/* Dual Output Container */}
        <div className="glass-card rounded-3xl p-5 sm:p-6 border border-purple-500/30 space-y-6">
          {/* Header & Mode Switcher Tabs */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-purple-500/15">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-fuchsia-600/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 shrink-0">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    Saída Compilada Google Veo 3 Pro
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    9:16 · 24fps · Seed #{compiledOutput.project_metadata.consistency_seed}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Copie cada cena individualmente para o Google Veo 3 / Flow ou exporte o JSON Master estruturado.
                </p>
              </div>
            </div>

            {/* Dual Mode Switcher */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-purple-500/25">
              <button
                type="button"
                onClick={() => setActiveOutputTab('scenes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeOutputTab === 'scenes'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Cards Individuais por Cena ({compiledOutput.scenes.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveOutputTab('json')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeOutputTab === 'json'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>JSON Completo Estruturado</span>
              </button>
            </div>
          </div>

          {/* ===============================================================
              ABA 1: CARDS INDIVIDUAIS POR CENA (PRONTO PARA COLAR NO VEO 3)
             =============================================================== */}
          {activeOutputTab === 'scenes' && (
            <div className="grid grid-cols-1 gap-5">
              {compiledOutput.scenes.map((scene) => {
                const isCopied = copiedSceneId === scene.scene_id;
                const roleBadgeClass =
                  scene.role === 'HOOK'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : scene.role === 'CTA'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-purple-500/20 text-purple-300 border-purple-500/40';

                return (
                  <div
                    key={scene.scene_id}
                    className="rounded-2xl bg-slate-950/85 border border-purple-500/30 p-5 space-y-4 hover:border-fuchsia-500/40 transition-all"
                  >
                    {/* Scene Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-500/15">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`text-xs font-mono font-extrabold px-3 py-1 rounded-full border ${roleBadgeClass}`}
                        >
                          {getSceneRoleLabel(scene.role, scene.scene_id)}
                        </span>
                        <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-700">
                          ⏱️ Duração: {scene.duration}
                        </span>
                        <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-fuchsia-950/60 text-fuchsia-300 border border-fuchsia-500/30">
                          🇧🇷 Lip-Sync pt-BR Ativo
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleCopyScenePrompt(scene.scene_id, scene.master_prompt_veo3)
                        }
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 ${
                          isCopied
                            ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.3)]'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Prompt da Cena {scene.scene_id} Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>📋 Copiar Prompt da Cena {scene.scene_id}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Spoken Dialogue & Sound Design Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-purple-950/25 border border-purple-500/20">
                        <span className="text-[10px] font-mono uppercase text-fuchsia-400 font-bold block mb-1">
                          🗣️ Fala Exata em Português (spoken_dialogue_ptbr)
                        </span>
                        <p className="text-xs sm:text-sm text-white font-semibold italic leading-relaxed">
                          "{scene.spoken_dialogue_ptbr}"
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-900/70 border border-purple-500/15">
                        <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block mb-1">
                          🔊 Acústica & Foley do Produto (sound_design)
                        </span>
                        <p className="text-xs text-slate-300 leading-relaxed font-mono">
                          {scene.sound_design}
                        </p>
                      </div>
                    </div>

                    {/* Master Prompt Veo 3 Box */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>PROMPT UNIFICADO VEO 3 (master_prompt_veo3):</span>
                        <span className="text-purple-300">
                          Character Lock + Product Lock + Lente + Lip-Sync pt-BR
                        </span>
                      </div>
                      <pre className="p-4 rounded-xl bg-black/60 border border-purple-500/25 text-xs font-mono text-fuchsia-100/95 whitespace-pre-wrap break-words leading-relaxed select-all">
                        {scene.master_prompt_veo3}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ===============================================================
              ABA 2: JSON COMPLETO ESTRUTURADO PARA AUTOMAÇÕES
             =============================================================== */}
          {activeOutputTab === 'json' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-3.5 rounded-2xl border border-purple-500/20">
                <div className="text-xs text-slate-300">
                  <span className="font-bold text-white">Arquitetura JSON Master:</span> Inclui{' '}
                  <code className="text-fuchsia-300">project_metadata</code>,{' '}
                  <code className="text-fuchsia-300">character_lock_bible</code>,{' '}
                  <code className="text-fuchsia-300">product_lock_bible</code>,{' '}
                  <code className="text-fuchsia-300">negative_prompt</code> e array{' '}
                  <code className="text-fuchsia-300">scenes</code>.
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_15px_rgba(168,85,247,0.35)] transition-all cursor-pointer"
                  >
                    {copiedJson ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedJson ? 'JSON Master Copiado!' : '📋 Copiar JSON Master'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 border border-purple-500/30 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar .JSON</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <pre className="p-4 sm:p-5 rounded-2xl bg-slate-950/95 border border-purple-500/25 text-[11px] sm:text-xs font-mono text-fuchsia-200/95 overflow-x-auto max-h-[540px] leading-relaxed">
                  {JSON.stringify(compiledOutput, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
