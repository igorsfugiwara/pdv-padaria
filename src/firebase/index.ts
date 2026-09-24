import { initializeApp, type FirebaseApp } from 'firebase/app'
import { initializeFirestore, type Firestore } from 'firebase/firestore'
import { getAuth, setPersistence, browserSessionPersistence, signInAnonymously, type Auth } from 'firebase/auth'

const config = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// Sem configuração (ou com VITE_DATA_BACKEND=local) o app roda no modo mock,
// com os dados no localStorage do navegador.
export const firebaseEnabled = !!config.projectId && import.meta.env.VITE_DATA_BACKEND !== 'local'

const app: FirebaseApp | null = firebaseEnabled ? initializeApp(config) : null

export const firestore: Firestore | null = app ? initializeFirestore(app, { ignoreUndefinedProperties: true }) : null
export const auth: Auth | null = app ? getAuth(app) : null

// Todo mundo entra anônimo. A persistência é por aba: cliente, cozinha e caixa
// no mesmo navegador são usuários diferentes (a equipe ganha sessão pelo PIN).
export async function initFirebaseAuth(): Promise<void> {
  if (!auth) return
  await setPersistence(auth, browserSessionPersistence)
  await auth.authStateReady()
  if (!auth.currentUser) await signInAnonymously(auth)
}

export function currentUid(): string | null {
  return auth?.currentUser?.uid ?? null
}
