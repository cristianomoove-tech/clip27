import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Lock, 
  Mail, 
  User as UserIcon, 
  Phone, 
  KeyRound, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Layers,
  Zap,
  Star
} from 'lucide-react';
import { UsuarioLicenca } from '../types';
import { 
  authenticateLicenseUser, 
  registerTrialUser, 
  ADMIN_MASTER_EMAIL, 
  LICENSE_ANNUAL_PRICE,
  DEFAULT_ADMIN_USER 
} from '../services/licensingService';

interface GatekeeperAuthViewProps {
  onLoginSuccess: (user: UsuarioLicenca) => void;
}

export const GatekeeperAuthView: React.FC<GatekeeperAuthViewProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Trial register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMsg('Por favor, informe seu e-mail e senha cadastrados.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await authenticateLicenseUser(loginEmail, loginPassword);
      setSuccessMsg(
        user.Role === 'Admin'
          ? 'Autenticado com sucesso como Administrador Master!'
          : 'Login autorizado! Carregando estúdio...'
      );
      setTimeout(() => {
        onLoginSuccess(user);
      }, 600);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao autenticar. Verifique seus dados.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Trial Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!regName.trim() || !regEmail.trim() || !regWhatsapp.trim() || !regPassword.trim()) {
      setErrorMsg('Preencha todos os campos do formulário para liberar seu teste.');
      return;
    }

    if (regPassword.length < 5) {
      setErrorMsg('A senha precisa ter pelo menos 5 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await registerTrialUser({
        nome: regName,
        email: regEmail,
        whatsapp: regWhatsapp,
        senha: regPassword,
      });

      setSuccessMsg('🎉 Conta criada com sucesso! 3 dias de Teste Gratuito liberados.');
      setTimeout(() => {
        onLoginSuccess(user);
      }, 700);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao registrar usuário. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#07090e] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(147,51,234,0.25),rgba(255,255,255,0))] text-slate-100 flex flex-col justify-between relative overflow-x-hidden">
      {/* Decorative ambient lights */}
      <div className="fixed top-1/4 -left-48 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 -right-48 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar Branding */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between border-b border-purple-500/10">
        <div className="flex items-center gap-3">
          {/* Official Vector Logo */}
          <div className="relative w-11 h-11 rounded-xl bg-slate-900/90 border border-purple-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(219,39,119,0.35)] shrink-0">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
              <defs>
                <linearGradient id="gk-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9333ea" />
                  <stop offset="100%" stopColor="#db2777" />
                </linearGradient>
                <linearGradient id="gk-play-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#f5d0fe" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="36" height="36" rx="9" fill="url(#gk-logo-grad)" fillOpacity="0.14" stroke="url(#gk-logo-grad)" strokeWidth="1.5" />
              <rect x="6.5" y="6.5" width="7" height="7" rx="2" fill="url(#gk-logo-grad)" />
              <rect x="16.5" y="6.5" width="7" height="7" rx="2" fill="url(#gk-logo-grad)" fillOpacity="0.85" />
              <rect x="26.5" y="6.5" width="7" height="7" rx="2" fill="url(#gk-logo-grad)" fillOpacity="0.65" />
              <rect x="6.5" y="16.5" width="7" height="7" rx="2" fill="url(#gk-logo-grad)" fillOpacity="0.85" />
              <rect x="16.5" y="16.5" width="7" height="7" rx="2" fill="url(#gk-logo-grad)" fillOpacity="0.35" />
              <rect x="26.5" y="16.5" width="7" height="7" rx="2" fill="url(#gk-logo-grad)" fillOpacity="0.35" />
              <rect x="6.5" y="26.5" width="7" height="7" rx="2" fill="url(#gk-logo-grad)" fillOpacity="0.65" />
              <rect x="16.5" y="26.5" width="7" height="7" rx="2" fill="url(#gk-logo-grad)" fillOpacity="0.85" />
              <rect x="26.5" y="26.5" width="7" height="7" rx="2" fill="url(#gk-logo-grad)" fillOpacity="0.35" />
              <circle cx="22" cy="22" r="10.5" fill="url(#gk-logo-grad)" stroke="#090d16" strokeWidth="2" />
              <path d="M19.5 17.2C19.5 16.44 20.33 15.97 20.99 16.36L27.6 20.28C28.25 20.66 28.25 21.6 27.6 21.99L20.99 25.91C20.33 26.3 19.5 25.82 19.5 25.06V17.2Z" fill="url(#gk-play-glow)" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white tracking-tight">Clip</span>
              <span className="text-xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">27</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-400/70 shadow-[0_0_10px_rgba(217,70,239,0.55)]">IA</span>
            </div>
            <p className="text-[11px] text-slate-400">Multiplicador 3x3x3 de Criativos Virais</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/50 border border-purple-500/30 text-xs font-mono text-purple-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Licenciamento Oficial</span>
          </span>
          <span className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-xs font-bold text-emerald-300">
            R$ 49,90 / ano
          </span>
        </div>
      </header>

      {/* Main Gatekeeper Card Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-xl">
          {/* Gatekeeper Card Container */}
          <div className="relative rounded-3xl bg-slate-900/90 border border-purple-500/30 shadow-[0_0_60px_rgba(168,85,247,0.25)] backdrop-blur-2xl overflow-hidden p-6 sm:p-8">
            
            {/* Header Badge & Title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/70 border border-purple-500/40 text-xs font-medium text-fuchsia-300 mb-3">
                <Lock className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>Acesso Seguro ao Sistema Clip27</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeTab === 'login' ? 'Identificação de Usuário' : 'Comece seu Teste Grátis de 3 Dias'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
                {activeTab === 'login' 
                  ? 'Faça login com seu e-mail e senha para acessar o estúdio 3x3x3 e suas campanhas.' 
                  : 'Crie sua conta em 30 segundos. Teste gratuitamente por 3 dias sem necessidade de cartão agora.'}
              </p>
            </div>

            {/* Tab Switcher */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-950/80 rounded-2xl border border-purple-500/20 mb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Já sou cliente (Login)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-300" />
                <span>Criar Conta (3 Dias Grátis)</span>
              </button>
            </div>

            {/* Alerts */}
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* TAB 1: FAZER LOGIN */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                    <span>E-mail Cadastrado</span>
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="w-full bg-slate-950/90 border border-purple-500/30 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                      <span>Senha</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showLoginPassword ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Sua senha de acesso"
                    required
                    className="w-full bg-slate-950/90 border border-purple-500/30 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all shadow-[0_0_20px_rgba(217,70,239,0.35)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Entrar no Sistema</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: CRIAR CONTA GRÁTIS (TRIAL 3 DIAS) */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* Highlight Trial Benefits */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/40 via-fuchsia-950/30 to-pink-950/20 border border-purple-500/30 text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-fuchsia-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Liberado: Teste Completo de 3 Dias (72 horas)</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Gere matrizes 3x3x3 (27 vídeos virais por campanha), legendas automáticas estilo Karaokê e exportação MP4.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-purple-400" />
                    <span>Nome Completo</span>
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Seu nome ou nome da sua agência"
                    required
                    className="w-full bg-slate-950/90 border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                    <span>E-mail</span>
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    required
                    className="w-full bg-slate-950/90 border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-purple-400" />
                    <span>WhatsApp com DDD (para suporte e ativação)</span>
                  </label>
                  <input
                    type="tel"
                    value={regWhatsapp}
                    onChange={(e) => setRegWhatsapp(e.target.value)}
                    placeholder="(11) 99999-9999"
                    required
                    className="w-full bg-slate-950/90 border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                      <span>Crie uma Senha</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="text-[10px] text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showRegPassword ? 'Ocultar' : 'Ver'}</span>
                    </button>
                  </div>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 5 caracteres"
                    required
                    className="w-full bg-slate-950/90 border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all shadow-[0_0_20px_rgba(217,70,239,0.35)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Criar Conta & Iniciar Teste Grátis</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Bottom Guarantee Banner */}
            <div className="mt-6 pt-5 border-t border-purple-500/15 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sem cobrança automática</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Liberação instantânea</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-purple-400" />
                <span>Licença Anual R$ 49,90</span>
              </span>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4 text-[11px] text-slate-500 border-t border-purple-500/10">
        Clip27 IA © {new Date().getFullYear()} — Sistema Comercial de Multiplicação 3x3x3. Todos os direitos reservados.
      </footer>
    </div>
  );
};
