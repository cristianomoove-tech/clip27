import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  Clock, 
  QrCode, 
  Copy, 
  Check, 
  MessageSquare, 
  ArrowRight, 
  LogOut, 
  Lock,
  Layers,
  Crown
} from 'lucide-react';
import { UsuarioLicenca } from '../types';
import { 
  LICENSE_ANNUAL_PRICE, 
  ASAAS_ANNUAL_CHECKOUT_URL,
  buildWhatsAppBillingLink, 
  selfUpgradeToAnnual 
} from '../services/licensingService';

interface PaywallModalProps {
  user: UsuarioLicenca;
  onUpgradeSuccess: (updatedUser: UsuarioLicenca) => void;
  onLogout: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  user,
  onUpgradeSuccess,
  onLogout,
}) => {
  const [showCheckout, setShowCheckout] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock instant Pix payload
  const pixCopyPaste = `00020126580014br.gov.bcb.pix0136clip27-licencas-${user.ID_Usuario}520400005303986540549.905802BR5925CLIP27 TECNOLOGIA LTDA6009SAO PAULO62070503***6304E8A2`;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCopyPaste);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    try {
      const updated = await selfUpgradeToAnnual(user.ID_Usuario);
      setTimeout(() => {
        setIsProcessing(false);
        onUpgradeSuccess(updated);
      }, 900);
    } catch (e) {
      setIsProcessing(false);
      console.error(e);
    }
  };

  const handleWhatsAppSupport = () => {
    const text = `Olá! Meu período de teste no Clip27 IA encerrou e gostaria de ativar minha Licença Anual por R$ 49,90. (Nome: ${user.Nome}, E-mail: ${user.Email})`;
    const link = buildWhatsAppBillingLink(user, text);
    window.open(link, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/95 backdrop-blur-2xl overflow-y-auto animate-fade-in">
      <div className="w-full max-w-2xl my-auto rounded-3xl bg-slate-900/95 border border-purple-500/40 p-6 sm:p-9 shadow-[0_0_80px_rgba(219,39,119,0.35)] relative overflow-hidden">
        
        {/* Glow ambient effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Badges */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-purple-500/20">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-mono font-bold text-rose-300 uppercase tracking-wider">
              Acesso Expirado • Bloqueio de Segurança
            </span>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Trocar de Conta</span>
          </button>
        </div>

        {!showCheckout ? (
          <div>
            {/* Crown & Headline */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-600 text-white shadow-[0_0_30px_rgba(217,70,239,0.5)] mb-4">
                <Crown className="w-8 h-8" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Seu período de teste gratuito de 3 dias encerrou!
              </h2>
              <p className="text-sm sm:text-base text-slate-300 mt-2.5 max-w-lg mx-auto leading-relaxed">
                Para continuar utilizando todas as ferramentas sem limites por 1 ano inteiro, ative sua{' '}
                <strong className="text-fuchsia-300 font-bold">Licença Anual por apenas R$ 49,90</strong>.
              </p>
            </div>

            {/* Included in Annual License */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
              <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/20 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">365 Dias de Acesso Irrestrito</h4>
                  <p className="text-[11px] text-slate-400">Sem renovações automáticas surpresa ou pegadinhas.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/20 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Multiplicador 3x3x3 sem Limites</h4>
                  <p className="text-[11px] text-slate-400">Crie 27 criativos virais por produto em poucos cliques.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/20 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Legendas Karaokê Palavra por Palavra</h4>
                  <p className="text-[11px] text-slate-400">Estilo TikTok, Hormozi e CapCut com áudio original mantido.</p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/20 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-white">Exportação Real em MP4 & ZIP</h4>
                  <p className="text-[11px] text-slate-400">Pronto para subir no TikTok Ads, Reels e Shorts.</p>
                </div>
              </div>
            </div>

            {/* Pricing Action Box */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-900/40 via-fuchsia-900/40 to-pink-900/40 border border-fuchsia-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 mb-3">
              <div>
                <div className="text-[10px] uppercase font-mono font-bold text-fuchsia-300">
                  Plano Anual Oficial Asaas
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">R$ 49,90</span>
                  <span className="text-xs text-slate-300 font-medium">/ 1 ano inteiro de acesso</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pix, Cartão de Crédito ou Boleto com liberação imediata.
                </p>
              </div>

              <a
                href={ASAAS_ANNUAL_CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-6 py-4 rounded-xl font-black text-sm text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 cursor-pointer transition-all transform hover:scale-[1.03] text-center"
              >
                <Zap className="w-4 h-4 fill-current text-amber-300" />
                <span>Comprar no Asaas (R$ 49,90)</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Alternative Actions: Pix Direto & Auto-Liberação */}
            <div className="flex flex-wrap items-center justify-center gap-3 py-2 text-xs mb-3">
              <button
                type="button"
                onClick={() => setShowCheckout(true)}
                className="text-fuchsia-300 hover:text-white underline font-medium cursor-pointer"
              >
                Pagar via Pix direto com Copia e Cola
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isProcessing}
                className="text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Verificando...' : 'Já paguei no Asaas / Liberar Acesso'}</span>
              </button>
            </div>

            {/* Secondary Action: WhatsApp Support */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 pt-2">
              <span className="text-center sm:text-left">
                Usuário: <strong className="text-white font-mono">{user.Email}</strong>
              </span>

              <button
                onClick={handleWhatsAppSupport}
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Ativação / Comprovante via WhatsApp</span>
              </button>
            </div>
          </div>
        ) : (
          /* CHECKOUT / PIX ACTIVATION FLOW */
          <div>
            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-white">
                Pagamento Instantâneo via Pix — R$ 49,90
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Copie a chave Pix abaixo e pague no app do seu banco para liberação imediata.
              </p>
            </div>

            {/* QR Code / Copia e Cola Container */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-3 mb-5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-semibold">Código Pix Copia e Cola:</span>
                <button
                  onClick={handleCopyPix}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-fuchsia-300 text-xs font-mono font-bold transition-all cursor-pointer"
                >
                  {copiedPix ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPix ? 'Copiado!' : 'Copiar Código'}</span>
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                {pixCopyPaste}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                <span>Beneficiário: Clip27 Tecnologia</span>
                <span className="text-white font-bold font-mono">Valor: R$ 49,90</span>
              </div>
            </div>

            {/* Direct Asaas Link */}
            <div className="mb-4">
              <a
                href={ASAAS_ANNUAL_CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Zap className="w-4 h-4 fill-current text-amber-300" />
                <span>Pagar no Checkout Oficial Asaas (Cartão de Crédito ou Pix)</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Confirm & Liberate Button */}
            <div className="space-y-3">
              <button
                onClick={handleConfirmPayment}
                disabled={isProcessing}
                className="w-full py-4 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 shadow-[0_0_30px_rgba(16,185,129,0.45)] flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <span>Já Efetuei o Pix — Liberar 1 Ano Imediatamente</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  ← Voltar às opções
                </button>

                <button
                  onClick={handleWhatsAppSupport}
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Enviar comprovante no WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
