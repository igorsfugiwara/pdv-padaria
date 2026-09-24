// Carga inicial de uma loja de demonstração no Firestore.
//   npm run seed:firestore            (loja padrão: cortico)
//   npm run seed:firestore -- cortico
//
// Usa o SDK web com login anônimo: as regras só liberam essa carga enquanto o
// doc da loja não existe (ver `bootstrapping` em firestore.rules). Para recriar
// uma loja que já existe, use "Recriar dados de exemplo" em Configurações.
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { initializeFirestore, doc, getDoc } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { tenants } from '../src/mock/tenants'
import { buildTenantSeed } from '../src/db/seed-data'
import { writeTenantSeed } from '../src/db/firestore-seed'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)

const slug   = process.argv[2] ?? 'cortico'
const bundle = tenants[slug]
if (!bundle) throw new Error(`Loja desconhecida: ${slug}`)

const app = initializeApp({
  apiKey:    env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId:     env.VITE_FIREBASE_APP_ID,
})
const db = initializeFirestore(app, { ignoreUndefinedProperties: true })

await signInAnonymously(getAuth(app))
if ((await getDoc(doc(db, `tenants/${slug}`))).exists()) {
  console.log(`A loja "${slug}" já existe no Firestore. Use "Recriar dados de exemplo" em Configurações.`)
  process.exit(0)
}

console.log(`Gravando a loja "${bundle.tenant.name}" em ${env.VITE_FIREBASE_PROJECT_ID}…`)
await writeTenantSeed(db, bundle.tenant, buildTenantSeed(bundle), (msg) => console.log('  ' + msg))
console.log('Pronto.')
process.exit(0)
