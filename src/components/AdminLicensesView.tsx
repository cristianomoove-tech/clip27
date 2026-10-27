import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  ShieldCheck, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  Phone, 
  MessageSquare, 
  Calendar, 
  Plus, 
  RefreshCw, 
  Bot, 
  Lock, 
  Unlock, 
  Zap, 
  ExternalLink,
  X,
  Mail,
  User as UserIcon,
  Trash2,
  Database
} from 'lucide-react';
import { UsuarioLicenca, StatusPlano, UserRole } from '../types';
import { 
  fetchAllLicenses, 
  subscribeToAllLicenses,
  deleteLicenseUser,
  adminGrantAnnualLicense, 
  adminGrantExtraTrial, 
  adminBlockUser, 
  runExpirationBot, 
  buildWhatsAppBillingLink, 
  registerTrialUser,
  persistLicense,
  LICENSE_ANNUAL_PRICE,
  ExpirationBotResult
} from '../services/licensingService';

interface AdminLicensesViewProps {
  onNotifyToast: (msg: string) => void;
}

export const AdminLicensesView: React.FC<AdminLicensesViewProps> = ({ onNotifyToast }) => {
  const [licenses, setLicenses] = useState<UsuarioLicenca[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StatusPlano>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(true);
  const [botResult, setBotResult] = useState<ExpirationBotResult | null>(null);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UsuarioLicenca | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New user form state
  const [newNome, setNewNome] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newStatus, setNewStatus] = useState<StatusPlano>('Trial_3_Dias');

  // Real-time synchronization with Firestore database
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToAllLicenses(
      (data, isCloud) => {
        setLicenses(data);
        setIsCloudConnected(isCloud);
        setIsLoading(false);
      },
      (err) => {
        console.warn('Erro ao conectar ao Firestore:', err);
        setIsCloudConnected(false);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Manual refresh trigger
  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllLicenses();
      setLicenses(data);
      setIsCloudConnected(true);
      onNotifyToast('🔄 Dados atualizados com o banco de dados!');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete user from real Firestore database
  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setIsDeleting(true);
    try {
      await deleteLicenseUser(deleteConfirmUser.ID_Usuario);
      onNotifyToast(`🗑️ Usuário ${deleteConfirmUser.Nome} excluído com sucesso do banco de dados!`);
      setDeleteConfirmUser(null);
    } catch (e: any) {
      alert(e?.message || 'Erro ao excluir usuário');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered licenses
  const filteredLicenses = licenses.filter((u) => {
    const matchesSearch = 
      u.Nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.Email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.WhatsApp.includes(searchTerm);
    
    const matchesFilter = statusFilter === 'ALL' || u.Status_Plano === statusFilter;
    return matchesSearch && matchesFilter;
  });

  // KPI Calculations
  const totalUsuarios = licenses.length;
  const usuariosTrial = licenses.filter((u) => u.Status_Plano === 'Trial_3_Dias').length;
  const licencasAtivas = licenses.filter((u) => u.Status_Plano === 'Ativo_Anual').length;
  const licencasExpiradas = licenses.filter((u) => u.Status_Plano === 'Expirado').length;
  const licencasBloqueadas = licenses.filter((u) => u.Status_Plano === 'Bloqueado').length;
  const faturamentoEstimado = licencasAtivas * LICENSE_ANNUAL_PRICE;

  // 1-Click Action 1: Liberar Anual
  const handleGrantAnnual = async (userId: string, userName: string) => {
    try {
      await adminGrantAnnualLicense(userId);
      await loadData();
      onNotifyToast(`✅ Licença Anual (+365 dias) ativada para ${userName}!`);
    } catch (e: any) {
      alert(e?.message || 'Erro ao liberar licença anual');
    }
  };

  // 1-Click Action 2: +3 Dias de Trial
  const handleGrantExtraTrial = async (userId: string, userName: string) => {
    try {
      await adminGrantExtraTrial(userId);
      await loadData();
      onNotifyToast(`⏳ +3 Dias de Trial concedidos para ${userName}!`);
    } catch (e: any) {
      alert(e?.message || 'Erro ao adicionar dias');
    }
  };

  // 1-Click Action 3: Bloquear Acesso
  const handleBlockUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Tem certeza que deseja bloquear o acesso de ${userName}?`)) return;
    try {
      await adminBlockUser(userId);
      await loadData();
      onNotifyToast(`🚫 Acesso de ${userName} bloqueado.`);
    } catch (e: any) {
      alert(e?.message || 'Erro ao bloquear usuário');
    }
  };

  // Run Expiration Bot Routine
  const handleRunBot = async () => {
    setIsLoading(true);
    try {
      const res = await runExpirationBot();
      setBotResult(res);
      await loadData();
      if (res.expiredCount > 0) {
        onNotifyToast(`🤖 Bot de Vencimento executado: ${res.expiredCount} usuários expirados.`);
      } else {
        onNotifyToast('🤖 Nenhum usuário novo precisou ser expirado hoje.');
      }
    } catch (e: any) {
      alert('Erro ao executar bot: ' + e?.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Manual User Creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome.trim() || !newEmail.trim()) return;

    try {
      const now = new Date();
      let expireStr = '';
      if (newStatus === 'Ativo_Anual') {
        expireStr = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else if (newStatus === 'Trial_3_Dias') {
        expireStr = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else {
        expireStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      const newUser: UsuarioLicenca = {
        ID_Usuario: `usr-${Date.now().toString(36)}`,
        Nome: newNome.trim(),
        Email: newEmail.trim().toLowerCase(),
        WhatsApp: newWhatsapp.trim() || '+55 11 99999-9999',
        Senha: 'user123',
        Role: 'Cliente',
        Status_Plano: newStatus,
        Data_Cadastro: now.toISOString().split('T')[0],
        Data_Expiracao: expireStr,
        Valor_Licenca: LICENSE_ANNUAL_PRICE,
        Data_Ultimo_Pagamento: newStatus === 'Ativo_Anual' ? now.toISOString().split('T')[0] : null,
      };

      await persistLicense(newUser);
      await loadData();
      setIsNewUserModalOpen(false);
      setNewNome('');
      setNewEmail('');
      setNewWhatsapp('');
      onNotifyToast(`Usuário ${newUser.Nome} adicionado com sucesso!`);
    } catch (e: any) {
      alert('Erro ao criar usuário: ' + e?.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 glass-card rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900/90 to-slate-950/80 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(217,70,239,0.4)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Painel Admin — Gestão de Licenças & Cobrança
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                EXCLUSIVO ADMIN
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-bold ${
                isCloudConnected 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isCloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                <Database className="w-3 h-3 text-emerald-400" />
                <span>{isCloudConnected ? 'Firestore Conectado (Ao Vivo)' : 'Sincronizando Nuvem'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Controle de usuários cadastrados vinculados ao banco de dados Firestore em tempo real (<code className="text-purple-300 font-mono">Usuarios_Licencas</code>), concessão de licenças de R$ 49,90 e exclusão de contas.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunBot}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 shadow-md flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            title="Verifica contas de teste vencidas e altera para Expirado automaticamente"
          >
            <Bot className="w-4 h-4 text-amber-300" />
            <span>Executar Bot de Vencimento</span>
          </button>

          <button
            onClick={() => setIsNewUserModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-purple-500/30 flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 text-purple-400" />
            <span>Cadastrar Cliente</span>
          </button>

          <button
            onClick={loadData}
            title="Atualizar dados"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-purple-500/20 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* TOP 5 KPIS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* KPI 1: Total Usuários */}
        <div className="p-4 rounded-2xl glass-card border border-purple-500/20 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Total Usuários</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalUsuarios}</div>
          <div className="text-[10px] text-slate-500 mt-1">Base cadastrada</div>
        </div>

        {/* KPI 2: Em Trial (3 Dias) */}
        <div className="p-4 rounded-2xl glass-card border border-amber-500/30 bg-amber-950/15">
          <div className="flex items-center justify-between text-amber-300 mb-1">
            <span className="text-xs font-medium">Em Trial (3 Dias)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300">{usuariosTrial}</div>
          <div className="text-[10px] text-amber-400/70 mt-1">Testando ativamente</div>
        </div>

        {/* KPI 3: Licenças Anuais Ativas */}
        <div className="p-4 rounded-2xl glass-card border border-emerald-500/30 bg-emerald-950/15">
          <div className="flex items-center justify-between text-emerald-300 mb-1">
            <span className="text-xs font-medium">Licenças Ativas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300">{licencasAtivas}</div>
          <div className="text-[10px] text-emerald-400/70 mt-1">Anuidade R$ 49,90</div>
        </div>

        {/* KPI 4: Faturamento Estimado */}
        <div className="p-4 rounded-2xl glass-card border border-fuchsia-500/30 bg-fuchsia-950/15">
          <div className="flex items-center justify-between text-fuchsia-300 mb-1">
            <span className="text-xs font-medium">Faturamento Est.</span>
            <DollarSign className="w-4 h-4 text-fuchsia-400" />
          </div>
          <div className="text-2xl font-black text-fuchsia-300">
            R$ {faturamentoEstimado.toFixed(2).replace('.', ',')}
          </div>
          <div className="text-[10px] text-fuchsia-400/70 mt-1">{licencasAtivas} × R$ 49,90</div>
        </div>

        {/* KPI 5: Licenças Expiradas */}
        <div className="p-4 rounded-2xl glass-card border border-rose-500/30 bg-rose-950/15 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-rose-300 mb-1">
            <span className="text-xs font-medium">Expiradas / Trava</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-300">{licencasExpiradas}</div>
          <div className="text-[10px] text-rose-400/70 mt-1">Aguardando renovação</div>
        </div>
      </div>

      {/* Bot Execution Results Banner (if ran) */}
      {botResult && (
        <div className="p-4 rounded-2xl bg-fuchsia-950/40 border border-fuchsia-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-fuchsia-300 text-xs font-bold">
              <Bot className="w-4 h-4 text-amber-300" />
              <span>
                Relatório do Bot de Vencimento: {botResult.scannedCount} usuários analisados, {botResult.expiredCount} expirados agora.
              </span>
            </div>
            <button
              onClick={() => setBotResult(null)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Fechar
            </button>
          </div>

          {botResult.generatedMessages.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-300">
                Disparos de cobrança gerados com link direto para WhatsApp:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {botResult.generatedMessages.map((msg, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-900 border border-purple-500/20 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">{msg.userName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{msg.whatsapp}</div>
                    </div>
                    <a
                      href={msg.whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Cobrar R$ 49,90</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">
              Nenhuma mensagem pendente de cobrança. Todas as contas de teste ativas ainda estão dentro do prazo de 3 dias.
            </p>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 glass-card rounded-2xl border border-purple-500/20 bg-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, email ou WhatsApp..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-purple-500/30 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500"
          />
        </div>

        {/* Status Tabs Filter */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: 'ALL', label: `Todos (${licenses.length})` },
            { id: 'Trial_3_Dias', label: `Trial (${usuariosTrial})` },
            { id: 'Ativo_Anual', label: `Anual (${licencasAtivas})` },
            { id: 'Expirado', label: `Expirados (${licencasExpiradas})` },
            { id: 'Bloqueado', label: `Bloqueados (${licencasBloqueadas})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-purple-500/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* LICENSES LIST (Mobile Cards < md | Full Table md+) */}
      {/* 1. MOBILE CARDS VIEW (Visible on smartphones) */}
      <div className="md:hidden space-y-3">
        {filteredLicenses.length === 0 ? (
          <div className="p-8 glass-card rounded-2xl border border-purple-500/20 text-center text-xs text-slate-400">
            Nenhum cliente encontrado com os filtros aplicados.
          </div>
        ) : (
          filteredLicenses.map((user) => {
            const isUserAdminRole = user.Role === 'Admin';
            const now = new Date();
            const expDate = new Date(user.Data_Expiracao);
            const isPast = now.getTime() > expDate.getTime();
            const hasSavedCloudKeys = Boolean(
              (user.OpenRouter_ApiKey && user.OpenRouter_ApiKey.length > 3) ||
                (user.Apify_Token && user.Apify_Token.length > 3)
            );

            return (
              <div
                key={user.ID_Usuario}
                className="p-4 glass-card rounded-2xl border border-purple-500/25 bg-slate-900/80 space-y-3"
              >
                {/* Top Row: User Info + Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isUserAdminRole
                          ? 'bg-gradient-to-tr from-purple-600 to-pink-600 text-white'
                          : 'bg-slate-800 text-slate-200'
                      }`}
                    >
                      {user.Nome[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-white truncate">{user.Nome}</span>
                        {isUserAdminRole && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{user.Email}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    {user.Status_Plano === 'Ativo_Anual' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        <span>Anual</span>
                      </span>
                    )}
                    {user.Status_Plano === 'Trial_3_Dias' && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isPast
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        <span>{isPast ? 'Vencido' : 'Trial 3d'}</span>
                      </span>
                    )}
                    {user.Status_Plano === 'Expirado' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                        <span>Expirado</span>
                      </span>
                    )}
                    {user.Status_Plano === 'Bloqueado' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Bloqueado</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-purple-500/15 text-[11px] font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-sans">WhatsApp</span>
                    <span className="text-slate-200 truncate block">{user.WhatsApp || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-sans">Expiração</span>
                    <span className={isPast && !isUserAdminRole ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                      {user.Data_Expiracao}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-sans">Valor</span>
                    <span className="text-fuchsia-300 font-bold">
                      R$ {user.Valor_Licenca ? user.Valor_Licenca.toFixed(2).replace('.', ',') : '49,90'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-sans">Chaves API Cloud</span>
                    <span className={hasSavedCloudKeys ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                      {hasSavedCloudKeys ? 'Sincronizadas' : 'Padrão Local'}
                    </span>
                  </div>
                </div>

                {/* Mobile Touch-Friendly Actions */}
                {!isUserAdminRole && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <button
                      onClick={() => handleGrantAnnual(user.ID_Usuario, user.Nome)}
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Liberar +365d</span>
                    </button>

                    <button
                      onClick={() => handleGrantExtraTrial(user.ID_Usuario, user.Nome)}
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>+3 Dias Trial</span>
                    </button>

                    <a
                      href={buildWhatsAppBillingLink(user)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-purple-950/70 hover:bg-purple-900 border border-purple-500/30 text-fuchsia-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-fuchsia-400" />
                      <span>Cobrar Pix</span>
                    </a>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBlockUser(user.ID_Usuario, user.Nome)}
                        title="Bloquear Acesso"
                        className="flex-1 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Bloquear</span>
                      </button>

                      <button
                        onClick={() => setDeleteConfirmUser(user)}
                        title="Excluir Usuário"
                        className="min-h-[40px] min-w-[42px] rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-400 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 2. DESKTOP TABLE VIEW (Visible on md+) */}
      <div className="hidden md:block glass-card rounded-3xl border border-purple-500/20 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-purple-500/20">
              <tr>
                <th className="py-3.5 px-4">Cliente / E-mail</th>
                <th className="py-3.5 px-4">WhatsApp / Cobrança</th>
                <th className="py-3.5 px-4">Status da Licença</th>
                <th className="py-3.5 px-4">Data Cadastro</th>
                <th className="py-3.5 px-4">Data Expiração</th>
                <th className="py-3.5 px-4">Valor</th>
                <th className="py-3.5 px-4 text-right">Ações Rápidas (1 Clique)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-500/10">
              {filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhum cliente encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((user) => {
                  const isUserAdminRole = user.Role === 'Admin';
                  const now = new Date();
                  const expDate = new Date(user.Data_Expiracao);
                  const isPast = now.getTime() > expDate.getTime();

                  return (
                    <tr key={user.ID_Usuario} className="hover:bg-purple-950/20 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isUserAdminRole 
                              ? 'bg-gradient-to-tr from-purple-600 to-pink-600 text-white' 
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {user.Nome[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-white">
                              <span>{user.Nome}</span>
                              {isUserAdminRole && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  ADMIN MASTER
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">{user.Email}</div>
                          </div>
                        </div>
                      </td>

                      {/* WhatsApp with click-to-chat */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span>{user.WhatsApp || 'Não informado'}</span>
                          {user.WhatsApp && (
                            <a
                              href={buildWhatsAppBillingLink(user)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Conversar / Enviar Cobrança WhatsApp"
                              className="p-1 rounded bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 transition-colors"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {user.Status_Plano === 'Ativo_Anual' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Ativo Anual</span>
                          </span>
                        )}
                        {user.Status_Plano === 'Trial_3_Dias' && (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isPast 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>{isPast ? 'Trial Vencido' : 'Trial (3 Dias)'}</span>
                          </span>
                        )}
                        {user.Status_Plano === 'Expirado' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            <span>Expirado</span>
                          </span>
                        )}
                        {user.Status_Plano === 'Bloqueado' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>Bloqueado</span>
                          </span>
                        )}
                      </td>

                      {/* Data Cadastro */}
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {user.Data_Cadastro}
                      </td>

                      {/* Data Expiracao */}
                      <td className="py-3.5 px-4 font-mono">
                        <span className={isPast && user.Role !== 'Admin' ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {user.Data_Expiracao}
                        </span>
                      </td>

                      {/* Valor */}
                      <td className="py-3.5 px-4 font-mono font-bold text-fuchsia-300">
                        R$ {user.Valor_Licenca ? user.Valor_Licenca.toFixed(2).replace('.', ',') : '49,90'}
                      </td>

                      {/* 1-Click Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        {isUserAdminRole ? (
                          <span className="text-[10px] font-mono text-slate-500 italic">Admin Master</span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {/* Action 1: Liberar Anual */}
                            <button
                              onClick={() => handleGrantAnnual(user.ID_Usuario, user.Nome)}
                              title="Liberar Licença Anual (+365 Dias - R$ 49,90)"
                              className="px-2 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span className="hidden xl:inline">+365d</span>
                            </button>

                            {/* Action 2: Dar +3 Dias Trial */}
                            <button
                              onClick={() => handleGrantExtraTrial(user.ID_Usuario, user.Nome)}
                              title="Dar +3 Dias de Teste Grátis"
                              className="px-2 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Clock className="w-3 h-3 text-cyan-400" />
                              <span className="hidden xl:inline">+3d Trial</span>
                            </button>

                            {/* Action 3: Bloquear Acesso */}
                            <button
                              onClick={() => handleBlockUser(user.ID_Usuario, user.Nome)}
                              title="Bloquear Acesso Imediatamente"
                              className="p-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 cursor-pointer transition-colors"
                            >
                              <Lock className="w-3 h-3" />
                            </button>

                            {/* Action 4: WhatsApp Billing Pitch */}
                            <a
                              href={buildWhatsAppBillingLink(user)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Enviar Mensagem de Cobrança R$ 49,90 via WhatsApp"
                              className="p-1 rounded-lg bg-purple-950/60 hover:bg-purple-900 border border-purple-500/30 text-fuchsia-300 cursor-pointer transition-colors"
                            >
                              <MessageSquare className="w-3 h-3 text-fuchsia-400" />
                            </a>

                            {/* Action 5: Excluir Usuário */}
                            <button
                              onClick={() => setDeleteConfirmUser(user)}
                              title="Excluir Usuário do Banco de Dados Firestore"
                              className="p-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-400 hover:text-rose-200 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual New User Modal */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-purple-500/30 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-purple-500/20">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-fuchsia-400" />
                <span>Novo Cliente / Licença Manual</span>
              </h3>
              <button
                onClick={() => setIsNewUserModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Nome do Cliente</label>
                <input
                  type="text"
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">E-mail</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="cliente@exemplo.com"
                  required
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">WhatsApp</label>
                <input
                  type="tel"
                  value={newWhatsapp}
                  onChange={(e) => setNewWhatsapp(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Plano Inicial</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="Trial_3_Dias">Trial de 3 Dias (Grátis)</option>
                  <option value="Ativo_Anual">Ativo Anual (R$ 49,90 / 365 dias)</option>
                  <option value="Expirado">Expirado</option>
                  <option value="Bloqueado">Bloqueado</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 cursor-pointer shadow-md"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/40 p-6 shadow-2xl relative">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-4 shadow-lg shadow-rose-950/40">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-white mb-2">
              Excluir Usuário do Banco de Dados?
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Você está prestes a excluir permanentemente o cadastro de{' '}
              <strong className="text-rose-300 font-bold">{deleteConfirmUser.Nome}</strong>{' '}
              ({deleteConfirmUser.Email}) da coleção <code className="text-purple-300 font-mono bg-purple-950/50 px-1 py-0.5 rounded">Usuarios_Licencas</code> no Firestore.
              Esta operação é irreversível e revoga imediatamente o acesso do cliente.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/20 text-[11px] text-slate-400 space-y-1.5 mb-5">
              <div className="flex justify-between">
                <span className="text-slate-500">ID Usuário:</span>
                <span className="font-mono text-purple-300 text-[10px]">{deleteConfirmUser.ID_Usuario}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status atual:</span>
                <span className="font-bold text-white">{deleteConfirmUser.Status_Plano}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">WhatsApp:</span>
                <span className="font-mono text-slate-300">{deleteConfirmUser.WhatsApp}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/60 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Excluindo do Banco...' : 'Excluir Usuário'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
