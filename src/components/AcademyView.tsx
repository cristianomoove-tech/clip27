import React from 'react';
import { 
  GraduationCap, 
  Layers, 
  ShieldCheck, 
  Sparkles, 
  Flame, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Zap,
  Target,
  Video
} from 'lucide-react';

interface AcademyViewProps {
  onGoToStudio: () => void;
  onGoToVeo: () => void;
}

export const AcademyView: React.FC<AcademyViewProps> = ({
  onGoToStudio,
  onGoToVeo,
}) => {
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-purple-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-fuchsia-400 font-semibold tracking-wider uppercase">
            <span>Playbook Oficial</span>
            <span>·</span>
            <span>Academy BETA</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Manual do Método 3x3x3 & Veo 3</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-fuchsia-300 border border-purple-500/30">
              GUIA COMPLETO
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Domine as diretrizes do leilão do TikTok Shop, multiplicação de criativos em escala e esteira de testes sem fadiga.
          </p>
        </div>

        <button
          onClick={onGoToStudio}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_15px_rgba(217,70,239,0.3)] transition-all cursor-pointer shrink-0"
        >
          <Layers className="w-4 h-4" />
          <span>Abrir Estúdio 3x3x3</span>
        </button>
      </div>

      {/* 4 Pillars of Knowledge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pillar 1 */}
        <div className="glass-card rounded-3xl p-6 border border-purple-500/25 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">
            01. Por que o Método 3x3x3 Vence o Leilão?
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            A maioria dos afiliados e lojas de dropshipping falha porque testam 1 ou 2 vídeos inteiros e esgotam o orçamento. No Método 3x3x3, você grava apenas 9 blocos curtos (3 Ganchos + 3 Corpos + 3 CTAs) e o algoritmo cartesiano combina 27 anúncios independentes. Se um gancho cansar, os outros sustentam o criativo vencedor por meses.
          </p>
          <div className="pt-2 text-[11px] font-mono text-purple-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Multiplica a probabilidade de ROI por 27x</span>
          </div>
        </div>

        {/* Pillar 2 */}
        <div className="glass-card rounded-3xl p-6 border border-purple-500/25 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-600/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">
            02. O Segredo do Anti-Shadowban (Código Limpo)
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Plataformas como TikTok e Reels comparam a assinatura binária de frames (fingerprinting). Se você subir o mesmo vídeo com pequenos cortes, sua conta sofre limitação de alcance orgânico. O AI Creative Engine injeta variações imperceptíveis ao olho humano (Zoom de 1.01x a 1.04x, velocidade de 0.98x a 1.02x e hash hexadecimal único), garantindo que cada um dos 27 vídeos seja catalogado como arquivo virgem original.
          </p>
          <div className="pt-2 text-[11px] font-mono text-fuchsia-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fingerprint 100% quebrado para o leilão</span>
          </div>
        </div>

        {/* Pillar 3 */}
        <div className="glass-card rounded-3xl p-6 border border-purple-500/25 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Flame className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-white">
            03. Manchetas de Alto CTR & Tarja Hormozi
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Mais de 70% dos usuários assistem aos primeiros segundos no mudo ou com som baixo enquanto rolam o feed. Uma tarja amarela de alto contraste queimada no topo do vídeo com perguntas provocativas ("NÃO COMPRE ISSO ANTES DE VER!") força a parada de rolagem imediata (Hook Rate superior a 35%).
          </p>
          <div className="pt-2 text-[11px] font-mono text-amber-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Aumento comprovado de +40% no CTR</span>
          </div>
        </div>

        {/* Pillar 4 */}
        <div className="glass-card rounded-3xl p-6 border border-purple-500/25 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <h3 className="text-base font-bold text-white">
            04. Google Veo 3: A Nova Fronteira do UGC
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            O Google Veo 3 requer parâmetros de consistência visual para que o apresentador não mude de rosto entre as cenas. Nosso gerador cria uma semente única (consistency seed) e divide a gravação em tomadas dinâmicas (Handheld + Ring Light), eliminando o aspecto artificial e gerando criativos com aparência de pessoas reais gravando de suas casas.
          </p>
          <div className="pt-2 text-[11px] font-mono text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>JSON pronto para o pipeline Google Veo 3</span>
          </div>
        </div>
      </div>

      {/* Bottom Launchpad */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-fuchsia-950/40 border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-white">
            Pronto para colocar a teoria em prática?
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Abra o Estúdio agora e gere seus primeiros 27 vídeos em menos de 1 minuto.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={onGoToStudio}
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-500 transition-all cursor-pointer"
          >
            <span>Iniciar no Estúdio 3x3x3</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onGoToVeo}
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-200 bg-slate-900 hover:bg-slate-800 border border-purple-500/20 transition-all cursor-pointer"
          >
            <span>Gerar Prompt Veo 3</span>
          </button>
        </div>
      </div>
    </div>
  );
};
