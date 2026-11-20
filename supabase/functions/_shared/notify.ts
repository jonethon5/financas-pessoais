// Avisos no celular (push), no jeito do Duolingo: quem fala é o porquinho, com o nome da pessoa e no tom
// que ela escolheu (suave, equilibrado ou agressivo). Este arquivo só decide O QUE mandar; quem lê o banco
// e entrega é a função notify. Sem banco aqui, para testar (src/lib/notify.test.ts).
//
// Regras:
// - Manhã (a partir das 9h, até as 21h): contas vencendo, dia do salário, desejo que terminou a espera.
// - Noite (a partir do horário escolhido, padrão 20h, até as 23h): marco de caixinha, revisão de domingo
//   ou o lembrete do dia (só se a pessoa não abriu o app hoje).
// - No máximo 2 avisos de manhã e 1 à noite. Cada aviso tem uma referência e nunca é mandado duas vezes.
// - Sumiu: o lembrete muda com os dias (saudade, magrinho) e no 7º dia o porquinho avisa que vai dar
//   um tempo. Depois disso, para de chamar (até a pessoa voltar).

export type Tone = 'suave' | 'equilibrado' | 'agressivo'
export type NotifyKind = 'vencimentos' | 'pagamento' | 'limite' | 'revisao' | 'desejos' | 'metas' | 'lembrete'

export type Push = {
  kind: NotifyKind
  /** Referências gravadas no registro (uma por item do aviso): o mesmo aviso nunca sai duas vezes */
  refs: string[]
  title: string
  body: string
  /** Tela que abre ao tocar (caminho do app, ex.: /separar) */
  url: string
  /** Arte do porquinho que aparece no aviso */
  art: 'rosto-feliz' | 'rosto-pensativo' | 'rosto-preocupado' | 'rosto-triste' | 'rosto-animado' | 'meta-atingida'
}

export type Bill = { id: string; description: string; amount_cents: number; date: string }
export type Goal = { id: string; name: string; saved_cents: number; target_cents: number | null }

export type NotifyInput = {
  name: string
  tone: Tone
  pig: 'Poupinho' | 'Poupinha'
  /** Data e hora no fuso da pessoa */
  today: string
  hour: number
  /** 0 = domingo */
  weekday: number
  /** Horário do lembrete da noite (padrão 20) */
  eveningHour: number
  enabled: (kind: NotifyKind) => boolean
  /** Último dia em que abriu o app (null: ainda não sabemos) */
  lastSeenOn: string | null
  hasBank: boolean
  payday: number | null
  salaryCents: number | null
  /** Já separou o salário deste mês */
  splitDone: boolean
  /** Contas (fixos e parcelas) ainda não pagas, com a janela de aviso de cada uma em dias */
  bills: (Bill & { window: number })[]
  /** Desejos esperando cuja espera de 30 dias já terminou */
  wishesReady: { id: string; name: string }[]
  goals: Goal[]
  /** Referências já mandadas */
  sent: Set<string>
}

export const MORNING_HOUR = 9
const MORNING_END = 21
const NIGHT_END = 23

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ')

/** Dias entre duas datas ISO (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000)
}

/** Escolhe uma das frases sem sorteio: muda com o dia, então a pessoa não lê a mesma toda vez. */
function pick<T>(options: T[], seed: string): T {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0
  return options[Math.abs(h) % options.length]
}

/** Primeiro nome (o lembrete fala como gente: "Ana", não "Ana Souza"). */
const first = (name: string) => name.trim().split(/\s+/)[0] || ''

function byTone(tone: Tone, t: Record<Tone, string[]>, seed: string): string {
  return pick(t[tone], seed)
}

// ---------------------------------------------------------------------------------------------------
// Manhã

function billsPush(u: NotifyInput): Push | null {
  // Cada conta pode avisar 3 vezes: quando entra na janela, no dia e se passar do dia (até 3 dias)
  const due = u.bills
    .map((b) => ({ ...b, d: daysBetween(u.today, b.date) }))
    .filter((b) => b.d >= -3 && b.d <= b.window)
    .map((b) => ({ ...b, stage: b.d === 0 ? 'dia' : b.d < 0 ? 'atraso' : 'antes' }))
    .map((b) => ({ ...b, ref: `vencimentos:${b.id}:${b.date}:${b.stage}` }))
    .filter((b) => !u.sent.has(b.ref))
    .sort((a, b) => a.d - b.d)
  if (!due.length) return null
  const when = (d: number) => (d < 0 ? (d === -1 ? 'venceu ontem' : `venceu há ${-d} dias`) : d === 0 ? 'vence hoje' : d === 1 ? 'vence amanhã' : `vence em ${d} dias`)
  const late = due.some((b) => b.d < 0)
  const tip = byTone(
    u.tone,
    {
      suave: ['Se já pagou, é só marcar como pago no app.', 'Pagando em dia, o mês fica tranquilo.'],
      equilibrado: ['Pagar em dia evita multa e juros.', 'Se já pagou, marque como pago para o app não te lembrar de novo.'],
      agressivo: [late ? 'Atraso vira multa e juros. Resolve hoje.' : 'Atrasar custa multa e juros. Não deixa para depois.', 'Conta paga em dia é dinheiro que não vai para o banco.'],
    },
    u.today,
  )
  if (due.length === 1) {
    const b = due[0]
    return { kind: 'vencimentos', refs: [b.ref], title: `${b.description} ${when(b.d)}`, body: `${brl(b.amount_cents)}. ${tip}`, url: '/', art: late ? 'rosto-preocupado' : 'rosto-pensativo' }
  }
  const total = due.reduce((a, b) => a + b.amount_cents, 0)
  const names = due.map((b) => b.description)
  const list = names.length <= 3 ? `${names.slice(0, -1).join(', ')} e ${names.at(-1)}` : `${names.slice(0, 2).join(', ')} e mais ${names.length - 2}`
  return {
    kind: 'vencimentos',
    refs: due.map((b) => b.ref),
    title: late ? `${due.length} contas precisam de atenção` : `${due.length} contas vencendo`,
    body: `${list}: ${brl(total)} no total. ${tip}`,
    url: '/',
    art: late ? 'rosto-preocupado' : 'rosto-pensativo',
  }
}

/** Dia do pagamento no mês (31 em fevereiro vira o último dia). */
function paydayIn(today: string, payday: number): number {
  const y = +today.slice(0, 4)
  const m = +today.slice(5, 7)
  return Math.min(payday, new Date(Date.UTC(y, m, 0)).getUTCDate())
}

function paydayPush(u: NotifyInput): Push | null {
  if (!u.payday || u.splitDone || +u.today.slice(8, 10) !== paydayIn(u.today, u.payday)) return null
  const ref = `pagamento:${u.today.slice(0, 7)}`
  if (u.sent.has(ref)) return null
  const n = first(u.name)
  const body = byTone(
    u.tone,
    {
      suave: [`${n ? `${n}, que` : 'Que'} tal separar agora o das caixinhas? Guardar primeiro faz o dinheiro durar até o fim do mês.`],
      equilibrado: [`Separe primeiro o das caixinhas. O que sobra é o do mês, e fica mais fácil não passar do limite.`],
      agressivo: [`Antes de qualquer gasto: separa o das caixinhas agora. Quem guarda depois, não guarda.`],
    },
    u.today,
  )
  return { kind: 'pagamento', refs: [ref], title: 'Dia de salário!', body, url: '/separar', art: 'rosto-animado' }
}

function wishPush(u: NotifyInput): Push | null {
  const w = u.wishesReady.find((x) => !u.sent.has(`desejos:${x.id}`))
  if (!w) return null
  const body = byTone(
    u.tone,
    {
      suave: ['Ainda quer? Se a vontade passou, o dinheiro fica com você.'],
      equilibrado: ['Ainda faz sentido? Se a vontade passou, é dinheiro que fica no seu bolso.'],
      agressivo: ['Se a vontade passou, foi impulso. Desiste e guarda o dinheiro.'],
    },
    w.id,
  )
  return { kind: 'desejos', refs: [`desejos:${w.id}`], title: `A espera acabou: ${w.name}`, body, url: '/habitos', art: 'rosto-pensativo' }
}

// ---------------------------------------------------------------------------------------------------
// Noite

const MILESTONES = [100, 75, 50, 25]

function goalPush(u: NotifyInput): Push | null {
  for (const g of u.goals) {
    if (!g.target_cents || g.target_cents <= 0) continue
    const pct = (g.saved_cents / g.target_cents) * 100
    const m = MILESTONES.find((x) => pct >= x)
    if (!m) continue
    const ref = `metas:${g.id}:${m}`
    if (u.sent.has(ref)) continue
    // Avisa só o marco mais alto já passado (sem uma fila de "25%, 50%…" de uma vez); os de baixo ficam marcados
    const refs = MILESTONES.filter((x) => x <= m).map((x) => `metas:${g.id}:${x}`)
    if (m === 100) return { kind: 'metas', refs, title: `Caixinha completa: ${g.name}!`, body: `Você juntou ${brl(g.saved_cents)}. O ${u.pig} está orgulhoso de você.`, url: '/caixinhas', art: 'meta-atingida' }
    return { kind: 'metas', refs, title: `${g.name} passou de ${m}%`, body: `Já são ${brl(g.saved_cents)} de ${brl(g.target_cents)}. Cada depósito conta.`, url: '/caixinhas', art: 'rosto-animado' }
  }
  return null
}

function reviewPush(u: NotifyInput): Push | null {
  if (u.weekday !== 0) return null
  const ref = `revisao:${u.today}`
  if (u.sent.has(ref)) return null
  return { kind: 'revisao', refs: [ref], title: 'Sua semana em 2 minutos', body: `O ${u.pig} juntou o que aconteceu com o seu dinheiro nesta semana. Bora ver?`, url: '/revisao', art: 'rosto-feliz' }
}

/** O lembrete do dia: muda conforme os dias sem abrir o app. Depois do 7º dia, para. */
export function reminderPush(u: NotifyInput): Push | null {
  if (u.lastSeenOn === u.today) return null
  const away = u.lastSeenOn ? daysBetween(u.lastSeenOn, u.today) : 1
  if (away < 1 || away > 7) return null
  const ref = `lembrete:${u.today}`
  if (u.sent.has(ref)) return null
  const n = first(u.name)
  const hi = n ? `${n}, ` : ''
  const seed = `${u.today}:${away}`
  if (away === 7) {
    return {
      kind: 'lembrete',
      refs: [ref],
      title: `O ${u.pig} vai dar um tempo`,
      body: 'Esses lembretes não parecem estar ajudando, então vou parar por enquanto. Quando quiser voltar, estou aqui guardando tudo.',
      url: '/',
      art: 'rosto-triste',
    }
  }
  if (away >= 4) {
    return {
      kind: 'lembrete',
      refs: [ref],
      title: `O ${u.pig} está ficando magrinho`,
      body: byTone(
        u.tone,
        {
          suave: [`${hi}faz ${away} dias que a gente não se vê. Um minutinho hoje e ele volta a sorrir.`, `${hi}sem você ele não come. Passa aqui só para anotar os gastos?`],
          equilibrado: [`${away} dias sem anotar os gastos. Um minuto hoje e o mês volta para o lugar.`, `${hi}o mês continua andando. Um minuto agora evita a surpresa no fim.`],
          agressivo: [`${away} dias sem olhar o dinheiro. É assim que ele some. Abre o app agora.`, `${hi}quem não anota, não controla. Um minuto. Agora.`],
        },
        seed,
      ),
      url: '/',
      art: 'rosto-triste',
    }
  }
  if (away >= 2) {
    return {
      kind: 'lembrete',
      refs: [ref],
      title: `O ${u.pig} está com saudade`,
      body: byTone(
        u.tone,
        {
          suave: [`${hi}vem ver quanto ainda dá para gastar hoje? Ele guardou tudo para você.`, `${hi}uma olhadinha hoje já deixa o mês mais leve.`],
          equilibrado: [`${hi}faz ${away} dias. Veja quanto ainda dá para gastar hoje e o que vence esta semana.`, `${away} dias sem conferir. Um minuto para saber como está o mês.`],
          agressivo: [`${away} dias sem abrir. O dinheiro não espera: confere agora quanto ainda dá para gastar.`, `${hi}sumiu? O mês não sumiu. Abre e confere.`],
        },
        seed,
      ),
      url: '/',
      art: 'rosto-pensativo',
    }
  }
  return {
    kind: 'lembrete',
    refs: [ref],
    title: u.pig,
    body: u.hasBank
      ? byTone(
          u.tone,
          {
            suave: [`${hi}os gastos de hoje já chegaram do banco. Dá uma olhadinha se está tudo certo?`],
            equilibrado: [`${hi}os gastos de hoje já vieram do banco. Confira as categorias em 10 segundos.`],
            agressivo: [`${hi}o banco já mandou os gastos de hoje. Confere agora antes que vire bagunça.`],
          },
          seed,
        )
      : byTone(
          u.tone,
          {
            suave: [`Oi, ${n || 'tudo bem'}! Passa aqui rapidinho para anotar os gastos de hoje? Leva 10 segundos.`, `${hi}já anotou o cafezinho de hoje? O ${u.pig} adora quando o mês fica em dia.`],
            equilibrado: [`${hi}os gastos de hoje ainda não foram anotados. Leva 10 segundos e mantém o mês em dia.`, `${hi}10 segundos para anotar o dia e saber quanto sobra amanhã.`],
            agressivo: [`${hi}gasto não anotado é dinheiro que some. 10 segundos agora.`, `${hi}anota os gastos de hoje. Sem desculpa: são 10 segundos.`],
          },
          seed,
        ),
    url: '/',
    art: 'rosto-feliz',
  }
}

/** O que mandar agora para esta pessoa (no máximo 2 de manhã e 1 à noite). */
export function planPushes(u: NotifyInput): Push[] {
  const out: Push[] = []
  if (u.hour >= MORNING_HOUR && u.hour < MORNING_END) {
    const morning = [u.enabled('vencimentos') && billsPush(u), u.enabled('pagamento') && paydayPush(u), u.enabled('desejos') && wishPush(u)].filter(Boolean) as Push[]
    out.push(...morning.slice(0, 2))
  }
  if (u.hour >= u.eveningHour && u.hour < NIGHT_END) {
    const night = [u.enabled('metas') && goalPush(u), u.enabled('revisao') && reviewPush(u), u.enabled('lembrete') && reminderPush(u)].filter(Boolean) as Push[]
    if (night.length) out.push(night[0])
  }
  return out
}

/** Data (AAAA-MM-DD), hora e dia da semana no fuso da pessoa. */
export function localNow(now: Date, timeZone: string): { today: string; hour: number; weekday: number } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(now)
  } catch {
    return localNow(now, 'America/Sao_Paulo')
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return { today: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24, weekday: days.indexOf(get('weekday')) }
}
