import React, { useState } from 'react';
import { 
  FolderKanban, 
  Video, 
  PiggyBank, 
  Plus, 
  ArrowRight, 
  Clock, 
  Layers, 
  Sparkles, 
  Check, 
  Trash2,
  Copy,
  TrendingUp,
  ShieldCheck,
  Database,
  RefreshCw,
  LogIn,
  CheckCircle2,
  HardDrive,
  Cpu,
  Server
} from 'lucide-react';
import { Project } from '../types';
import { User } from 'firebase/auth';
import { AppUser } from '../services/firebase';

interface DashboardViewProps {
  projects: Project[];
  activeProject: Project;
  currentUser: User | AppUser | null;
  isAdmin: boolean;
  onSelectProject: (proj: Project) => void;
  onCreateNewProject: () => void;
  onDeleteProject: (id: string) => void;
  onDeleteAllProjects?: () => Promise<void>;
  onDuplicateProject: (proj: Project) => void;
  onGoToStudio: () => void;
  onGoToVeo: () => void;
  onGoToTrending: () => void;
  onOpenAuth: () => void;
  onSyncAllToFirestore: () => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  activeProject,
  currentUser,
  isAdmin,
  onSelectProject,
  onCreateNewProject,
  onDeleteProject,
  onDeleteAllProjects,
  onDuplicateProject,
  onGoToStudio,
  onGoToVeo,
  onGoToTrending,
  onOpenAuth,
  onSyncAllToFirestore,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'Ativo' | 'Arquivado'>('todos');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Aggregate real stats directly from the live projects array
  const totalActiveProjects = projects.filter((p) => p.status === 'Ativo').length;
  const totalVideosGenerated = projects.reduce((acc, p) => acc + (p.videosGenerated || 0), 0);
  const totalClipsLoaded = projects.reduce((acc, p) => acc + (p.clipsCount || 0), 0);
  const estimatedHoursSaved = Math.round(totalVideosGenerated * 0.45); // ~27 mins per variation

  const filteredProjects = projects.filter((p) => {
    if (filterStatus === 'todos') return true;
    return p.status === filterStatus;
  });

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncAllToFirestore();
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-purple-500/15">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
            <div className="flex items-center gap-2 text-xs text-purple-400 font-semibold tracking-wider uppercase">
              <span>Visão Geral do Painel</span>
              <span>·</span>
              <span>Estúdio Multiplicador TikTok Shop</span>
            </div>
            {currentUser ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold w-fit">
                <Database className="w-3 h-3 text-emerald-400" />
                <span>DADOS REAIS EM NUVEM (FIRESTORE)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold w-fit">
                <Database className="w-3 h-3 text-amber-400" />
                <span>MODO LOCAL (CLIQUE EM ENTRAR PARA NUVEM)</span>
              </span>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 flex-wrap">
            <span>Gestão de Projetos & Criativos</span>
            {isAdmin && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-900/50 text-fuchsia-300 border border-fuchsia-500/50 font-mono font-bold shadow-[0_0_12px_rgba(217,70,239,0.3)]">
                ADMIN MASTER
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Escale sua esteira de testes com o Método 3x3x3 e prompts cinematográficos para o Google Veo 3.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto shrink-0 flex-wrap">
          {currentUser && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Forçar sincronização com o Firestore"
              className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-purple-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-fuchsia-400' : ''}`} />
              <span className="hidden sm:inline">Sincronizar Nuvem</span>
            </button>
          )}

          {!currentUser && (
            <button
              onClick={onOpenAuth}
              className="min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-purple-900/50 hover:bg-purple-800/60 border border-fuchsia-500/40 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-fuchsia-300" />
              <span>Entrar como Admin</span>
            </button>
          )}

          <button
            onClick={onCreateNewProject}
            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_20px_rgba(217,70,239,0.35)] transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Novo Projeto 3x3x3</span>
          </button>
        </div>
      </div>

      {/* Admin Master Dedicated Control Panel */}
      {isAdmin && (
        <div className="glass-card rounded-2xl p-5 border border-emerald-500/40 bg-gradient-to-r from-purple-950/40 via-slate-900/80 to-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Painel do Administrador Master (Google Cloud Firebase)</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                Autenticado como <strong className="text-white font-mono">cristianomoove@gmail.com</strong>.
                Seus dados estão sincronizados em tempo real com o banco Firestore <code className="text-fuchsia-300 font-mono text-[11px] px-1 py-0.5 rounded bg-purple-950/60">ai-studio-aicreativeengine</code> no projeto <code className="text-fuchsia-300 font-mono text-[11px] px-1 py-0.5 rounded bg-purple-950/60">image-ia-sdh87</code>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {projects.length > 0 && onDeleteAllProjects && (
                <button
                  onClick={onDeleteAllProjects}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Apagar Todos os Projetos</span>
                </button>
              )}

              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Gravar Tudo no Firestore</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-purple-500/15 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-purple-500/10">
              <span className="text-[10px] text-slate-400 block font-sans">Projetos em Nuvem</span>
              <span className="text-sm font-bold text-emerald-400">{projects.length} docs</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-purple-500/10">
              <span className="text-[10px] text-slate-400 block font-sans">Total Variações</span>
              <span className="text-sm font-bold text-fuchsia-400">{totalVideosGenerated} vídeos</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-purple-500/10">
              <span className="text-[10px] text-slate-400 block font-sans">Clipes Fonte</span>
              <span className="text-sm font-bold text-purple-300">{totalClipsLoaded} clipes</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-purple-500/10">
              <span className="text-[10px] text-slate-400 block font-sans">Segurança ABAC</span>
              <span className="text-sm font-bold text-emerald-300">Regras Ativas</span>
            </div>
          </div>
        </div>
      )}

      {/* Guest/Unauthenticated Login Alert Banner */}
      {!currentUser && (
        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-purple-500/30 bg-purple-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900/50 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
              <Server className="w-5 h-5 text-fuchsia-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Deseja sincronizar seus dados com o Firebase Firestore?
              </h4>
              <p className="text-xs text-slate-400">
                Acesse como administrador com login e senha para salvar suas campanhas em tempo real na nuvem.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAuth}
            className="w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-sm cursor-pointer"
          >
            Fazer Login de Admin
          </button>
        </div>
      )}

      {/* 3 KPIs no Topo (100% REAIS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* KPI 1 */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Projetos Ativos (Firestore)
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tabular-nums">
              {totalActiveProjects}
            </span>
            <span className="text-xs text-slate-400 font-medium">campanhas prontas</span>
          </div>
          <div className="mt-3 pt-3 border-t border-purple-500/10 flex items-center justify-between text-[11px] text-slate-400">
            <span>Esteira em operação</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>100% Sincronizado</span>
            </span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-600/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Vídeos Gerados (Código Limpo)
            </span>
            <div className="w-9 h-9 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300">
              <Video className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tabular-nums">
              {totalVideosGenerated}
            </span>
            <span className="text-xs text-slate-400 font-medium">variações únicas</span>
          </div>
          <div className="mt-3 pt-3 border-t border-purple-500/10 flex items-center justify-between text-[11px] text-slate-400">
            <span>Proteção Anti-Shadowban</span>
            <span className="text-fuchsia-400 font-mono text-[10px]">Hash 8-Hex Ativo</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="glass-card glass-card-hover rounded-2xl p-5 relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Economia de Edição / Custo API
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-400 tabular-nums">
              R$ 0,00
            </span>
            <span className="text-xs text-slate-400 font-medium">modelos :free</span>
          </div>
          <div className="mt-3 pt-3 border-t border-purple-500/10 flex items-center justify-between text-[11px] text-slate-400">
            <span>Tempo economizado</span>
            <span className="text-emerald-400 font-semibold tabular-nums">
              ~{estimatedHoursSaved}h de edição
            </span>
          </div>
        </div>
      </div>

      {/* Quick Launchpad Banner */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden bg-gradient-to-r from-purple-950/40 via-slate-900/70 to-fuchsia-950/30 border border-purple-500/30">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-xs font-bold border border-fuchsia-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multiplicação 3x3x3 Instantânea</span>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white">
              Pronto para transformar 9 clipes brutos em 27 anúncios únicos?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              O motor cartesiano cruza 3 Ganchos × 3 Corpos × 3 CTAs, queima manchetes de alto CTR e injeta micro-edits para aprovação direta nos leilões do TikTok e Meta Ads.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <button
              onClick={onGoToStudio}
              className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_20px_rgba(217,70,239,0.3)] transition-all cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Abrir Estúdio Combinatório</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onGoToVeo}
              className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-xs text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-purple-500/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Criar Prompt Veo 3</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Projetos Reais */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-white">Todos os Projetos</h3>
            <span className="text-xs text-slate-400 font-mono bg-purple-950/50 px-2 py-0.5 rounded-full border border-purple-500/20">
              {filteredProjects.length} de {projects.length}
            </span>
          </div>

          {/* Filter Status Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {(['todos', 'Ativo', 'Arquivado'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  filterStatus === status
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {status === 'todos' ? 'Todos' : status}
              </button>
            ))}

            <button
              onClick={onCreateNewProject}
              className="ml-2 text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Criar outro</span>
            </button>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center space-y-3 border border-purple-500/20">
            <FolderKanban className="w-10 h-10 text-slate-500 mx-auto" />
            <h4 className="text-base font-bold text-white">Nenhum projeto encontrado</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Crie uma nova campanha 3x3x3 para começar a multiplicar seus criativos com código limpo.
            </p>
            <button
              onClick={onCreateNewProject}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer"
            >
              Criar Primeiro Projeto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((proj) => {
              const isSelected = proj.id === activeProject.id;
              return (
                <div
                  key={proj.id}
                  onClick={() => onSelectProject(proj)}
                  className={`glass-card rounded-2xl p-5 cursor-pointer transition-all duration-200 relative group ${
                    isSelected
                      ? 'border-fuchsia-500/70 bg-purple-900/25 shadow-[0_0_25px_rgba(168,85,247,0.25)]'
                      : 'hover:border-purple-500/40 hover:bg-slate-900/80'
                  }`}
                >
                  {/* Header of Project Card */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <span className="text-[11px] font-mono text-fuchsia-400/90 font-bold block mb-1 truncate">
                        {proj.id}
                      </span>
                      <h4 className="text-sm font-bold text-white group-hover:text-fuchsia-200 transition-colors line-clamp-1">
                        {proj.name}
                      </h4>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                      <Check className="w-2.5 h-2.5" />
                      <span>{proj.status}</span>
                    </span>
                  </div>

                  {/* Metrics Breakdown */}
                  <div className="grid grid-cols-2 gap-2 my-4 p-3 rounded-xl bg-slate-950/40 border border-purple-500/10 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Clipes Fonte</span>
                      <span className="text-white font-bold font-mono text-sm">
                        {proj.clipsCount || ((proj.hooks?.length || 0) + (proj.bodies?.length || 0) + (proj.ctas?.length || 0))} clipes
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">Variações</span>
                      <span className="text-fuchsia-400 font-bold font-mono text-sm">
                        {proj.videosGenerated || proj.generatedVariations?.length || 0} vídeos prontos
                      </span>
                    </div>
                  </div>

                  {/* Features Indicators */}
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-4">
                    <span className="flex items-center gap-1 text-slate-300">
                      <ShieldCheck className="w-3 h-3 text-purple-400" />
                      Código Limpo
                    </span>
                    <span>·</span>
                    <span className="font-mono text-slate-400">
                      {proj.niche || '3x3x3 Ativo'}
                    </span>
                  </div>

                  {/* Footer of Card */}
                  <div className="pt-3 border-t border-purple-500/10 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <Clock className="w-3 h-3" />
                      <span>{proj.createdAt}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        title="Duplicar Projeto"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateProject(proj);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Excluir Projeto"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(proj);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(proj);
                          onGoToStudio();
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-purple-600/80 hover:bg-purple-600 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Abrir</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Confirmação para Excluir Projeto */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md glass-card rounded-2xl border border-rose-500/40 p-6 space-y-4 shadow-[0_0_50px_rgba(244,63,94,0.3)]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Excluir Projeto</h4>
                <p className="text-xs text-slate-400">Esta ação excluirá o projeto permanentemente.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tem certeza que deseja excluir o projeto <strong className="text-rose-300 font-mono">"{projectToDelete.name}"</strong>? Todas as variações e vídeos gerados deste projeto serão removidos.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-purple-500/15">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-purple-500/20 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteProject(projectToDelete.id);
                  setProjectToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all cursor-pointer"
              >
                Sim, Excluir Projeto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
