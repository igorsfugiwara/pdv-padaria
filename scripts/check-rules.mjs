// Confere as regras do Firestore contra o banco real, como um visitante anônimo.
// Usa a loja de demonstração (PIN da cozinha 1111). Rode: npm run check:rules
import { readFileSync } from 'node:fs'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, getDoc, getDocs, setDoc, collection, deleteDoc } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')), l.slice(l.indexOf('=')+1).trim()]))
const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID })
const db = getFirestore(app); const auth = getAuth(app)
const cred = await signInAnonymously(auth); const uid = cred.user.uid
const T = 'tenants/cortico'
const check = async (label, expectOk, fn) => { try { await fn(); console.log(expectOk ? 'ok   ' : 'FALHA', label, '→ permitido') } catch (e) { console.log(expectOk ? 'FALHA' : 'ok   ', label, '→ negado', expectOk ? e.code : '') } }
await check('ler cardápio (products)', true, () => getDocs(collection(db, `${T}/products`)))
await check('ler doc da loja', true, () => getDoc(doc(db, T)))
await check('ler nomes da equipe', true, () => getDocs(collection(db, `${T}/staff`)))
await check('ler PINs (staffPins)', false, () => getDocs(collection(db, `${T}/staffPins`)))
await check('ler insumos (custos)', false, () => getDocs(collection(db, `${T}/insumos`)))
await check('listar comandas', false, () => getDocs(collection(db, `${T}/comandas`)))
await check('listar pedidos', false, () => getDocs(collection(db, `${T}/orders`)))
await check('ler notas fiscais (têm CPF)', false, () => getDocs(collection(db, `${T}/nfce`)))
await check('alterar preço de produto', false, () => setDoc(doc(db, `${T}/products/misto`), { price: 1 }, { merge: true }))
await check('criar loja nova (bootstrap)', false, () => setDoc(doc(db, 'tenants/invasor'), { x: 1 }))
await check('regravar loja cortico', false, () => setDoc(doc(db, T), { x: 1 }))
await check('sessão com PIN errado', false, () => setDoc(doc(db, `${T}/sessions/${uid}`), { staffId: 'u-gestao', role: 'gerente', pin: '9999', createdAt: 'x' }))
await check('sessão com PIN certo mas perfil falso', false, () => setDoc(doc(db, `${T}/sessions/${uid}`), { staffId: 'u-rita', role: 'gerente', pin: '1111', createdAt: 'x' }))
await check('sessão cozinha com PIN certo', true, () => setDoc(doc(db, `${T}/sessions/${uid}`), { staffId: 'u-rita', role: 'cozinha', pin: '1111', createdAt: 'x' }))
await check('cozinha lê insumos', true, () => getDocs(collection(db, `${T}/insumos`)))
await check('cozinha lista pedidos', true, () => getDocs(collection(db, `${T}/orders`)))
await check('cozinha lê notas fiscais (só caixa e gerência)', false, () => getDocs(collection(db, `${T}/nfce`)))
await check('cozinha lança sangria (só caixa)', false, () => setDoc(doc(db, `${T}/cashMovements/teste`), { amount: 1 }))
await check('cozinha muda configurações (só gerência)', false, () => setDoc(doc(db, T), { settings: {} }, { merge: true }))
await deleteDoc(doc(db, `${T}/sessions/${uid}`))
await check('depois do logout, lista pedidos', false, () => getDocs(collection(db, `${T}/orders`)))
process.exit(0)
