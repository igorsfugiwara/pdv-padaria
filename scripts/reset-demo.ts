// Recria o "dia de hoje" da loja de demonstração no Firestore (comandas, pedidos,
// caixa, estoque, notas), entrando como gerência pelas regras normais.
//   npm run reset:demo -- --pin 0000            (loja padrão: cortico)
//   npm run reset:demo -- cortico --pin 0000
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { initializeFirestore, doc, getDocs, collection, setDoc, deleteDoc } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { tenants } from '../src/mock/tenants'
import { buildTenantSeed } from '../src/db/seed-data'
import { resetTenant } from '../src/db/firestore-seed'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)

const args = process.argv.slice(2)
const pinAt = args.indexOf('--pin')
const pin   = pinAt >= 0 ? args[pinAt + 1] : undefined
const slug  = args.find((a, i) => !a.startsWith('--') && i !== pinAt + 1) ?? 'cortico'
const bundle = tenants[slug]
if (!bundle) throw new Error(`Loja desconhecida: ${slug}`)
if (!pin) throw new Error('Informe o PIN da gerência: npm run reset:demo -- --pin 0000')

const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID })
const db  = initializeFirestore(app, { ignoreUndefinedProperties: true })
const { user } = await signInAnonymously(getAuth(app))

// Sessão de gerência (as regras conferem o PIN)
const staff = await getDocs(collection(db, `tenants/${slug}/staff`))
const manager = staff.docs.find((d) => d.data().role === 'gerente')
if (!manager) throw new Error('A loja não tem ninguém da gerência')
const session = doc(db, `tenants/${slug}/sessions/${user.uid}`)
try {
  await setDoc(session, { staffId: manager.id, role: 'gerente', pin, createdAt: new Date().toISOString() })
} catch {
  throw new Error('PIN da gerência recusado')
}

console.log(`Recriando o dia de demonstração de "${bundle.tenant.name}"…`)
await resetTenant(db, bundle.tenant, buildTenantSeed(bundle))
await deleteDoc(session)
console.log('Pronto.')
process.exit(0)
