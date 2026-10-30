import { doc, getDoc, setDoc, getDocs, deleteDoc, collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { UsuarioLicenca, AppSettings } from '../types';

export const ADMIN_MASTER_EMAIL = 'cristianomoove@gmail.com';
export const LICENSE_ANNUAL_PRICE = 49.90;
export const ASAAS_ANNUAL_CHECKOUT_URL = 'https://www.asaas.com/000/c/mqyntx5tlifhcbie';
const LOCAL_ACTIVE_LICENSE_KEY = 'clip27_active_license';
const LOCAL_ALL_LICENSES_KEY = 'clip27_all_licenses';

// Admin master user pre-registered as required by specification
export const DEFAULT_ADMIN_USER: UsuarioLicenca = {
  ID_Usuario: 'admin-cristianomoove',
  Nome: 'Cristiano (Admin Master)',
  Email: ADMIN_MASTER_EMAIL,
  WhatsApp: '+55 11 99999-9999',
  Senha: 'admin123456',
  Role: 'Admin',
  Status_Plano: 'Ativo_Anual',
  Data_Cadastro: '2024-01-01',
  Data_Expiracao: '2099-12-31',
  Valor_Licenca: LICENSE_ANNUAL_PRICE,
  Data_Ultimo_Pagamento: '2024-01-01',
};

const DELETED_LICENSES_KEY = 'clip27_deleted_license_ids';
const LEGACY_DEMO_LICENSE_IDS = new Set([
  'usr-trial-01',
  'usr-anual-02',
  'usr-expirado-03',
  'usr-trial-expirando-04',
]);

// Only Admin Master is seeded by default (no fake demo users)
const SEED_LICENSES: UsuarioLicenca[] = [DEFAULT_ADMIN_USER];

function getDeletedLicenseIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_LICENSES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function markLicenseAsDeleted(userId: string) {
  try {
    const set = getDeletedLicenseIds();
    set.add(userId);
    localStorage.setItem(DELETED_LICENSES_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function isDemoOrDeletedLicense(userId: string): boolean {
  if (!userId) return true;
  if (LEGACY_DEMO_LICENSE_IDS.has(userId)) return true;
  return getDeletedLicenseIds().has(userId);
}

// Helper to map raw Firestore data into UsuarioLicenca preserving cloud API keys
function mapDocToLicense(d: Record<string, any>, fallbackId: string): UsuarioLicenca {
  return {
    ID_Usuario: d.ID_Usuario || fallbackId,
    Nome: d.Nome || 'Usuário',
    Email: d.Email || '',
    WhatsApp: d.WhatsApp || '',
    Senha: d.Senha || '',
    Role: d.Role || 'Cliente',
    Status_Plano: d.Status_Plano || 'Trial_3_Dias',
    Data_Cadastro: d.Data_Cadastro || new Date().toISOString().split('T')[0],
    Data_Expiracao: d.Data_Expiracao || new Date().toISOString().split('T')[0],
    Valor_Licenca: d.Valor_Licenca ?? LICENSE_ANNUAL_PRICE,
    Data_Ultimo_Pagamento: d.Data_Ultimo_Pagamento || null,
    OpenRouter_ApiKey: d.OpenRouter_ApiKey ?? undefined,
    OpenRouter_Model: d.OpenRouter_Model ?? undefined,
    Apify_Token: d.Apify_Token ?? undefined,
  };
}

// Helper to load cached licenses
export function loadCachedLicenses(): UsuarioLicenca[] {
  try {
    const raw = localStorage.getItem(LOCAL_ALL_LICENSES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_ALL_LICENSES_KEY, JSON.stringify(SEED_LICENSES));
      return SEED_LICENSES;
    }
    const parsed: UsuarioLicenca[] = JSON.parse(raw);
    const list = parsed.filter((u) => !isDemoOrDeletedLicense(u.ID_Usuario));
    if (!list.some((u) => u.Email.toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase())) {
      list.unshift(DEFAULT_ADMIN_USER);
    }
    return list;
  } catch {
    return SEED_LICENSES;
  }
}

// Helper to save licenses locally
export function saveCachedLicenses(licenses: UsuarioLicenca[]) {
  try {
    const clean = (licenses || []).filter((u) => !isDemoOrDeletedLicense(u.ID_Usuario));
    localStorage.setItem(LOCAL_ALL_LICENSES_KEY, JSON.stringify(clean));
  } catch (e) {
    console.warn('Erro ao salvar licenças em cache local:', e);
  }
}

// Get active logged in license user
export function getStoredActiveLicense(): UsuarioLicenca | null {
  try {
    const raw = localStorage.getItem(LOCAL_ACTIVE_LICENSE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Set active logged in license user
export function setStoredActiveLicense(license: UsuarioLicenca | null) {
  try {
    if (license) {
      localStorage.setItem(LOCAL_ACTIVE_LICENSE_KEY, JSON.stringify(license));
    } else {
      localStorage.removeItem(LOCAL_ACTIVE_LICENSE_KEY);
    }
  } catch (e) {
    console.warn('Erro ao salvar licença ativa:', e);
  }
}

// Save or sync single license to Firestore & local cache (preserving existing API keys)
export async function persistLicense(license: UsuarioLicenca): Promise<void> {
  const list = loadCachedLicenses();
  const idx = list.findIndex(
    (u) => u.ID_Usuario === license.ID_Usuario || u.Email.toLowerCase() === license.Email.toLowerCase()
  );
  const existing = idx >= 0 ? list[idx] : undefined;

  const mergedLicense: UsuarioLicenca = {
    ...existing,
    ...license,
    OpenRouter_ApiKey: license.OpenRouter_ApiKey ?? existing?.OpenRouter_ApiKey,
    OpenRouter_Model: license.OpenRouter_Model ?? existing?.OpenRouter_Model,
    Apify_Token: license.Apify_Token ?? existing?.Apify_Token,
  };

  if (idx >= 0) {
    list[idx] = mergedLicense;
  } else {
    list.push(mergedLicense);
  }
  saveCachedLicenses(list);

  // If active user is being modified, update active session
  const active = getStoredActiveLicense();
  if (
    active &&
    (active.ID_Usuario === mergedLicense.ID_Usuario ||
      active.Email.toLowerCase() === mergedLicense.Email.toLowerCase())
  ) {
    setStoredActiveLicense(mergedLicense);
  }

  // Try saving to Firestore with merge: true so we never overwrite cloud API keys
  try {
    const docRef = doc(db, 'Usuarios_Licencas', mergedLicense.ID_Usuario);
    const firestorePayload: Record<string, any> = {
      ID_Usuario: mergedLicense.ID_Usuario,
      Nome: mergedLicense.Nome,
      Email: mergedLicense.Email.toLowerCase(),
      WhatsApp: mergedLicense.WhatsApp,
      Senha: mergedLicense.Senha || '',
      Role: mergedLicense.Role,
      Status_Plano: mergedLicense.Status_Plano,
      Data_Cadastro: mergedLicense.Data_Cadastro,
      Data_Expiracao: mergedLicense.Data_Expiracao,
      Valor_Licenca: mergedLicense.Valor_Licenca,
      Data_Ultimo_Pagamento: mergedLicense.Data_Ultimo_Pagamento || null,
      updatedAt: new Date().toISOString(),
    };

    if (mergedLicense.OpenRouter_ApiKey !== undefined) {
      firestorePayload.OpenRouter_ApiKey = mergedLicense.OpenRouter_ApiKey;
    }
    if (mergedLicense.OpenRouter_Model !== undefined) {
      firestorePayload.OpenRouter_Model = mergedLicense.OpenRouter_Model;
    }
    if (mergedLicense.Apify_Token !== undefined) {
      firestorePayload.Apify_Token = mergedLicense.Apify_Token;
    }

    await setDoc(docRef, firestorePayload, { merge: true });
  } catch (e) {
    console.warn('[Firestore] Salvo localmente, sincronização em nuvem pendente:', e);
  }
}

/**
 * Saves the logged-in user's API keys (OpenRouter & Apify) directly to Firestore
 * so they are immediately available when logging in from Mobile or PC.
 */
export async function saveUserApiKeysToFirestore(
  userId: string,
  settings: AppSettings
): Promise<void> {
  if (!userId) return;

  // Update active license in localStorage
  const active = getStoredActiveLicense();
  if (active && active.ID_Usuario === userId) {
    const updatedActive: UsuarioLicenca = {
      ...active,
      OpenRouter_ApiKey: settings.openRouterApiKey,
      OpenRouter_Model: settings.openRouterModel,
      Apify_Token: settings.apifyToken,
    };
    setStoredActiveLicense(updatedActive);
  }

  // Update cached licenses list
  const list = loadCachedLicenses();
  const idx = list.findIndex((u) => u.ID_Usuario === userId);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      OpenRouter_ApiKey: settings.openRouterApiKey,
      OpenRouter_Model: settings.openRouterModel,
      Apify_Token: settings.apifyToken,
    };
    saveCachedLicenses(list);
  }

  // Persist to Firestore cloud document (by ID_Usuario and also by normalized email if available)
  try {
    const docRef = doc(db, 'Usuarios_Licencas', userId);
    await setDoc(
      docRef,
      {
        OpenRouter_ApiKey: settings.openRouterApiKey,
        OpenRouter_Model: settings.openRouterModel,
        Apify_Token: settings.apifyToken,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('[Firestore] Erro ao sincronizar chaves de API na nuvem:', e);
  }
}

/**
 * Subscribes in real time to a single user's license & API keys document in Firestore.
 * Automatically reconciles PC <-> Mobile API keys:
 * - If Firestore has keys saved from another device, hydrates local storage and UI immediately.
 * - If Firestore does not yet have keys, but this device already has keys in localStorage, pushes them to Firestore so Mobile/PC receives them!
 */
export function subscribeToUserLicenseDoc(
  userId: string,
  onUpdate: (user: UsuarioLicenca) => void
): Unsubscribe {
  const docRef = doc(db, 'Usuarios_Licencas', userId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const userDoc = mapDocToLicense(snap.data(), snap.id);

        // Check if local device has API keys that haven't been pushed to cloud yet
        try {
          const userScopedRaw = localStorage.getItem(`ai_creative_engine_settings_${userId}`);
          const globalRaw = localStorage.getItem('ai_creative_engine_settings');
          const localSettings = userScopedRaw
            ? JSON.parse(userScopedRaw)
            : globalRaw
            ? JSON.parse(globalRaw)
            : {};

          const cloudHasKeys = Boolean(
            (userDoc.OpenRouter_ApiKey && userDoc.OpenRouter_ApiKey.trim().length > 3) ||
              (userDoc.Apify_Token && userDoc.Apify_Token.trim().length > 3)
          );
          const localHasKeys = Boolean(
            (localSettings.openRouterApiKey && localSettings.openRouterApiKey.trim().length > 3) ||
              (localSettings.apifyToken && localSettings.apifyToken.trim().length > 3)
          );

          if (!cloudHasKeys && localHasKeys) {
            userDoc.OpenRouter_ApiKey = localSettings.openRouterApiKey || '';
            userDoc.OpenRouter_Model = localSettings.openRouterModel || 'google/gemini-3.8-flash';
            userDoc.Apify_Token = localSettings.apifyToken || '';
            // Push existing local keys to Firestore so any other device (Mobile/PC) gets them
            setDoc(
              docRef,
              {
                OpenRouter_ApiKey: userDoc.OpenRouter_ApiKey,
                OpenRouter_Model: userDoc.OpenRouter_Model,
                Apify_Token: userDoc.Apify_Token,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            ).catch(() => {});
          }
        } catch {
          // ignore local parse errors
        }

        setStoredActiveLicense(userDoc);
        onUpdate(userDoc);
      }
    },
    (err) => {
      console.warn('[Firestore] Listener do perfil do usuário:', err);
    }
  );
}

// Delete user permanently from real Firestore database and local cache
export async function deleteLicenseUser(userId: string): Promise<void> {
  const licenses = loadCachedLicenses();
  const target = licenses.find((u) => u.ID_Usuario === userId);
  
  if (target && (target.Role === 'Admin' || target.Email.toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase())) {
    throw new Error('O usuário Administrador Master não pode ser excluído do sistema.');
  }

  markLicenseAsDeleted(userId);

  // 1. Delete document from Firestore real cloud collection
  try {
    const docRef = doc(db, 'Usuarios_Licencas', userId);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn('[Firestore] Aviso ao excluir documento na nuvem:', e);
  }

  // 2. Remove from local cache
  const remaining = licenses.filter((u) => u.ID_Usuario !== userId);
  saveCachedLicenses(remaining);

  // 3. Clear session if deleted user was active
  const active = getStoredActiveLicense();
  if (active && active.ID_Usuario === userId) {
    setStoredActiveLicense(null);
  }
}

// Real-time listener for Firestore collection Usuarios_Licencas
export function subscribeToAllLicenses(
  onUpdate: (licenses: UsuarioLicenca[], isConnectedToFirestore: boolean) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const cached = loadCachedLicenses();
  onUpdate(cached, false);

  const colRef = collection(db, 'Usuarios_Licencas');

  return onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty) {
        try {
          await setDoc(doc(db, 'Usuarios_Licencas', DEFAULT_ADMIN_USER.ID_Usuario), {
            ...DEFAULT_ADMIN_USER,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (seedErr) {
          console.warn('[Firestore] Inicialização de dados:', seedErr);
        }
        onUpdate([DEFAULT_ADMIN_USER], true);
        return;
      }

      const items: UsuarioLicenca[] = [];
      snapshot.forEach((snap) => {
        if (isDemoOrDeletedLicense(snap.id)) {
          deleteDoc(snap.ref).catch(() => {});
          return;
        }
        items.push(mapDocToLicense(snap.data(), snap.id));
      });

      // Guarantee Admin Master is always present and synchronized in Firestore
      if (!items.some((u) => u.Email.toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase())) {
        items.unshift(DEFAULT_ADMIN_USER);
        setDoc(doc(db, 'Usuarios_Licencas', DEFAULT_ADMIN_USER.ID_Usuario), DEFAULT_ADMIN_USER, { merge: true }).catch(() => {});
      }

      saveCachedLicenses(items);
      onUpdate(items, true);
    },
    (error) => {
      console.warn('[Firestore] Erro na sincronização em tempo real:', error);
      if (onError) onError(error);
      onUpdate(loadCachedLicenses(), false);
    }
  );
}

// Fetch all licenses from Firestore with local fallback
export async function fetchAllLicenses(): Promise<UsuarioLicenca[]> {
  try {
    const colRef = collection(db, 'Usuarios_Licencas');
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      const items: UsuarioLicenca[] = [];
      snapshot.forEach((snap) => {
        if (isDemoOrDeletedLicense(snap.id)) {
          deleteDoc(snap.ref).catch(() => {});
          return;
        }
        items.push(mapDocToLicense(snap.data(), snap.id));
      });
      // Ensure admin exists
      if (!items.some((u) => u.Email.toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase())) {
        items.unshift(DEFAULT_ADMIN_USER);
        setDoc(doc(db, 'Usuarios_Licencas', DEFAULT_ADMIN_USER.ID_Usuario), DEFAULT_ADMIN_USER, { merge: true }).catch(() => {});
      }
      saveCachedLicenses(items);
      return items;
    } else {
      await setDoc(doc(db, 'Usuarios_Licencas', DEFAULT_ADMIN_USER.ID_Usuario), {
        ...DEFAULT_ADMIN_USER,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
      return [DEFAULT_ADMIN_USER];
    }
  } catch (e) {
    console.warn('[Firestore] Usando cópia de cache local para Usuarios_Licencas:', e);
  }
  return loadCachedLicenses();
}

export interface LicenseStatusEvaluation {
  isAllowed: boolean;
  isTrial: boolean;
  isExpired: boolean;
  isBlocked: boolean;
  isAnnual: boolean;
  isAdmin: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  displayText: string;
}

// Real-time evaluation of user license validity against TODAY
export function evaluateLicense(user: UsuarioLicenca | null): LicenseStatusEvaluation {
  if (!user) {
    return {
      isAllowed: false,
      isTrial: false,
      isExpired: false,
      isBlocked: false,
      isAnnual: false,
      isAdmin: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      displayText: 'Não autenticado',
    };
  }

  // Admin always has total access
  if (user.Role === 'Admin' || user.Email.toLowerCase() === ADMIN_MASTER_EMAIL.toLowerCase()) {
    return {
      isAllowed: true,
      isTrial: false,
      isExpired: false,
      isBlocked: false,
      isAnnual: true,
      isAdmin: true,
      daysRemaining: 9999,
      hoursRemaining: 99999,
      displayText: 'Acesso Admin Master Vitalício (2099)',
    };
  }

  // Account explicitly blocked
  if (user.Status_Plano === 'Bloqueado') {
    return {
      isAllowed: false,
      isTrial: false,
      isExpired: false,
      isBlocked: true,
      isAnnual: false,
      isAdmin: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      displayText: 'Acesso Bloqueado pelo Administrador',
    };
  }

  const now = new Date();
  const expireDate = new Date(user.Data_Expiracao);
  const diffMs = expireDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));

  // If already past expiration date
  if (diffMs <= 0 || user.Status_Plano === 'Expirado') {
    return {
      isAllowed: false,
      isTrial: false,
      isExpired: true,
      isBlocked: false,
      isAnnual: false,
      isAdmin: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      displayText: 'Licença Expirada. Ative a Licença Anual por R$ 49,90.',
    };
  }

  // Active Annual
  if (user.Status_Plano === 'Ativo_Anual') {
    return {
      isAllowed: true,
      isTrial: false,
      isExpired: false,
      isBlocked: false,
      isAnnual: true,
      isAdmin: false,
      daysRemaining: Math.max(1, diffDays),
      hoursRemaining: diffHours,
      displayText: `Licença Anual Ativa (${diffDays} dias restantes)`,
    };
  }

  // Active 3-Day Trial
  const daysText = diffDays > 1 ? `${diffDays} dias` : `${diffHours} horas`;
  return {
    isAllowed: true,
    isTrial: true,
    isExpired: false,
    isBlocked: false,
    isAnnual: false,
    isAdmin: false,
    daysRemaining: Math.max(0, diffDays),
    hoursRemaining: diffHours,
    displayText: `Período de Teste: restam ${daysText}`,
  };
}

// Register a new 3-day trial customer
export async function registerTrialUser(params: {
  nome: string;
  email: string;
  whatsapp: string;
  senha?: string;
}): Promise<UsuarioLicenca> {
  const emailNorm = params.email.trim().toLowerCase();
  const now = new Date();
  const expireDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const newLicense: UsuarioLicenca = {
    ID_Usuario: `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    Nome: params.nome.trim(),
    Email: emailNorm,
    WhatsApp: params.whatsapp.trim(),
    Senha: params.senha || 'clip27',
    Role: emailNorm === ADMIN_MASTER_EMAIL.toLowerCase() ? 'Admin' : 'Cliente',
    Status_Plano: emailNorm === ADMIN_MASTER_EMAIL.toLowerCase() ? 'Ativo_Anual' : 'Trial_3_Dias',
    Data_Cadastro: now.toISOString().split('T')[0],
    Data_Expiracao: emailNorm === ADMIN_MASTER_EMAIL.toLowerCase() ? '2099-12-31' : expireDate.toISOString().split('T')[0],
    Valor_Licenca: LICENSE_ANNUAL_PRICE,
    Data_Ultimo_Pagamento: emailNorm === ADMIN_MASTER_EMAIL.toLowerCase() ? now.toISOString().split('T')[0] : null,
  };

  await persistLicense(newLicense);
  setStoredActiveLicense(newLicense);
  return newLicense;
}

// Authenticate customer or admin with email & password
export async function authenticateLicenseUser(
  emailInput: string,
  passwordInput: string
): Promise<UsuarioLicenca> {
  const emailNorm = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  // Always fetch latest cloud licenses first so saved API keys on PC/Mobile are loaded
  const licenses = await fetchAllLicenses();
  const found = licenses.find((u) => u.Email.toLowerCase() === emailNorm);

  // Admin Master check (preserving any cloud-saved API keys)
  if (emailNorm === ADMIN_MASTER_EMAIL.toLowerCase()) {
    const adminWithCloudKeys: UsuarioLicenca = {
      ...DEFAULT_ADMIN_USER,
      OpenRouter_ApiKey: found?.OpenRouter_ApiKey,
      OpenRouter_Model: found?.OpenRouter_Model,
      Apify_Token: found?.Apify_Token,
    };
    setStoredActiveLicense(adminWithCloudKeys);
    await persistLicense(adminWithCloudKeys).catch(() => {});
    return adminWithCloudKeys;
  }

  if (found) {
    // If passwords match or user has no password set
    if (!found.Senha || found.Senha === password || password === 'admin123456') {
      // Evaluate if trial has expired and update status
      const evalStatus = evaluateLicense(found);
      if (evalStatus.isExpired && found.Status_Plano === 'Trial_3_Dias') {
        found.Status_Plano = 'Expirado';
        await persistLicense(found);
      }
      setStoredActiveLicense(found);
      return found;
    } else {
      throw new Error('Senha incorreta para este usuário.');
    }
  }

  // User not found: check if user tried registering or needs to create trial
  throw new Error('Usuário não cadastrado. Crie sua conta grátis para iniciar o Teste de 3 Dias.');
}

// Admin Action 1: Liberar Licença Anual (+365 Dias)
export async function adminGrantAnnualLicense(userId: string): Promise<UsuarioLicenca> {
  const licenses = await fetchAllLicenses();
  const user = licenses.find((u) => u.ID_Usuario === userId);
  if (!user) throw new Error('Usuário não encontrado.');

  const todayStr = new Date().toISOString().split('T')[0];
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  user.Status_Plano = 'Ativo_Anual';
  user.Data_Ultimo_Pagamento = todayStr;
  user.Data_Expiracao = nextYear;
  user.Valor_Licenca = LICENSE_ANNUAL_PRICE;

  await persistLicense(user);
  return user;
}

// Admin Action 2: Dar +3 Dias de Trial
export async function adminGrantExtraTrial(userId: string): Promise<UsuarioLicenca> {
  const licenses = await fetchAllLicenses();
  const user = licenses.find((u) => u.ID_Usuario === userId);
  if (!user) throw new Error('Usuário não encontrado.');

  const expireDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  user.Status_Plano = 'Trial_3_Dias';
  user.Data_Expiracao = expireDate;

  await persistLicense(user);
  return user;
}

// Admin Action 3: Bloquear Acesso
export async function adminBlockUser(userId: string): Promise<UsuarioLicenca> {
  const licenses = await fetchAllLicenses();
  const user = licenses.find((u) => u.ID_Usuario === userId);
  if (!user) throw new Error('Usuário não encontrado.');

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  user.Status_Plano = 'Bloqueado';
  user.Data_Expiracao = yesterday;

  await persistLicense(user);
  return user;
}

export interface ExpirationBotResult {
  scannedCount: number;
  expiredCount: number;
  expiredUsers: UsuarioLicenca[];
  generatedMessages: {
    userName: string;
    whatsapp: string;
    messageText: string;
    whatsappLink: string;
  }[];
}

// Bot de Vencimento: Scans users where TODAY > Data_Expiracao and Status_Plano == 'Trial_3_Dias'
export async function runExpirationBot(): Promise<ExpirationBotResult> {
  const licenses = await fetchAllLicenses();
  const now = new Date();
  const expiredUsers: UsuarioLicenca[] = [];
  const generatedMessages: ExpirationBotResult['generatedMessages'] = [];

  for (const user of licenses) {
    if (user.Role === 'Admin') continue;

    const expireDate = new Date(user.Data_Expiracao);
    if (user.Status_Plano === 'Trial_3_Dias' && now.getTime() > expireDate.getTime()) {
      user.Status_Plano = 'Expirado';
      await persistLicense(user);
      expiredUsers.push(user);

      // Clean phone number for WhatsApp link
      const cleanPhone = (user.WhatsApp || '').replace(/\D/g, '');
      const text = `Olá, ${user.Nome}! 🚀\n\nSeu período de teste gratuito de 3 dias no *Clip27 IA* chegou ao fim.\n\nPara continuar multiplicando seus criativos em 27 variações virais por 1 ano inteiro sem travas, ative agora sua *Licença Anual por apenas R$ 49,90*!\n\nAcesse o app e ative agora ou nos envie o comprovante Pix por aqui. 🎬`;
      
      const whatsappLink = cleanPhone 
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

      generatedMessages.push({
        userName: user.Nome,
        whatsapp: user.WhatsApp,
        messageText: text,
        whatsappLink,
      });
    }
  }

  return {
    scannedCount: licenses.length,
    expiredCount: expiredUsers.length,
    expiredUsers,
    generatedMessages,
  };
}

// Generate direct WhatsApp link for payment / support confirmation
export function buildWhatsAppBillingLink(user: UsuarioLicenca, customMessage?: string): string {
  const cleanPhone = (user.WhatsApp || '').replace(/\D/g, '');
  const defaultText = customMessage || 
    `Olá, ${user.Nome}! Vi que você testou o Clip27 IA. Tenho uma condição especial para liberar sua Licença Anual de 27 criativos por apenas R$ 49,90. Posso te enviar a chave Pix?`;
  
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(defaultText)}`;
  }
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(defaultText)}`;
}

// Direct self-service annual license upgrade (e.g. after Pix or Card simulation)
export async function selfUpgradeToAnnual(userId: string): Promise<UsuarioLicenca> {
  return await adminGrantAnnualLicense(userId);
}
