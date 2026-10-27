import React from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Sparkles, 
  TrendingUp, 
  Radio, 
  GraduationCap, 
  Settings, 
  Globe2, 
  Zap, 
  CheckCircle2, 
  Cpu,
  X,
  LogIn,
  LogOut,
  Database,
  Cloud,
  ShieldCheck,
  UserCheck,
  Lock
} from 'lucide-react';
import { User } from 'firebase/auth';
import { AppSettings, UsuarioLicenca } from '../types';
import { AppUser, isUserAdmin } from '../services/firebase';

export type TabId = 'dashboard' | 'studio' | 'veo3' | 'trending' | 'remix' | 'academy' | 'admin_licencas';

interface SidebarProps {
  currentTab: TabId;
  setCurrentTab: (tab: TabId) => void;
  openSettings: () => void;
  settings: AppSettings;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
  currentUser: User | AppUser | null;
  activeLicenseUser: UsuarioLicenca | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenPaywall?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  openSettings,
  settings,
  mobileMenuOpen = false,
  setMobileMenuOpen,
  currentUser,
  activeLicenseUser,
  onOpenAuth,
  onLogout,
  onOpenPaywall,
}) => {
  const hasApiKey = Boolean(settings.openRouterApiKey && settings.openRouterApiKey.trim().length > 5);
  const isMasterAdmin = 
    activeLicenseUser?.Role === 'Admin' || 
    activeLicenseUser?.Email.toLowerCase() === 'cristianomoove@gmail.com' ||
    isUserAdmin(currentUser);

  const baseNavItems = [
    {
      id: 'dashboard' as TabId,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'studio' as TabId,
      label: 'Estúdio 3x3x3',
      icon: Layers,
      badge: null,
    },
    {
      id: 'veo3' as TabId,
      label: 'Prompt VEO3',
      icon: Sparkles,
      badge: null,
    },
    {
      id: 'trending' as TabId,
      label: 'Trending Radar',
      icon: TrendingUp,
      badge: null,
    },
    {
      id: 'remix' as TabId,
      label: 'Remix Live',
      icon: Radio,
      badge: 'BETA',
    },
    {
      id: 'academy' as TabId,
      label: 'Academy',
      icon: GraduationCap,
      badge: 'BETA',
    },
  ];

  // Exclusive Admin tab: "Painel Admin - Licenças" visible only when Role == "Admin"
  const navItems = isMasterAdmin
    ? [
        ...baseNavItems,
        {
          id: 'admin_licencas' as TabId,
          label: 'Painel Admin - Licenças',
          icon: ShieldCheck,
          badge: 'ADMIN',
        },
      ]
    : baseNavItems;

  const handleNavClick = (tabId: TabId) => {
    setCurrentTab(tabId);
    if (setMobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full w-full select-none overflow-y-auto">
      {/* Top Brand Zone */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            {/* Custom Vector SVG Icon: 3x3 Grid + Play Button with #9333ea to #db2777 linearGradient */}
            <div className="relative w-11 h-11 rounded-xl bg-slate-900/90 border border-purple-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(219,39,119,0.3)] group-hover:shadow-[0_0_25px_rgba(147,51,234,0.5)] transition-all shrink-0">
              <svg
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-9 h-9"
                aria-label="Clip27 IA Logo"
              >
                <defs>
                  <linearGradient id="clip27-sidebar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#db2777" />
                  </linearGradient>
                  <linearGradient id="clip27-play-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#f5d0fe" />
                  </linearGradient>
                </defs>

                {/* Outer subtle squircle frame */}
                <rect
                  x="2"
                  y="2"
                  width="36"
                  height="36"
                  rx="9"
                  fill="url(#clip27-sidebar-grad)"
                  fillOpacity="0.14"
                  stroke="url(#clip27-sidebar-grad)"
                  strokeWidth="1.5"
                />

                {/* 3x3 Grid Matrix Nodes */}
                {/* Row 1 */}
                <rect x="6.5" y="6.5" width="7" height="7" rx="2" fill="url(#clip27-sidebar-grad)" />
                <rect x="16.5" y="6.5" width="7" height="7" rx="2" fill="url(#clip27-sidebar-grad)" fillOpacity="0.85" />
                <rect x="26.5" y="6.5" width="7" height="7" rx="2" fill="url(#clip27-sidebar-grad)" fillOpacity="0.65" />

                {/* Row 2 */}
                <rect x="6.5" y="16.5" width="7" height="7" rx="2" fill="url(#clip27-sidebar-grad)" fillOpacity="0.85" />
                <rect x="16.5" y="16.5" width="7" height="7" rx="2" fill="url(#clip27-sidebar-grad)" fillOpacity="0.35" />
                <rect x="26.5" y="16.5" width="7" height="7" rx="2" fill="url(#clip27-sidebar-grad)" fillOpacity="0.35" />

                {/* Row 3 */}
                <rect x="6.5" y="26.5" width="7" height="7" rx="2" fill="url(#clip27-sidebar-grad)" fillOpacity="0.65" />
                <rect x="16.5" y="26.5" width="7" height="7" rx="2" fill="url(#clip27-sidebar-grad)" fillOpacity="0.85" />
                <rect x="26.5" y="26.5" width="7" height="7" rx="2" fill="url(#clip27-sidebar-grad)" fillOpacity="0.35" />

                {/* Central/Foreground Combined Play Button Badge */}
                <circle
                  cx="22"
                  cy="22"
                  r="10.5"
                  fill="url(#clip27-sidebar-grad)"
                  stroke="#090d16"
                  strokeWidth="2"
                />
                <path
                  d="M19.5 17.2C19.5 16.44 20.33 15.97 20.99 16.36L27.6 20.28C28.25 20.66 28.25 21.6 27.6 21.99L20.99 25.91C20.33 26.3 19.5 25.82 19.5 25.06V17.2Z"
                  fill="url(#clip27-play-glow)"
                />
              </svg>
            </div>

            <div className="flex flex-col">
              <div className="relative inline-flex items-center">
                <h1 className="text-lg tracking-tight leading-none flex items-baseline">
                  <span className="text-white font-bold">Clip</span>
                  <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent font-extrabold">
                    27
                  </span>
                </h1>
                <span className="ml-1.5 -mt-2 text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded-full bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-400/70 shadow-[0_0_10px_rgba(217,70,239,0.55)] leading-none">
                  IA
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1 tracking-tight">
                Multiplicador 3x3x3 &amp; Criativos
              </p>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          {setMobileMenuOpen && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* User Auth & SaaS License Card in Sidebar */}
        <div className="mt-4 p-3 rounded-2xl bg-purple-950/30 border border-purple-500/20">
          {activeLicenseUser ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                    isMasterAdmin 
                      ? 'bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-600 shadow-[0_0_10px_rgba(217,70,239,0.5)]'
                      : 'bg-gradient-to-tr from-indigo-600 to-purple-600'
                  }`}>
                    {(activeLicenseUser.Nome || activeLicenseUser.Email || 'U')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-bold text-white truncate">
                        {activeLicenseUser.Nome || 'Criador'}
                      </p>
                      {isMasterAdmin && (
                        <span title="Admin Master Oficial">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate font-mono">
                      {activeLicenseUser.Email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  title="Sair da Conta (Logout)"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* License Status Strip */}
              <div className="pt-2 border-t border-purple-500/15">
                {isMasterAdmin ? (
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-emerald-400 flex items-center gap-1 font-bold">
                      <UserCheck className="w-3 h-3" />
                      <span>ADMIN MASTER</span>
                    </span>
                    <span className="text-fuchsia-300 bg-fuchsia-950/60 px-1.5 py-0.5 rounded border border-fuchsia-500/30">
                      VITALÍCIO (2099)
                    </span>
                  </div>
                ) : activeLicenseUser.Status_Plano === 'Trial_3_Dias' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-amber-300 font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>TESTE 3 DIAS</span>
                      </span>
                      <span className="text-slate-400 font-mono text-[9px]">
                        Até {activeLicenseUser.Data_Expiracao}
                      </span>
                    </div>
                    {onOpenPaywall && (
                      <button
                        onClick={onOpenPaywall}
                        className="w-full py-1 px-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-[10px] font-bold text-white flex items-center justify-center gap-1 cursor-pointer transition-all shadow-sm"
                      >
                        <span>Ativar Licença Anual (R$ 49,90)</span>
                      </button>
                    )}
                  </div>
                ) : activeLicenseUser.Status_Plano === 'Ativo_Anual' ? (
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-emerald-400 flex items-center gap-1 font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>ANUAL ATIVA</span>
                    </span>
                    <span className="text-slate-400 text-[9px]">
                      Até {activeLicenseUser.Data_Expiracao}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-rose-400 flex items-center gap-1 font-bold">
                      <Lock className="w-3 h-3" />
                      <span>{activeLicenseUser.Status_Plano}</span>
                    </span>
                    {onOpenPaywall && (
                      <button
                        onClick={onOpenPaywall}
                        className="text-[9px] text-emerald-400 hover:underline font-bold"
                      >
                        Ativar R$ 49,90
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-semibold flex items-center gap-1">
                  <Cloud className="w-3.5 h-3.5 text-purple-400" />
                  <span>Sessão Bloqueada</span>
                </span>
                <span className="text-[9px] font-mono text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                  LOGIN OBRIGATÓRIO
                </span>
              </div>
              <button
                onClick={onOpenAuth}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-sm transition-all cursor-pointer min-h-[38px]"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar no Sistema</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation list */}
        <div className="mt-4 pt-2 border-t border-purple-500/10">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 px-2 mb-2">
            Navegação Principal
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer min-h-[44px] ${
                    isActive
                      ? 'bg-purple-900/40 text-fuchsia-200 border border-fuchsia-500/50 shadow-[0_0_18px_rgba(168,85,247,0.22)]'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-fuchsia-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 font-mono">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Middle Status Card */}
      <div className="px-4 py-2">
        <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-[11px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-purple-400" /> Banco Firestore
            </span>
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">
              CONECTADO
            </span>
          </div>
          <p className="text-slate-300 text-[10px] leading-relaxed">
            Dados persistidos na nuvem no projeto <span className="text-fuchsia-300 font-mono">image-ia-sdh87</span>.
          </p>
        </div>
      </div>

      {/* Footer Zone */}
      <div className="p-4 pt-3 border-t border-purple-500/15 space-y-2.5">
        {/* Settings button with live API status indicator */}
        <button
          onClick={() => {
            openSettings();
            if (setMobileMenuOpen) setMobileMenuOpen(false);
          }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/70 hover:bg-purple-950/40 border border-purple-500/20 hover:border-purple-500/40 transition-all cursor-pointer min-h-[44px]"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-purple-400" />
            <span>Configurações & API</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                hasApiKey
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
              }`}
            />
            <span className="text-[10px] font-mono text-slate-400">
              {hasApiKey ? 'Ativo' : 'Local'}
            </span>
          </div>
        </button>

        {/* Language Badge */}
        <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-purple-400" />
            Idioma Interface
          </span>
          <span className="px-1.5 py-0.5 rounded bg-purple-950/60 text-fuchsia-300 font-bold border border-purple-500/30">
            PT-BR
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (w-60 / 240px) */}
      <aside className="hidden lg:flex flex-col w-60 h-screen shrink-0 sticky top-0 left-0 bg-slate-950/75 backdrop-blur-2xl border-r border-purple-500/20 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop blur */}
          <div
            onClick={() => setMobileMenuOpen && setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-fade-in"
          />

          {/* Drawer Panel */}
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full bg-slate-950/95 border-r border-purple-500/30 shadow-2xl z-10 animate-slide-in">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
