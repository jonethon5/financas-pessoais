import { describe, expect, it } from 'vitest'
import { daysBetween, localNow, planPushes, reminderPush, type NotifyInput } from '../../supabase/functions/_shared/notify.ts'

const base = (over: Partial<NotifyInput> = {}): NotifyInput => ({
  name: 'Ana Souza',
  tone: 'equilibrado',
  pig: 'Poupinho',
  today: '2026-11-20',
  hour: 20,
  weekday: 5,
  eveningHour: 20,
  enabled: () => true,
  lastSeenOn: '2026-11-19',
  hasBank: false,
  payday: 30,
  salaryCents: 206900,
  splitDone: false,
  bills: [],
  wishesReady: [],
  goals: [],
  sent: new Set(),
  ...over,
})

describe('avisos: lembrete do dia (como o Duolingo)', () => {
  it('abriu o app hoje: não lembra', () => {
    expect(reminderPush(base({ lastSeenOn: '2026-11-20' }))).toBeNull()
  })

  it('não abriu hoje: chama pelo primeiro nome, no tom escolhido', () => {
    const p = reminderPush(base())!
    expect(p.title).toBe('Poupinho')
    expect(p.body).toMatch(/^Ana, /)
    expect(p.body).toMatch(/10 segundos/)
    expect(p.refs).toEqual(['lembrete:2026-11-20'])
  })

  it('com banco conectado: pede para conferir o que chegou', () => {
    expect(reminderPush(base({ hasBank: true }))!.body).toMatch(/banco/)
  })

  it('sumiu: saudade (2 a 3 dias), magrinho (4 a 6), dá um tempo no 7º e depois para', () => {
    expect(reminderPush(base({ lastSeenOn: '2026-11-18' }))!.title).toBe('O Poupinho está com saudade')
    expect(reminderPush(base({ lastSeenOn: '2026-11-15', pig: 'Poupinha' }))!.title).toBe('O Poupinha está ficando magrinho')
    const pause = reminderPush(base({ lastSeenOn: '2026-11-13' }))!
    expect(pause.title).toBe('O Poupinho vai dar um tempo')
    expect(pause.art).toBe('rosto-triste')
    expect(reminderPush(base({ lastSeenOn: '2026-11-10' }))).toBeNull()
  })

  it('o tom muda a frase', () => {
    const soft = reminderPush(base({ tone: 'suave', lastSeenOn: '2026-11-15' }))!.body
    const hard = reminderPush(base({ tone: 'agressivo', lastSeenOn: '2026-11-15' }))!.body
    expect(soft).not.toBe(hard)
  })

  it('já mandado hoje: não repete', () => {
    expect(reminderPush(base({ sent: new Set(['lembrete:2026-11-20']) }))).toBeNull()
  })
})

describe('avisos: manhã', () => {
  const morning = (over: Partial<NotifyInput> = {}) => planPushes(base({ hour: 9, ...over }))

  it('conta vencendo: antes (na janela do aviso), no dia e no atraso; cada etapa uma vez', () => {
    const tel = { id: 't1', description: 'Telefone', amount_cents: 3900, date: '2026-11-22', window: 3 }
    const [p] = morning({ bills: [tel] })
    expect(p.title).toBe('Telefone vence em 2 dias')
    expect(p.body).toMatch(/^R\$ 39,00\. /)
    expect(p.refs).toEqual(['vencimentos:t1:2026-11-22:antes'])
    // a mesma etapa não sai de novo; no dia, sai o "vence hoje"
    expect(morning({ bills: [tel], sent: new Set(p.refs) })).toEqual([])
    expect(morning({ today: '2026-11-22', bills: [tel], sent: new Set(p.refs) })[0].title).toBe('Telefone vence hoje')
    expect(morning({ today: '2026-11-23', bills: [tel] })[0].title).toBe('Telefone venceu ontem')
    // fora da janela (avisar 3 dias antes): ainda não
    expect(morning({ today: '2026-11-15', bills: [tel] })).toEqual([])
  })

  it('várias contas: um aviso só, com o total', () => {
    const bills = [
      { id: 'a', description: 'Luz', amount_cents: 12000, date: '2026-11-20', window: 3 },
      { id: 'b', description: 'Internet', amount_cents: 9900, date: '2026-11-21', window: 3 },
    ]
    const [p] = morning({ bills })
    expect(p.title).toBe('2 contas vencendo')
    expect(p.body).toMatch(/^Luz e Internet: R\$ 219,00 no total\./)
    expect(p.refs).toHaveLength(2)
  })

  it('dia do salário: lembra de separar o das caixinhas (31 em fevereiro vira o último dia)', () => {
    expect(morning({ today: '2026-11-30' })[0]).toMatchObject({ kind: 'pagamento', title: 'Dia de salário!', url: '/separar' })
    expect(morning({ today: '2026-11-30', splitDone: true })).toEqual([])
    expect(morning({ today: '2027-02-28', payday: 31 })[0].kind).toBe('pagamento')
  })

  it('desejo que terminou a espera, e no máximo 2 avisos de manhã', () => {
    const out = morning({
      today: '2026-11-30',
      bills: [{ id: 'a', description: 'Luz', amount_cents: 12000, date: '2026-11-30', window: 3 }],
      wishesReady: [{ id: 'w', name: 'Jaqueta jeans' }],
    })
    expect(out.map((p) => p.kind)).toEqual(['vencimentos', 'pagamento'])
    expect(morning({ wishesReady: [{ id: 'w', name: 'Jaqueta jeans' }] })[0].title).toBe('A espera acabou: Jaqueta jeans')
  })

  it('aviso desligado em Ajustes não sai', () => {
    const tel = { id: 't1', description: 'Telefone', amount_cents: 3900, date: '2026-11-20', window: 3 }
    expect(morning({ bills: [tel], enabled: (k) => k !== 'vencimentos' })).toEqual([])
  })

  it('antes das 9h, nada', () => {
    expect(planPushes(base({ hour: 7, bills: [{ id: 't', description: 'X', amount_cents: 1, date: '2026-11-20', window: 3 }] }))).toEqual([])
  })
})

describe('avisos: noite', () => {
  it('um aviso só: marco da caixinha vem antes do lembrete', () => {
    const goals = [{ id: 'g', name: 'Reserva', saved_cents: 4600, target_cents: 9000 }]
    const out = planPushes(base({ goals }))
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'metas', title: 'Reserva passou de 50%' })
    // marca os marcos de baixo junto (não manda "25%" depois)
    expect(out[0].refs).toEqual(['metas:g:50', 'metas:g:25'])
    expect(planPushes(base({ goals, sent: new Set(out[0].refs) }))[0].kind).toBe('lembrete')
  })

  it('domingo: revisão da semana', () => {
    expect(planPushes(base({ weekday: 0, lastSeenOn: '2026-11-20' }))[0]).toMatchObject({ kind: 'revisao', url: '/revisao' })
  })

  it('respeita o horário escolhido', () => {
    expect(planPushes(base({ hour: 19, eveningHour: 21 }))).toEqual([])
    expect(planPushes(base({ hour: 21, eveningHour: 21 }))[0].kind).toBe('lembrete')
  })
})

describe('datas', () => {
  it('dias entre datas e hora local de Brasília', () => {
    expect(daysBetween('2026-11-28', '2026-12-02')).toBe(4)
    // 23:30 UTC de sexta = 20:30 de sexta em Brasília
    expect(localNow(new Date('2026-11-20T23:30:00Z'), 'America/Sao_Paulo')).toEqual({ today: '2026-11-20', hour: 20, weekday: 5 })
    // fuso inválido: usa Brasília
    expect(localNow(new Date('2026-11-20T23:30:00Z'), 'Lugar/Nenhum').hour).toBe(20)
  })
})
