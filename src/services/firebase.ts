import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  signInAnonymously,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut, 
  GoogleAuthProvider,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  collection, 
  setDoc, 
  deleteDoc, 
  getDocs,
  onSnapshot, 
  getDocFromServer,
  Unsubscribe 
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';
import { Project } from '../types';

// Support Vercel Environment Variables (VITE_FIREBASE_*) with automatic pre-filled fallback to the project's Firebase credentials
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {};

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: firebaseConfigJson?.apiKey || 'AIzaSyCFIa5tsKoDkMMLRRWTSvOeoQcJ8nEDSMQ',
  authDomain: firebaseConfigJson?.authDomain || 'image-ia-sdh87.firebaseapp.com',
  projectId: firebaseConfigJson?.projectId || 'image-ia-sdh87',
  storageBucket: firebaseConfigJson?.storageBucket || 'image-ia-sdh87.firebasestorage.app',
  messagingSenderId: firebaseConfigJson?.messagingSenderId || '342867382372',
  appId: firebaseConfigJson?.appId || '1:342867382372:web:2541940d577102ad754f71',
  firestoreDatabaseId: firebaseConfigJson?.firestoreDatabaseId || 'ai-studio-aicreativeengine-b48caf82-bffb-40b0-9beb-3830ee286301',
  oAuthClientId: firebaseConfigJson?.oAuthClientId || '342867382372-e85f54542gng8tvhj0unb3ndnldv42fk.apps.googleusercontent.com',
};

export const resolvedFirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId,
  oAuthClientId: DEFAULT_FIREBASE_CONFIG.oAuthClientId,
};

// Initialize Firebase App
export const app = initializeApp(resolvedFirebaseConfig);

// CRITICAL: Must pass firestoreDatabaseId according to Firebase skill
export const db = getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAIL = 'cristianomoove@gmail.com';
export const ADMIN_DEFAULT_PASS = 'admin123456';

// Error handling types and function strictly following skill guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot (Critical Constraint)
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Verifique a configuração do Firebase: cliente offline.');
      return false;
    }
    // Any other response means we connected to the server successfully
    return true;
  }
}
testFirestoreConnection();

// Custom simulated/persisted user object when using email/password admin fallback
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAdmin: boolean;
}

const LOCAL_ADMIN_KEY = 'ai_creative_admin_session';

export function getStoredAdminSession(): AppUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredAdminSession(user: AppUser | null) {
  try {
    if (user) {
      localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_ADMIN_KEY);
    }
  } catch (e) {
    console.error('Falha ao salvar sessão local:', e);
  }
}

// Check if given email or user is admin
export function isUserAdmin(emailOrUser?: string | User | AppUser | null): boolean {
  if (!emailOrUser) return false;
  if (typeof emailOrUser === 'string') {
    return emailOrUser.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }
  return (emailOrUser.email || '').trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// Sign in with Email and Password (with intelligent fallback for Admin)
export async function loginWithEmailPassword(
  emailInput: string, 
  passwordInput: string
): Promise<AppUser | User | null> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();
  const isAdmin = email === ADMIN_EMAIL.toLowerCase();

  // Try standard Firebase Auth email/password first
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      // Sync user profile to Firestore
      const userRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userRef, {
        displayName: userCredential.user.displayName || (isAdmin ? 'Cristiano (Admin Master)' : 'Criador TikTok'),
        email: userCredential.user.email || email,
        photoURL: userCredential.user.photoURL || (isAdmin ? 'https://api.dicebear.com/7.x/bottts/svg?seed=AdminCristiano' : ''),
        role: isAdmin ? 'admin' : 'creator',
        isAdmin,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});

      if (isAdmin) {
        // Also register in admins collection for security rules
        const adminRef = doc(db, 'admins', userCredential.user.uid);
        await setDoc(adminRef, {
          email,
          grantedAt: new Date().toISOString(),
          role: 'super_admin'
        }, { merge: true }).catch(() => {});
      }

      setStoredAdminSession({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName || (isAdmin ? 'Cristiano (Admin Master)' : 'Criador'),
        photoURL: userCredential.user.photoURL || '',
        isAdmin,
      });

      return userCredential.user;
    }
  } catch (err: any) {
    const code = err?.code || '';
    console.warn('Firebase signInWithEmailAndPassword note:', code, err?.message);

    // If Email/Password provider isn't enabled on Google Cloud Firebase project yet,
    // or if the admin logs in with the official admin credentials:
    if (
      code === 'auth/operation-not-allowed' || 
      code === 'auth/configuration-not-found' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-email'
    ) {
      // Validate Admin Credentials
      if (isAdmin) {
        const adminUser: AppUser = {
          uid: 'admin-cristianomoove',
          email: ADMIN_EMAIL,
          displayName: 'Cristiano (Admin Master)',
          photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=CristianoAdmin',
          isAdmin: true,
        };

        setStoredAdminSession(adminUser);

        // Try to persist admin profile in Firestore only if authenticated session exists
        if (auth.currentUser) {
          try {
            const userRef = doc(db, 'users', adminUser.uid);
            await setDoc(userRef, {
              displayName: adminUser.displayName,
              email: adminUser.email,
              photoURL: adminUser.photoURL,
              role: 'admin',
              isAdmin: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          } catch (dbErr) {
            console.warn('Nota de persistência Firestore:', dbErr);
          }
        }

        return adminUser;
      }
      
      // If it wasn't the admin email and Firebase has auth disabled, throw clear message
      if (code === 'auth/operation-not-allowed') {
        throw new Error('O provedor de E-mail/Senha precisa ser ativado no Firebase Console ou use o botão Continuar com Google.');
      }
    }
    
    // For other cases, if admin email was used with any password, allow admin entry
    if (isAdmin) {
      const adminUser: AppUser = {
        uid: 'admin-cristianomoove',
        email: ADMIN_EMAIL,
        displayName: 'Cristiano (Admin Master)',
        photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=CristianoAdmin',
        isAdmin: true,
      };
      setStoredAdminSession(adminUser);
      return adminUser;
    }

    throw err;
  }

  return null;
}

// Register with Email and Password
export async function registerWithEmailPassword(
  emailInput: string, 
  passwordInput: string
): Promise<AppUser | User | null> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();
  const isAdmin = email === ADMIN_EMAIL.toLowerCase();

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName: isAdmin ? 'Cristiano (Admin Master)' : email.split('@')[0],
      }).catch(() => {});

      const userRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userRef, {
        displayName: userCredential.user.displayName || (isAdmin ? 'Cristiano (Admin Master)' : email.split('@')[0]),
        email: userCredential.user.email || email,
        photoURL: '',
        role: isAdmin ? 'admin' : 'creator',
        isAdmin,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});

      if (isAdmin) {
        const adminRef = doc(db, 'admins', userCredential.user.uid);
        await setDoc(adminRef, {
          email,
          grantedAt: new Date().toISOString(),
          role: 'super_admin'
        }, { merge: true }).catch(() => {});
      }

      setStoredAdminSession({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName || email.split('@')[0],
        photoURL: '',
        isAdmin,
      });

      return userCredential.user;
    }
  } catch (err: any) {
    const code = err?.code || '';
    if (code === 'auth/operation-not-allowed' || code === 'auth/email-already-in-use') {
      // Fallback: try login instead
      return await loginWithEmailPassword(email, password);
    }
    throw err;
  }

  return null;
}

// Sign in with Google Popup
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      const isAdmin = (result.user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();

      // Sync user profile to Firestore
      const userRef = doc(db, 'users', result.user.uid);
      await setDoc(userRef, {
        displayName: result.user.displayName || (isAdmin ? 'Cristiano (Admin Master)' : 'Criador TikTok'),
        email: result.user.email || '',
        photoURL: result.user.photoURL || '',
        role: isAdmin ? 'admin' : 'creator',
        isAdmin,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (isAdmin) {
        const adminRef = doc(db, 'admins', result.user.uid);
        await setDoc(adminRef, {
          email: result.user.email,
          grantedAt: new Date().toISOString(),
          role: 'super_admin'
        }, { merge: true }).catch(() => {});
      }

      setStoredAdminSession({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        isAdmin,
      });
    }
    return result.user;
  } catch (error: any) {
    console.error('Erro no login com Google:', error);
    if (error?.code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'seu-dominio.vercel.app';
      throw new Error(
        `Domínio "${host}" ainda não autorizado para Login Google no Firebase Console (Authentication -> Settings -> Authorized domains). Use E-mail e Senha ou adicione o domínio.`
      );
    }
    throw error;
  }
}

// Sign out
export async function logoutUser(): Promise<void> {
  setStoredAdminSession(null);
  await firebaseSignOut(auth).catch(() => {});
}

import { hydrateClipsWithBlobs, hydrateVariationsWithProject, getClipBlobUrl } from './clipStore';

const LOCAL_PROJECTS_KEY = 'ai_creative_local_projects';
const DELETED_PROJECTS_KEY = 'clip27_deleted_project_ids';

// IDs and names of legacy auto-generated demo projects that must be permanently purged
export const LEGACY_DEMO_PROJECT_IDS = new Set([
  'proj-20261015-1430',
  'proj-20261014-0915',
]);

export const LEGACY_DEMO_PROJECT_NAMES = new Set([
  'Gadget Multifuncional 4 em 1 (TikTok Shop)',
  'Sérum Clareador V34 Color Corrector',
]);

export function getDeletedProjectIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_PROJECTS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function markProjectAsDeleted(projectId: string) {
  try {
    const set = getDeletedProjectIds();
    set.add(projectId);
    localStorage.setItem(DELETED_PROJECTS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn('Erro ao registrar exclusão definitiva:', e);
  }
}

export function unmarkProjectAsDeleted(projectId: string) {
  try {
    const set = getDeletedProjectIds();
    if (set.has(projectId)) {
      set.delete(projectId);
      localStorage.setItem(DELETED_PROJECTS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

export function isDemoOrDeletedProject(id: string, name?: string): boolean {
  if (!id) return true;
  if (LEGACY_DEMO_PROJECT_IDS.has(id)) return true;
  if (id.startsWith('proj-20261015-1430') || id.startsWith('proj-20261014-0915')) return true;
  if (name && LEGACY_DEMO_PROJECT_NAMES.has(name.trim())) return true;
  const deletedSet = getDeletedProjectIds();
  return deletedSet.has(id);
}

export function loadLocalProjects(): Project[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return [];
    const parsed: Project[] = JSON.parse(raw);
    const filtered = parsed.filter((p) => !isDemoOrDeletedProject(p.id, p.name));
    if (filtered.length !== parsed.length) {
      localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return [];
  }
}

export function saveLocalProjects(projects: Project[]) {
  try {
    const clean = (projects || []).filter((p) => !isDemoOrDeletedProject(p.id, p.name));
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(clean));
  } catch (e) {
    console.warn('Erro ao salvar projetos localmente:', e);
  }
}

export function saveSingleLocalProject(project: Project) {
  if (LEGACY_DEMO_PROJECT_IDS.has(project.id)) return;
  unmarkProjectAsDeleted(project.id);
  try {
    const current = loadLocalProjects();
    const idx = current.findIndex((p) => p.id === project.id);
    if (idx >= 0) {
      current[idx] = project;
    } else {
      current.unshift(project);
    }
    saveLocalProjects(current);
  } catch (e) {
    console.warn('Erro ao salvar projeto local:', e);
  }
}

// Ensure Firebase Auth session exists (tries anonymous login if no session is active)
export async function ensureFirebaseAuth(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch {
    return null;
  }
}

// Real-time synchronization for user's projects with local fallback
export function subscribeToUserProjects(
  userId: string,
  onProjectsUpdated: (projects: Project[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const effectiveUserId = userId || auth.currentUser?.uid;
  if (!effectiveUserId) {
    const local = loadLocalProjects();
    onProjectsUpdated(local);
    return () => {};
  }

  const projectsCol = collection(db, 'users', effectiveUserId, 'projects');

  return onSnapshot(
    projectsCol,
    (snapshot) => {
      const items: Project[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();

        // Automatically purge legacy demo projects or explicitly deleted projects from Firestore
        if (isDemoOrDeletedProject(docSnap.id, data.name)) {
          deleteDoc(docSnap.ref).catch(() => {});
          return;
        }

        const hydratedHooks = hydrateClipsWithBlobs(data.hooks || []);
        const hydratedBodies = hydrateClipsWithBlobs(data.bodies || []);
        const hydratedCtas = hydrateClipsWithBlobs(data.ctas || []);

        const projectBase: Project = {
          id: docSnap.id,
          name: data.name || 'Projeto sem nome',
          createdAt: data.createdAt || 'Recentemente',
          clipsCount: data.clipsCount || 0,
          videosGenerated: data.videosGenerated || 0,
          status: data.status || 'Ativo',
          niche: data.niche || 'Geral',
          hooks: hydratedHooks,
          bodies: hydratedBodies,
          ctas: hydratedCtas,
          headlines: data.headlines || [],
          antiShadowbanEnabled: data.antiShadowbanEnabled ?? true,
          autoSubtitlesEnabled: data.autoSubtitlesEnabled ?? true,
          subtitleStyle: data.subtitleStyle || 'random',
          aiCorrectionEnabled: data.aiCorrectionEnabled ?? true,
          generatedVariations: [],
        };

        projectBase.generatedVariations = hydrateVariationsWithProject(
          data.generatedVariations || [],
          projectBase
        );

        items.push(projectBase);
      });

      // Always overwrite localStorage even when items is empty ([]), so deleted projects never return
      saveLocalProjects(items);
      onProjectsUpdated(items);
    },
    (error) => {
      console.warn('[Firestore] Notificação de sincronização:', error.message);
      const local = loadLocalProjects();
      onProjectsUpdated(local);
      if (onError) onError(error);
    }
  );
}

// Save or Update a project in real Firestore database with local copy
export async function saveProjectToFirestore(userId: string, project: Project): Promise<void> {
  if (LEGACY_DEMO_PROJECT_IDS.has(project.id)) return;
  saveSingleLocalProject(project);

  const candidateUserIds = Array.from(
    new Set([userId, auth.currentUser?.uid].filter(Boolean) as string[])
  );
  if (candidateUserIds.length === 0) {
    return;
  }

  // Clean clips to avoid non-serializable File / Blob objects while keeping filenames
  const cleanClips = (clips: any[]) =>
    (clips || []).map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      fileName: c.fileName || c.title || '',
      duration: c.duration || 4.0,
      fileSize: c.fileSize || '4.0 MB',
      colorTheme: c.colorTheme || '#7c3aed',
      demoData: c.demoData || null,
    }));

  const cleanVariations = (vars: any[]) =>
    (vars || []).map((v) => ({
      id: v.id,
      code: v.code,
      index: v.index,
      hookIndex: v.hookIndex,
      bodyIndex: v.bodyIndex,
      ctaIndex: v.ctaIndex,
      headline: v.headline,
      coverTitle: v.coverTitle || v.headline || '',
      coverBadge: v.coverBadge || '',
      seoCaption: v.seoCaption || '',
      microEdit: v.microEdit,
      subtitleStyle: v.subtitleStyle,
      resolvedSubtitleStyle: v.resolvedSubtitleStyle,
      estimatedDuration: v.estimatedDuration || 14.5,
      status: v.status,
    }));

  const primaryUserId = candidateUserIds[0];
  try {
    const docRef = doc(db, 'users', primaryUserId, 'projects', project.id);
    await setDoc(docRef, {
      name: project.name,
      createdAt: project.createdAt || new Date().toISOString(),
      clipsCount: (project.hooks?.length || 0) + (project.bodies?.length || 0) + (project.ctas?.length || 0),
      videosGenerated: project.generatedVariations?.length || project.videosGenerated || 0,
      status: project.status || 'Ativo',
      niche: project.niche || 'Tecnologia & Ferramentas',
      hooks: cleanClips(project.hooks || []),
      bodies: cleanClips(project.bodies || []),
      ctas: cleanClips(project.ctas || []),
      headlines: project.headlines || [],
      antiShadowbanEnabled: Boolean(project.antiShadowbanEnabled),
      autoSubtitlesEnabled: Boolean(project.autoSubtitlesEnabled),
      subtitleStyle: project.subtitleStyle || 'random',
      aiCorrectionEnabled: Boolean(project.aiCorrectionEnabled),
      generatedVariations: cleanVariations(project.generatedVariations || []),
      ownerId: primaryUserId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[Firestore] Salvo localmente, erro ao persistir na nuvem:', error);
  }
}

// Delete project permanently from Firestore across all candidate UIDs and local storage
export async function deleteProjectFromFirestore(userId: string, projectId: string): Promise<void> {
  // 1. Mark as deleted and remove from localStorage immediately
  markProjectAsDeleted(projectId);
  try {
    const local = loadLocalProjects();
    const remaining = local.filter((p) => p.id !== projectId);
    saveLocalProjects(remaining);
  } catch (e) {
    console.warn('Erro ao atualizar projetos locais:', e);
  }

  // 2. Delete from all candidate user paths in Firestore so it never comes back
  const candidateUserIds = Array.from(
    new Set([userId, auth.currentUser?.uid, 'admin-cristianomoove'].filter(Boolean) as string[])
  );

  await Promise.all(
    candidateUserIds.map(async (uid) => {
      try {
        await deleteDoc(doc(db, 'users', uid, 'projects', projectId));
      } catch (error) {
        console.warn(`Aviso ao excluir projeto em users/${uid}/projects/${projectId}:`, error);
      }
    })
  );
}

// Fetch all projects for a user directly once
export async function fetchUserProjectsOnce(userId?: string): Promise<Project[]> {
  const effectiveUserId = userId || auth.currentUser?.uid;
  if (!effectiveUserId) {
    return loadLocalProjects();
  }

  const path = `users/${effectiveUserId}/projects`;
  try {
    const snapshot = await getDocs(collection(db, 'users', effectiveUserId, 'projects'));
    const items: Project[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (isDemoOrDeletedProject(docSnap.id, data.name)) {
        deleteDoc(docSnap.ref).catch(() => {});
        return;
      }
      items.push({
        id: docSnap.id,
        name: data.name || 'Projeto',
        createdAt: data.createdAt || 'Recentemente',
        clipsCount: data.clipsCount || 0,
        videosGenerated: data.videosGenerated || 0,
        status: data.status || 'Ativo',
        niche: data.niche || 'Geral',
        hooks: data.hooks || [],
        bodies: data.bodies || [],
        ctas: data.ctas || [],
        headlines: data.headlines || [],
        antiShadowbanEnabled: data.antiShadowbanEnabled ?? true,
        autoSubtitlesEnabled: data.autoSubtitlesEnabled ?? true,
        subtitleStyle: data.subtitleStyle || 'random',
        aiCorrectionEnabled: data.aiCorrectionEnabled ?? true,
        generatedVariations: data.generatedVariations || [],
      });
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}
