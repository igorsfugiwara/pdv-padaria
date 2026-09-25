// NFC-e no servidor: guarda os tokens do provedor fiscal e fala com a SEFAZ por ele.
// POST /api/nfce  { action, tenant, ... }  com  Authorization: Bearer <ID token do Firebase>
//
// Quem pode chamar: caixa ou gerência da loja. O ID token é validado pelas chaves
// públicas do Google, e o perfil é lido em tenants/{loja}/sessions/{uid} com o
// próprio token do usuário (as regras do Firestore valem aqui também).
//
// Tokens por loja e ambiente (variáveis de ambiente do Netlify, nunca no código):
//   NFCE_FOCUS_TOKEN_<LOJA>_HOMOLOGACAO   ex.: NFCE_FOCUS_TOKEN_CORTICO_HOMOLOGACAO
//   NFCE_FOCUS_TOKEN_<LOJA>_PRODUCAO
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { checkRequest, type NfceRequest } from '../../src/fiscal/request'
import { toFocusPayload, fromFocusResponse, focusBase, type FiscalResult } from '../../src/fiscal/focus'

const PROJECT = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID ?? ''
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
const TIMEOUT_MS = 9000   // a função síncrona do Netlify tem 10 s

type Ambiente = 'homologacao' | 'producao'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

function tokenFor(tenant: string, ambiente: Ambiente): string | undefined {
  return process.env[`NFCE_FOCUS_TOKEN_${tenant.toUpperCase().replace(/-/g, '_')}_${ambiente.toUpperCase()}`]
}

async function staffRole(idToken: string, uid: string, tenant: string): Promise<string | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/tenants/${tenant}/sessions/${uid}`
  const r = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } })
  if (!r.ok) return null
  const doc = (await r.json()) as { fields?: { role?: { stringValue?: string } } }
  return doc.fields?.role?.stringValue ?? null
}

async function focus(method: 'GET' | 'POST' | 'DELETE', ambiente: Ambiente, token: string, path: string, body?: unknown) {
  const base = focusBase[ambiente]
  const r = await fetch(`${base}/v2${path}`, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${token}:`).toString('base64'),
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const text = await r.text()
  let data: Record<string, unknown> = {}
  try { data = JSON.parse(text) } catch { data = { mensagem: text.slice(0, 300) } }
  return { ok: r.ok, status: r.status, data, base }
}

function timeoutResult(err: unknown): FiscalResult | null {
  const name = (err as { name?: string })?.name
  return name === 'TimeoutError' || name === 'AbortError'
    ? { status: 'pendente', mensagem: 'O provedor não respondeu a tempo. Consulte a nota em instantes.' }
    : null
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { erro: 'Use POST' })
  if (!PROJECT) return json(500, { erro: 'FIREBASE_PROJECT_ID não configurado no servidor' })

  // 1. Quem está chamando
  const idToken = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  let uid: string
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT}`,
      audience: PROJECT,
    })
    uid = String(payload.sub)
  } catch {
    return json(401, { erro: 'Login inválido ou expirado' })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json(400, { erro: 'Corpo inválido' }) }

  const tenant = String(body.tenant ?? '')
  if (!/^[a-z0-9-]{2,40}$/.test(tenant)) return json(400, { erro: 'Loja inválida' })

  const role = await staffRole(idToken, uid, tenant)
  if (role !== 'caixa' && role !== 'gerente') return json(403, { erro: 'Só caixa ou gerência emitem NFC-e' })

  const action = String(body.action ?? '')
  const ambiente = (body.ambiente === 'producao' ? 'producao' : 'homologacao') as Ambiente

  // 2. O que foi pedido
  try {
    if (action === 'status') {
      return json(200, {
        provider: 'focusnfe',
        tokens: { homologacao: !!tokenFor(tenant, 'homologacao'), producao: !!tokenFor(tenant, 'producao') },
      })
    }

    const token = tokenFor(tenant, action === 'emitir' ? (body.request as NfceRequest)?.ambiente ?? ambiente : ambiente)
    if (!token) return json(412, { erro: `Token da Focus NFe não configurado para ${tenant} em ${ambiente}` })

    if (action === 'emitir') {
      const request = body.request as NfceRequest
      if (!request || request.tenant !== tenant) return json(400, { erro: 'Nota de outra loja' })
      const errors = checkRequest(request)
      if (errors.length) return json(422, { erro: 'Nota não confere', detalhes: errors })

      const res = await focus('POST', request.ambiente, token, `/nfce?ref=${encodeURIComponent(request.ref)}`, toFocusPayload(request))
      if (res.ok) return json(200, fromFocusResponse(res.data, res.base))
      // Referência já usada (reenvio depois de uma queda): vale o que o provedor tem
      const again = await focus('GET', request.ambiente, token, `/nfce/${encodeURIComponent(request.ref)}`)
      if (again.ok && again.data.status) return json(200, fromFocusResponse(again.data, again.base))
      return json(200, { status: 'rejeitada', mensagem: String(res.data.mensagem ?? res.data.codigo ?? `Erro ${res.status} do provedor`) } satisfies FiscalResult)
    }

    const ref = String(body.ref ?? '')
    if (!/^[A-Za-z0-9_-]{6,60}$/.test(ref)) return json(400, { erro: 'Referência inválida' })

    if (action === 'consultar') {
      const res = await focus('GET', ambiente, token, `/nfce/${encodeURIComponent(ref)}`)
      if (!res.ok) return json(200, { status: 'erro', mensagem: String(res.data.mensagem ?? 'Nota não encontrada no provedor') } satisfies FiscalResult)
      return json(200, fromFocusResponse(res.data, res.base))
    }

    if (action === 'cancelar') {
      const justificativa = String(body.justificativa ?? '').trim()
      if (justificativa.length < 15 || justificativa.length > 255) return json(422, { erro: 'Justificativa entre 15 e 255 caracteres' })
      const res = await focus('DELETE', ambiente, token, `/nfce/${encodeURIComponent(ref)}`, { justificativa })
      const result = fromFocusResponse(res.data, res.base)
      if (res.data.status === 'erro_cancelamento' || !res.ok) {
        return json(200, { status: 'erro', mensagem: String(res.data.mensagem_sefaz ?? res.data.mensagem ?? 'Cancelamento recusado') } satisfies FiscalResult)
      }
      return json(200, result)
    }

    return json(400, { erro: 'Ação desconhecida' })
  } catch (err) {
    const t = timeoutResult(err)
    if (t) return json(200, t)
    console.error('[nfce]', err)
    return json(502, { erro: 'Falha ao falar com o provedor fiscal' })
  }
}

export const config = { path: '/api/nfce' }
