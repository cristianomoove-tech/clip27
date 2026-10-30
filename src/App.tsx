import React, { useState, useEffect } from 'react';
import { Sidebar, TabId } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { StudioView } from './components/StudioView';
import { VeoPromptWizard } from './components/VeoPromptWizard';
import { TrendingRadarView } from './components/TrendingRadarView';
import { RemixLiveView } from './components/RemixLiveView';
import { AcademyView } from './components/AcademyView';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { BatchDownloadModal } from './components/BatchDownloadModal';
import { GatekeeperAuthView } from './components/GatekeeperAuthView';
import { PaywallModal } from './components/PaywallModal';
import { AdminLicensesView } from './components/AdminLicensesView';
import { Project, CreativeVariation, AppSettings, TrendingItem, VideoClip, UsuarioLicenca } from './types';
import { DEMO_HOOKS, DEMO_BODIES, DEMO_CTAS, DEFAULT_HEADLINES } from './services/demoClips';
import { getStoredSettings, saveStoredSettings } from './services/aiService';
import { hydrateVariationsWithProject, getClipBlobUrl, getClipFirstFrameDataUrl } from './services/clipStore';
import { 
  auth, 
  logoutUser, 
  subscribeToUserProjects, 
  saveProjectToFirestore, 
  deleteProjectFromFirestore,
  getStoredAdminSession,
  saveSingleLocalProject,
  loadLocalProjects,
  LEGACY_DEMO_PROJECT_IDS,
  isUserAdmin,
  AppUser,
  ADMIN_EMAIL
} from './services/firebase';
import { 
  getStoredActiveLicense, 
  setStoredActiveLicense, 
  evaluateLicense, 
  ADMIN_MASTER_EMAIL,
  persistLicense,
  runExpirationBot,
  buildWhatsAppBillingLink,
  subscribeToUserLicenseDoc,
  ASAAS_ANNUAL_CHECKOUT_URL
} from './services/licensingService';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  CheckCircle2, 
  Menu, 
  Settings as SettingsIcon, 
  Zap, 
  LayoutDashboard, 
  Layers, 
  Sparkles, 
  TrendingUp, 
  MoreHorizontal,
  Clock,
  Lock,
  MessageSquare,
  ArrowRight
} from 'lucide-react';

function createEmptyWorkspaceProject(): Project {
  const now = new Date();
  const id = `proj-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  return {
    id,
    name: 'Nova Campanha 3x3x3',
    createdAt: 'Agora mesmo',
    clipsCount: 0,
    videosGenerated: 0,
    status: 'Ativo',
    niche: 'Geral',
    hooks: [],
    bodies: [],
    ctas: [],
    headlines: [],
    antiShadowbanEnabled: true,
    autoSubtitlesEnabled: false,
    subtitleStyle: 'minimal_clean',
    aiCorrectionEnabled: false,
    generatedVariations: [],
  };
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>(() => loadLocalProjects());
  const [activeProject, setActiveProject] = useState<Project>(() => {
    const existing = loadLocalProjects();
    return existing.length > 0 ? existing[0] : createEmptyWorkspaceProject();
  });
  const [activePlayerVariation, setActivePlayerVariation] = useState<CreativeVariation | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGlobalZipOpen, setIsGlobalZipOpen] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | AppUser | null>(getStoredAdminSession());
  const [activeLicenseUser, setActiveLicenseUser] = useState<UsuarioLicenca | null>(getStoredActiveLicense());

  // Check if admin is currently active
  const isMasterAdmin = 
    activeLicenseUser?.Role === 'Admin' || 
    activeLicenseUser?.Email.toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase() ||
    isUserAdmin(currentUser);
  const isAdmin = isMasterAdmin;

  // Sync settings and evaluate license on boot
  useEffect(() => {
    setSettings(getStoredSettings());

    // Check active license status on app startup
    const active = getStoredActiveLicense();
    if (active) {
      const evaluation = evaluateLicense(active);
      if (evaluation.isExpired && active.Status_Plano === 'Trial_3_Dias') {
        const expiredUser = { ...active, Status_Plano: 'Expirado' as const };
        setActiveLicenseUser(expiredUser);
        persistLicense(expiredUser).catch(() => {});
      }
    }

    // Silent background maintenance: scan and update any expired trial accounts
    runExpirationBot().catch((e) => console.warn('Bot de vencimento silent scan:', e));

    // Listen to local settings updates (e.g., when user saves Apify key directly in TrendingRadarView)
    const handleSettingsEvent = () => {
      setSettings(getStoredSettings());
    };
    window.addEventListener('clip27-settings-updated', handleSettingsEvent);
    return () => {
      window.removeEventListener('clip27-settings-updated', handleSettingsEvent);
    };
  }, []);

  // Subscribe in real-time to the logged-in user's Firestore document (`Usuarios_Licencas/{ID_Usuario}`)
  // so API keys saved on PC immediately appear on Mobile (and vice-versa)
  useEffect(() => {
    if (!activeLicenseUser?.ID_Usuario) return;

    const unsubUserDoc = subscribeToUserLicenseDoc(activeLicenseUser.ID_Usuario, (cloudUser) => {
      setActiveLicenseUser(cloudUser);

      // Hydrate API keys from cloud profile if present
      const currentLocal = getStoredSettings();
      const syncedSettings: AppSettings = {
        openRouterApiKey:
          cloudUser.OpenRouter_ApiKey !== undefined
            ? cloudUser.OpenRouter_ApiKey
            : currentLocal.openRouterApiKey,
        openRouterModel:
          cloudUser.OpenRouter_Model ||
          currentLocal.openRouterModel ||
          'google/gemini-3.8-flash',
        apifyToken:
          cloudUser.Apify_Token !== undefined
            ? cloudUser.Apify_Token
            : currentLocal.apifyToken,
      };

      saveStoredSettings(syncedSettings, true);
      setSettings(syncedSettings);
    });

    return () => {
      unsubUserDoc();
    };
  }, [activeLicenseUser?.ID_Usuario]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const adminCheck = (firebaseUser.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
        setCurrentUser(firebaseUser);
        triggerToast(`Conectado ao Firebase como ${firebaseUser.displayName || firebaseUser.email}! Sincronização em tempo real ativa.`);
      } else {
        // Fallback to stored admin session if present
        const storedAdmin = getStoredAdminSession();
        if (storedAdmin) {
          setCurrentUser(storedAdmin);
        }
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Subscribe to real Firestore projects whenever user is present
  useEffect(() => {
    const uid = currentUser?.uid || activeLicenseUser?.ID_Usuario;
    if (!uid) return;

    // Proactively purge any legacy demo projects from Firestore
    LEGACY_DEMO_PROJECT_IDS.forEach((demoId) => {
      deleteProjectFromFirestore(uid, demoId).catch(() => {});
    });

    const unsubProjects = subscribeToUserProjects(
      uid,
      (cloudProjects) => {
        if (cloudProjects && cloudProjects.length > 0) {
          setProjects(cloudProjects);
          setActiveProject((prev) => {
            const found = cloudProjects.find((p) => p.id === prev.id);
            if (!found) return cloudProjects[0];

            // Preserve any in-memory video fileUrls and first-frame thumbnails from current editing session
            const resolveClipUrl = (clip: VideoClip, prevList: VideoClip[]) => {
              return (
                clip.fileUrl ||
                getClipBlobUrl(clip.id) ||
                (clip.fileName ? getClipBlobUrl(clip.fileName) : undefined) ||
                prevList.find((p) => p.id === clip.id)?.fileUrl ||
                prevList.find((p) => p.fileName && clip.fileName && p.fileName === clip.fileName)?.fileUrl
              );
            };

            const resolveClipThumb = (clip: VideoClip, prevList: VideoClip[]) => {
              return (
                clip.thumbnailDataUrl ||
                getClipFirstFrameDataUrl(clip) ||
                prevList.find((p) => p.id === clip.id)?.thumbnailDataUrl ||
                prevList.find((p) => p.fileName && clip.fileName && p.fileName === clip.fileName)
                  ?.thumbnailDataUrl
              );
            };

            const mergedHooks = found.hooks.map((h) => ({
              ...h,
              fileUrl: resolveClipUrl(h, prev.hooks),
              thumbnailDataUrl: resolveClipThumb(h, prev.hooks),
            }));
            const mergedBodies = found.bodies.map((b) => ({
              ...b,
              fileUrl: resolveClipUrl(b, prev.bodies),
              thumbnailDataUrl: resolveClipThumb(b, prev.bodies),
            }));
            const mergedCtas = found.ctas.map((c) => ({
              ...c,
              fileUrl: resolveClipUrl(c, prev.ctas),
              thumbnailDataUrl: resolveClipThumb(c, prev.ctas),
            }));

            const hydrated: Project = {
              ...found,
              hooks: mergedHooks,
              bodies: mergedBodies,
              ctas: mergedCtas,
            };

            hydrated.generatedVariations = hydrateVariationsWithProject(
              found.generatedVariations,
              hydrated
            );

            return hydrated;
          });
        } else {
          // Do NOT re-seed demo projects when database is empty! Keep list clean and empty.
          setProjects([]);
          setActiveProject(createEmptyWorkspaceProject());
        }
      },
      (err) => {
        console.warn('Erro ao sincronizar Firestore:', err);
      }
    );

    return () => {
      unsubProjects();
    };
  }, [currentUser?.uid, activeLicenseUser?.ID_Usuario]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleAuthSuccess = (email: string, adminStatus: boolean) => {
    const isMaster = adminStatus || email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const newUser: AppUser = {
      uid: auth.currentUser?.uid || 'admin-cristianomoove',
      email,
      displayName: isMaster ? 'Cristiano (Admin Master)' : email.split('@')[0],
      photoURL: isMaster ? 'https://api.dicebear.com/7.x/bottts/svg?seed=CristianoAdmin' : null,
      isAdmin: isMaster,
    };

    setCurrentUser(newUser);

    triggerToast(
      isMaster 
        ? 'Login de Administrador Master realizado! Banco Firestore sincronizado.' 
        : 'Login realizado com sucesso! Banco conectado.'
    );
  };

  const handleLicenseLoginSuccess = (user: UsuarioLicenca) => {
    setActiveLicenseUser(user);
    setStoredActiveLicense(user);

    const isMaster = user.Role === 'Admin' || user.Email.toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase();
    const mappedUser: AppUser = {
      uid: isMaster ? 'admin-cristianomoove' : user.ID_Usuario,
      email: user.Email,
      displayName: user.Nome,
      photoURL: isMaster ? 'https://api.dicebear.com/7.x/bottts/svg?seed=CristianoAdmin' : null,
      isAdmin: isMaster,
    };
    setCurrentUser(mappedUser);

    triggerToast(`Acesso liberado! Bem-vindo(a), ${user.Nome}.`);
  };

  const handleLogout = async () => {
    setStoredActiveLicense(null);
    setActiveLicenseUser(null);
    await logoutUser();
    setCurrentUser(null);
    setProjects([]);
    setActiveProject(createEmptyWorkspaceProject());
    triggerToast('Você desconectou do Clip27 IA.');
  };

  const handleCreateNewProject = () => {
    const now = new Date();
    const id = `proj-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`;
    
    const newProj: Project = {
      id,
      name: `Nova Campanha 3x3x3 #${projects.length + 1}`,
      createdAt: 'Agora mesmo',
      clipsCount: 0,
      videosGenerated: 0,
      status: 'Ativo',
      hooks: [],
      bodies: [],
      ctas: [],
      headlines: [],
      antiShadowbanEnabled: true,
      autoSubtitlesEnabled: false,
      subtitleStyle: 'minimal_clean',
      aiCorrectionEnabled: false,
      generatedVariations: [],
    };

    setProjects((prev) => [newProj, ...prev]);
    setActiveProject(newProj);
    setCurrentTab('studio');

    const uid = currentUser?.uid || activeLicenseUser?.ID_Usuario;
    if (uid) {
      saveProjectToFirestore(uid, newProj).catch((e) => console.error(e));
      triggerToast('Novo projeto criado e gravado no Firebase Firestore!');
    } else {
      saveSingleLocalProject(newProj);
      triggerToast('Novo projeto criado! Carregue seus clipes no Estúdio.');
    }
  };

  const handleUpdateActiveProject = (updated: Partial<Project>, deferPersist: boolean = false) => {
    let merged = { ...activeProject, ...updated };
    if (merged.generatedVariations && merged.generatedVariations.length > 0) {
      merged.generatedVariations = hydrateVariationsWithProject(merged.generatedVariations, merged);
    }
    setActiveProject(merged);
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === merged.id);
      return exists ? prev.map((p) => (p.id === merged.id ? merged : p)) : [merged, ...prev];
    });

    if (!deferPersist) {
      saveSingleLocalProject(merged);
      const uid = currentUser?.uid || activeLicenseUser?.ID_Usuario;
      if (uid) {
        saveProjectToFirestore(uid, merged).catch((e) => console.error(e));
      }
    }
  };

  const handleDeleteProject = (id: string) => {
    const uid = currentUser?.uid || activeLicenseUser?.ID_Usuario || 'local';
    deleteProjectFromFirestore(uid, id).catch((e) => console.error(e));

    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);
    if (remaining.length > 0) {
      if (activeProject.id === id) {
        setActiveProject(remaining[0]);
      }
    } else {
      // Do NOT recreate or save any project to Firestore when the list becomes empty
      setActiveProject(createEmptyWorkspaceProject());
    }
    triggerToast('Projeto excluído definitivamente do banco de dados e do sistema.');
  };

  const handleDuplicateProject = (proj: Project) => {
    const dupId = `${proj.id}-copia-${Date.now().toString(36).slice(-4)}`;
    const duplicated: Project = {
      ...proj,
      id: dupId,
      name: `${proj.name} (Cópia)`,
      createdAt: 'Agora mesmo',
    };
    setProjects((prev) => [duplicated, ...prev]);
    setActiveProject(duplicated);
    const uid = currentUser?.uid || activeLicenseUser?.ID_Usuario;
    if (uid) {
      saveProjectToFirestore(uid, duplicated).catch((e) => console.error(e));
    } else {
      saveSingleLocalProject(duplicated);
    }
    triggerToast('Projeto duplicado e salvo na nuvem!');
  };

  const [veoInitialProduct, setVeoInitialProduct] = useState<TrendingItem | null>(null);

  const handleSendProductToVeo3 = (item: TrendingItem) => {
    setVeoInitialProduct(item);
    setCurrentTab('veo3');
    triggerToast(`🇧🇷 Produto "${item.product.slice(0, 28)}..." carregado no Motor VEO 3!`);
  };

  const handleCloneFromTrending = (item: TrendingItem) => {
    const now = new Date();
    const id = `proj-viral-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`;

    const viralHooksFromProduct = item.viralVideos && item.viralVideos.length > 0
      ? item.viralVideos.map((v) => v.hookPtBr)
      : [item.viralHook];

    const customizedHooks = DEMO_HOOKS.map((hook, idx) => ({
      ...hook,
      title: `Gancho Viral BR #${idx + 1} — ${item.product.slice(0, 22)}`,
      subtitleText: viralHooksFromProduct[idx % viralHooksFromProduct.length] || item.viralHook,
    }));

    const newProj: Project = {
      id,
      name: `${item.product.slice(0, 32)} (Brasil Viral)`,
      createdAt: 'Agora mesmo',
      clipsCount: 9,
      videosGenerated: 0,
      status: 'Ativo',
      niche: item.niche,
      hooks: customizedHooks,
      bodies: [...DEMO_BODIES],
      ctas: [...DEMO_CTAS],
      headlines: [...item.suggestedHeadlines],
      antiShadowbanEnabled: true,
      autoSubtitlesEnabled: true,
      subtitleStyle: 'hormozi_yellow',
      aiCorrectionEnabled: true,
      generatedVariations: [],
    };

    setProjects((prev) => [newProj, ...prev]);
    setActiveProject(newProj);
    setCurrentTab('studio');

    const uid = currentUser?.uid || activeLicenseUser?.ID_Usuario;
    if (uid) {
      saveProjectToFirestore(uid, newProj).catch((e) => console.error(e));
    } else {
      saveSingleLocalProject(newProj);
    }
    triggerToast(`🇧🇷 Produto "${item.product.slice(0, 26)}..." e seus ganchos virais clonados para o Estúdio 3x3x3!`);
  };

  // Admin Force Sync helper
  const handleSyncAllToFirestore = async () => {
    const uid = currentUser?.uid || activeLicenseUser?.ID_Usuario;
    if (!uid) {
      setIsAuthModalOpen(true);
      return;
    }
    for (const proj of projects) {
      await saveProjectToFirestore(uid, proj);
    }
    triggerToast('Todos os projetos foram gravados com sucesso no Firebase Firestore!');
  };

  // Delete all projects permanently
  const handleDeleteAllProjects = async () => {
    const uid = currentUser?.uid || activeLicenseUser?.ID_Usuario || 'local';
    for (const proj of projects) {
      await deleteProjectFromFirestore(uid, proj.id);
    }
    setProjects([]);
    setActiveProject(createEmptyWorkspaceProject());
    triggerToast('Todos os projetos foram excluídos definitivamente do banco de dados!');
  };

  const hasApiKey = Boolean(settings.openRouterApiKey && settings.openRouterApiKey.trim().length > 5);

  const getTabLabel = (tab: TabId) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard';
      case 'studio': return 'Estúdio 3x3x3';
      case 'veo3': return 'Prompt VEO 3';
      case 'trending': return 'Trending Radar';
      case 'remix': return 'Remix Live (BETA)';
      case 'academy': return 'Academy (BETA)';
      case 'admin_licencas': return 'Painel Admin - Licenças';
      default: return 'Clip27 IA';
    }
  };

  // 1. GATEKEEPER BLOQUEIO TOTAL INICIAL:
  // Se o usuário não está autenticado na tabela de licenças, exibe exclusivamente a tela de Acesso ao Sistema
  if (!activeLicenseUser) {
    return (
      <GatekeeperAuthView
        onLoginSuccess={handleLicenseLoginSuccess}
      />
    );
  }

  // 2. LÓGICA DO TRIAL DE 3 DIAS E TRAVA DE EXPIRAÇÃO AUTOMÁTICA EM TEMPO REAL:
  const licenseEval = evaluateLicense(activeLicenseUser);

  // Se TODAY > Data_Expiracao ou Status_Plano == "Expirado": exibe exclusivamente a Tela de Renovação / Compra de Licença (Paywall R$ 49,90) com Banner Superior
  if (licenseEval.isExpired) {
    return (
      <div className="min-h-screen bg-[#05070c] flex flex-col">
        {/* Banner de Aviso de Teste Terminado no Topo */}
        <div className="bg-gradient-to-r from-rose-950 via-purple-950 to-rose-950 border-b-2 border-rose-500/50 px-4 py-3.5 flex flex-wrap items-center justify-between text-xs sticky top-0 z-50 backdrop-blur-md shadow-2xl gap-3">
          <div className="flex items-center gap-2.5 text-rose-200">
            <div className="w-9 h-9 rounded-xl bg-rose-600/30 border border-rose-500/50 text-rose-300 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <span className="font-black text-rose-200 uppercase tracking-wide text-xs block">
                🚨 SEU PERÍODO DE TESTE DE 3 DIAS ENCERROU!
              </span>
              <span className="text-slate-300 text-xs">
                Para continuar utilizando o Clip27 IA sem travas por 1 ano inteiro, ative sua Licença Anual Oficial.
              </span>
            </div>
          </div>

          <a
            href={ASAAS_ANNUAL_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs shadow-[0_0_25px_rgba(16,185,129,0.5)] flex items-center gap-2 cursor-pointer transition-all transform hover:scale-105 shrink-0"
          >
            <Zap className="w-4 h-4 fill-current text-amber-300" />
            <span>Comprar Licença Anual no Asaas (R$ 49,90)</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <PaywallModal
          user={activeLicenseUser}
          onUpgradeSuccess={(updated) => {
            setActiveLicenseUser(updated);
            triggerToast('🎉 Licença Anual Ativada com Sucesso (+365 Dias)!');
          }}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  // Se a conta estiver bloqueada
  if (licenseEval.isBlocked) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-4 text-center">
        <div className="max-w-md p-8 rounded-3xl bg-slate-900 border border-rose-500/40 shadow-2xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Acesso Bloqueado</h2>
          <p className="text-xs text-slate-300">
            Sua conta foi bloqueada pelo administrador do Clip27 IA. Entre em contato para regularizar seu acesso.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href={buildWhatsAppBillingLink(activeLicenseUser, "Olá, meu acesso no Clip27 IA consta como bloqueado. Como posso reativar?")}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Falar com o Suporte no WhatsApp</span>
            </a>
            <button
              onClick={handleLogout}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070c] text-slate-100 flex flex-col lg:flex-row relative overflow-x-hidden selection:bg-fuchsia-500 selection:text-white">
      {/* Background Radial Ambient Glow */}
      <div 
        className="fixed inset-0 pointer-events-none z-0" 
        style={{
          background: 'radial-gradient(circle at top right, #2e1065 0%, #090d16 45%, #05070c 100%)',
        }}
      />
      <div className="fixed top-1/4 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-10 right-1/4 w-80 h-80 bg-fuchsia-600/10 rounded-full blur-[100px] pointer-events-none z-0" />

      {/* Mobile Top Bar (Visible only on < 1024px) */}
      <header className="sticky top-0 z-40 lg:hidden flex items-center justify-between px-4 py-2.5 bg-slate-950/85 backdrop-blur-xl border-b border-purple-500/20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-500/25 flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all cursor-pointer"
            aria-label="Abrir menu de navegação"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900/90 border border-purple-500/30 flex items-center justify-center shadow-[0_0_12px_rgba(219,39,119,0.3)] shrink-0">
              <svg
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                aria-label="Clip27 IA Logo"
              >
                <defs>
                  <linearGradient id="clip27-mobile-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#9333ea" />
                    <stop offset="100%" stopColor="#db2777" />
                  </linearGradient>
                </defs>
                <rect x="6.5" y="6.5" width="7" height="7" rx="2" fill="url(#clip27-mobile-grad)" />
                <rect x="16.5" y="6.5" width="7" height="7" rx="2" fill="url(#clip27-mobile-grad)" fillOpacity="0.85" />
                <rect x="26.5" y="6.5" width="7" height="7" rx="2" fill="url(#clip27-mobile-grad)" fillOpacity="0.65" />
                <rect x="6.5" y="16.5" width="7" height="7" rx="2" fill="url(#clip27-mobile-grad)" fillOpacity="0.85" />
                <rect x="16.5" y="16.5" width="7" height="7" rx="2" fill="url(#clip27-mobile-grad)" fillOpacity="0.35" />
                <rect x="26.5" y="16.5" width="7" height="7" rx="2" fill="url(#clip27-mobile-grad)" fillOpacity="0.35" />
                <rect x="6.5" y="26.5" width="7" height="7" rx="2" fill="url(#clip27-mobile-grad)" fillOpacity="0.65" />
                <rect x="16.5" y="26.5" width="7" height="7" rx="2" fill="url(#clip27-mobile-grad)" fillOpacity="0.85" />
                <rect x="26.5" y="26.5" width="7" height="7" rx="2" fill="url(#clip27-mobile-grad)" fillOpacity="0.35" />
                <circle cx="22" cy="22" r="10.5" fill="url(#clip27-mobile-grad)" stroke="#090d16" strokeWidth="2" />
                <path
                  d="M19.5 17.2C19.5 16.44 20.33 15.97 20.99 16.36L27.6 20.28C28.25 20.66 28.25 21.6 27.6 21.99L20.99 25.91C20.33 26.3 19.5 25.82 19.5 25.06V17.2Z"
                  fill="#ffffff"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center leading-tight">
                <span className="text-xs font-bold tracking-tight text-white">Clip</span>
                <span className="text-xs bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent font-extrabold">
                  27
                </span>
                <span className="ml-1 -mt-1.5 text-[8px] uppercase font-mono font-bold px-1 py-0.5 rounded-full bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-400/70 shadow-[0_0_8px_rgba(217,70,239,0.5)] leading-none">
                  IA
                </span>
              </div>
              <span className="text-[10px] text-fuchsia-300 font-mono block">
                {getTabLabel(currentTab)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeLicenseUser && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-950/50 border border-purple-500/30">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              <span className="text-[10px] font-mono font-bold text-emerald-300">
                {isMasterAdmin ? 'ADMIN' : activeLicenseUser.Status_Plano === 'Trial_3_Dias' ? 'TRIAL 3D' : 'ANUAL'}
              </span>
            </div>
          )}

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-purple-500/20 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer relative"
            aria-label="Abrir configurações"
          >
            <SettingsIcon className="w-4 h-4" />
            <span
              className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                hasApiKey ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
              }`}
            />
          </button>
        </div>
      </header>

      {/* Left Sidebar (Desktop fixed + Mobile slide-over drawer) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        openSettings={() => setIsSettingsOpen(true)}
        settings={settings}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        currentUser={currentUser}
        activeLicenseUser={activeLicenseUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenPaywall={() => setIsPaywallOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:h-screen lg:overflow-y-auto relative z-10">
        
        {/* Banner para Clientes com 3 Dias de Teste (Trial Ativo) */}
        {licenseEval.isTrial && (
          <div className="bg-gradient-to-r from-purple-950/95 via-fuchsia-950/90 to-purple-950/95 border-b border-fuchsia-500/40 px-4 py-3 flex flex-wrap items-center justify-between text-xs sticky top-0 z-30 backdrop-blur-md shadow-lg gap-3">
            <div className="flex items-center gap-2.5 text-fuchsia-200">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <Clock className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <span className="font-extrabold text-amber-300 uppercase tracking-wide text-[11px] block">
                  Período de Teste Grátis de 3 Dias Ativo:
                </span>
                <span className="text-slate-200 text-xs">
                  Restam <strong className="text-amber-300 font-mono">{licenseEval.daysRemaining > 1 ? `${licenseEval.daysRemaining} dias` : `${licenseEval.hoursRemaining} horas`}</strong> para o seu teste encerrar. Garanta sua licença anual e continue sem interrupções!
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={ASAAS_ANNUAL_CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-1.5 cursor-pointer transition-all transform hover:scale-105 shrink-0"
              >
                <Zap className="w-3.5 h-3.5 fill-current text-amber-300" />
                <span>Comprar Licença Anual (R$ 49,90)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={() => setIsPaywallOpen(true)}
                className="px-3 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 text-xs font-bold border border-purple-500/30 transition-all cursor-pointer"
              >
                Detalhes
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 px-3.5 sm:px-6 lg:px-10 pt-4 pb-24 lg:py-8">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'dashboard' && (
              <DashboardView
                projects={projects}
                activeProject={activeProject}
                currentUser={currentUser}
                isAdmin={isAdmin}
                onSelectProject={(p) => {
                  setActiveProject(p);
                  setCurrentTab('studio');
                }}
                onCreateNewProject={handleCreateNewProject}
                onDeleteProject={handleDeleteProject}
                onDeleteAllProjects={handleDeleteAllProjects}
                onDuplicateProject={handleDuplicateProject}
                onGoToStudio={() => setCurrentTab('studio')}
                onGoToVeo={() => setCurrentTab('veo3')}
                onGoToTrending={() => setCurrentTab('trending')}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onSyncAllToFirestore={handleSyncAllToFirestore}
              />
            )}

          {currentTab === 'studio' && (
            <StudioView
              project={activeProject}
              onUpdateProject={(updated) => handleUpdateActiveProject(updated, true)}
              onSaveToFirebase={async (proj) => {
                saveSingleLocalProject(proj);
                const uid = currentUser?.uid || activeLicenseUser?.ID_Usuario;
                if (uid) {
                  await saveProjectToFirestore(uid, proj);
                }
              }}
              onOpenPlayer={(variation) => setActivePlayerVariation(variation)}
            />
          )}

          {currentTab === 'veo3' && (
            <VeoPromptWizard initialTrendingProduct={veoInitialProduct} />
          )}

          {currentTab === 'trending' && (
            <TrendingRadarView
              onCloneToStudio={handleCloneFromTrending}
              onSendToVeo3={handleSendProductToVeo3}
            />
          )}

          {currentTab === 'remix' && <RemixLiveView />}

          {currentTab === 'academy' && (
            <AcademyView
              onGoToStudio={() => setCurrentTab('studio')}
              onGoToVeo={() => setCurrentTab('veo3')}
            />
          )}

          {currentTab === 'admin_licencas' && (
            <AdminLicensesView onNotifyToast={triggerToast} />
          )}
        </div>
      </main>
      </div>

      {/* Mobile Bottom Thumb Navigation Bar (Visible only on < 1024px) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-slate-950/95 backdrop-blur-2xl border-t border-purple-500/20 px-2 py-1.5 flex items-center justify-around shadow-[0_-10px_25px_rgba(0,0,0,0.5)]">
        {[
          { id: 'dashboard' as TabId, label: 'Dashboard', icon: LayoutDashboard },
          { id: 'studio' as TabId, label: 'Estúdio 3x3', icon: Layers },
          { id: 'veo3' as TabId, label: 'Prompt VEO', icon: Sparkles },
          { id: 'trending' as TabId, label: 'Radar Viral', icon: TrendingUp },
          { id: 'more' as const, label: 'Mais...', icon: MoreHorizontal, isDrawer: true },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = !item.isDrawer && currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.isDrawer) {
                  setMobileMenuOpen(true);
                } else {
                  setCurrentTab(item.id as TabId);
                }
              }}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-h-[44px] min-w-[54px] ${
                isActive
                  ? 'text-fuchsia-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-purple-900/50 border border-fuchsia-500/50 shadow-[0_0_10px_rgba(217,70,239,0.3)]'
                    : ''
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-fuchsia-400' : 'text-slate-400'}`} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Video Player & MP4 Exporter Modal */}
      <VideoPlayerModal
        variation={activePlayerVariation}
        onClose={() => setActivePlayerVariation(null)}
        onOpenZipModal={() => setIsGlobalZipOpen(true)}
        totalVariationsCount={activeProject.generatedVariations?.length || 0}
        onUpdateVariation={(updatedVar) => {
          setActivePlayerVariation(updatedVar);
          const nextHooks = activeProject.hooks.map((h) =>
            h.id === updatedVar.hookClip?.id && updatedVar.hookClip ? { ...h, subtitleText: updatedVar.hookClip.subtitleText } : h
          );
          const nextBodies = activeProject.bodies.map((b) =>
            b.id === updatedVar.bodyClip?.id && updatedVar.bodyClip ? { ...b, subtitleText: updatedVar.bodyClip.subtitleText } : b
          );
          const nextCtas = activeProject.ctas.map((c) =>
            c.id === updatedVar.ctaClip?.id && updatedVar.ctaClip ? { ...c, subtitleText: updatedVar.ctaClip.subtitleText } : c
          );
          const updatedVars = activeProject.generatedVariations.map((v) => {
            if (v.id === updatedVar.id) return updatedVar;
            return {
              ...v,
              hookClip: v.hookClip?.id === updatedVar.hookClip?.id ? updatedVar.hookClip : v.hookClip,
              bodyClip: v.bodyClip?.id === updatedVar.bodyClip?.id ? updatedVar.bodyClip : v.bodyClip,
              ctaClip: v.ctaClip?.id === updatedVar.ctaClip?.id ? updatedVar.ctaClip : v.ctaClip,
            };
          });
          handleUpdateActiveProject({
            hooks: nextHooks,
            bodies: nextBodies,
            ctas: nextCtas,
            generatedVariations: updatedVars,
          });
        }}
        onDeleteVariation={(variationId) => {
          const updatedVars = activeProject.generatedVariations.filter((v) => v.id !== variationId);
          handleUpdateActiveProject({
            generatedVariations: updatedVars,
            videosGenerated: updatedVars.length,
          });
          triggerToast('Variação excluída com sucesso.');
        }}
      />

      {/* Global Batch Download ZIP Modal */}
      <BatchDownloadModal
        isOpen={isGlobalZipOpen}
        onClose={() => setIsGlobalZipOpen(false)}
        project={activeProject}
        variations={activeProject.generatedVariations}
      />

      {/* Settings Modal (BYOK) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(updated) => {
          setSettings(updated);
          triggerToast('Configurações salvas no navegador com sucesso!');
        }}
      />

      {/* Auth Modal (Admin Login & Password) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Interactive Paywall / Upgrade Modal */}
      {isPaywallOpen && activeLicenseUser && (
        <PaywallModal
          user={activeLicenseUser}
          onUpgradeSuccess={(updated) => {
            setActiveLicenseUser(updated);
            setIsPaywallOpen(false);
            triggerToast('🎉 Licença Anual Ativada com Sucesso (+365 Dias)!');
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl glass-card border border-fuchsia-500/50 text-xs font-bold text-white shadow-[0_0_30px_rgba(217,70,239,0.35)] animate-fade-in bg-slate-950/95 max-w-[90vw]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="line-clamp-2">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
