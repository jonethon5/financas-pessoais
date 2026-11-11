/**
 * Aprender: métodos para guardar e sair das dívidas, vindos de livros conhecidos e de estudos publicados.
 * Escrito com palavras nossas, em linguagem simples, com exemplos para quem ganha por volta de R$ 3.000.
 * É também a base que a IA (fase 6) vai usar: ela só recomenda o que está aqui.
 */
export type SourceKind = 'estudo' | 'livro' | 'oficial'
export type LessonIcon = 'piggy' | 'tag' | 'shield' | 'hourglass' | 'clock' | 'target' | 'card' | 'warning' | 'snowball' | 'brain' | 'sunrise' | 'bell' | 'lock' | 'pie' | 'repeat' | 'note'
export type LessonGroup = 'comece' | 'impulsos' | 'dividas' | 'cabeca'

export type Lesson = {
  id: string
  group: LessonGroup
  icon: LessonIcon
  color: string
  title: string
  /** Uma frase: aparece na lista e no carrossel da tela inicial. */
  short: string
  body: string[]
  steps: string[]
  /** Exemplo com salário de R$ 3.000. */
  example: string
  sources: { kind: SourceKind; text: string }[]
  cta?: { label: string; to: string }
}

export const GROUPS: { id: LessonGroup; title: string }[] = [
  { id: 'comece', title: 'Comece por aqui' },
  { id: 'impulsos', title: 'Gastar com a cabeça' },
  { id: 'dividas', title: 'Sair das dívidas' },
  { id: 'cabeca', title: 'Hábitos que ajudam' },
]

export const SOURCE_LABEL: Record<SourceKind, string> = { estudo: 'Estudo científico', livro: 'Livro', oficial: 'Fonte oficial' }

export const LESSONS: Lesson[] = [
  {
    id: 'pague-se-primeiro',
    group: 'comece',
    icon: 'piggy',
    color: '#0F9D6B',
    title: 'Guarde primeiro, gaste depois',
    short: 'Separe o dinheiro de guardar no dia do salário, antes de qualquer conta.',
    body: [
      'Quem espera sobrar no fim do mês quase nunca guarda: o dinheiro some nos pequenos gastos. O jeito que funciona é o contrário: no dia em que o salário cai, você tira primeiro a sua parte e vive com o resto.',
      'Não precisa ser muito. O que muda a sua vida é o costume, não o valor. Comece pequeno e aumente um pouco sempre que ganhar mais.',
      'Um estudo famoso com trabalhadores mostrou que, quando a pessoa combina antes de guardar automaticamente uma parte (e aumentar quando o salário sobe), a poupança cresce muito mais do que só com força de vontade.',
    ],
    steps: ['Escolha um valor que não aperte: 5% já é um ótimo começo.', 'No dia do salário, use “Separar” e mande esse valor para as caixinhas.', 'A cada aumento de salário, aumente um pouco a porcentagem.'],
    example: 'Com R$ 3.000, 5% são R$ 150 por mês. Em um ano, R$ 1.800 guardados, sem contar o rendimento.',
    sources: [
      { kind: 'livro', text: 'George S. Clason, “O Homem Mais Rico da Babilônia” (1926)' },
      { kind: 'estudo', text: 'Thaler e Benartzi (2004), “Save More Tomorrow”, Journal of Political Economy' },
    ],
    cta: { label: 'Separar o salário', to: '/separar' },
  },
  {
    id: 'reserva',
    group: 'comece',
    icon: 'shield',
    color: '#2F6FEB',
    title: 'Primeiro, uma reserva para imprevistos',
    short: 'Até R$ 500 guardados já evitam muita dívida cara quando algo dá errado.',
    body: [
      'Remédio, conserto da moto, geladeira que queimou. Sem nenhum dinheiro guardado, o imprevisto vira cartão no rotativo ou empréstimo com juros altos, e a dívida cresce.',
      'Pesquisas com famílias de baixa renda mostram que até uma reserva pequena, de poucas centenas, já reduz bastante a chance de atrasar aluguel e contas.',
      'Por isso, a reserva vem antes de qualquer outro sonho. Comece com uma meta pequena e vá aumentando aos poucos.',
    ],
    steps: ['Crie a caixinha “Reserva de emergência”.', 'Primeira meta: R$ 500.', 'Depois: um mês do seu custo de vida. Com o tempo, de 3 a 6 meses.', 'Use só para imprevisto de verdade e reponha depois.'],
    example: 'Guardando R$ 150 por mês, os primeiros R$ 500 ficam prontos em pouco mais de 3 meses.',
    sources: [
      { kind: 'estudo', text: 'McKernan e outros (2016), Urban Institute: reservas pequenas e dificuldades financeiras' },
      { kind: 'livro', text: 'Morgan Housel, “A Psicologia Financeira” (2020)' },
    ],
    cta: { label: 'Criar a reserva', to: '/caixinhas/nova' },
  },
  {
    id: 'caixinhas-com-nome',
    group: 'comece',
    icon: 'tag',
    color: '#6E56F0',
    title: 'Dinheiro com nome é mais difícil de gastar',
    short: 'Separar em caixinhas com nome e foto faz a pessoa guardar mais.',
    body: [
      'A nossa cabeça trata cada dinheiro de um jeito, como se fossem gavetas diferentes. Quando o dinheiro tem um nome, “Viagem para ver minha mãe”, mexer nele dá mais peso na consciência.',
      'Num estudo com trabalhadores de baixa renda, quem separou o dinheiro em envelopes com a foto dos filhos guardou bem mais do que quem deixou tudo junto.',
    ],
    steps: ['Dê um nome claro para cada caixinha.', 'Coloque uma foto e escreva o seu porquê.', 'Evite uma caixinha só para tudo.'],
    example: 'Em vez de R$ 300 numa “Poupança” só, separe R$ 150 na “Reserva”, R$ 100 no “Material escolar de fevereiro” e R$ 50 na “Moto nova”.',
    sources: [
      { kind: 'estudo', text: 'Soman e Cheema (2011), Journal of Marketing Research' },
      { kind: 'livro', text: 'Richard Thaler e Cass Sunstein, “Nudge” (2008)' },
    ],
    cta: { label: 'Ver caixinhas', to: '/caixinhas' },
  },
  {
    id: 'anotar',
    group: 'comece',
    icon: 'note',
    color: '#0E9AA7',
    title: 'Quem anota, controla',
    short: 'Acompanhar os gastos de perto ajuda a cumprir a meta.',
    body: [
      'Uma grande revisão de mais de 100 estudos mostrou que acompanhar o próprio progresso aumenta a chance de atingir uma meta, seja de saúde ou de dinheiro.',
      'Anotar na hora, em poucos segundos, funciona melhor do que tentar lembrar tudo no fim do mês.',
    ],
    steps: ['Lance o gasto assim que pagar: leva 5 segundos.', 'Olhe “Hoje você pode gastar” antes de comprar.', 'Uma vez por semana, veja a revisão da semana.'],
    example: 'Um lanche de R$ 12 por dia parece pouco. No mês, são uns R$ 260, quase 9% de um salário de R$ 3.000.',
    sources: [{ kind: 'estudo', text: 'Harkin e outros (2016), Psychological Bulletin: monitorar o progresso e atingir metas' }],
    cta: { label: 'Lançar um gasto', to: '/lancar?tipo=dia' },
  },
  {
    id: 'regra-30-dias',
    group: 'impulsos',
    icon: 'hourglass',
    color: '#E0A100',
    title: 'Deu vontade? Espere 30 dias',
    short: 'A vontade de comprar passa. Se depois de 30 dias ainda quiser, aí sim.',
    body: [
      'Na hora da vontade, a gente acha que vai querer aquilo para sempre. Pesquisas mostram que, com a cabeça fria, a mesma pessoa decide bem diferente.',
      'Esperar não é proibir: é dar tempo para a vontade passar. Muita coisa você nem vai lembrar daqui a um mês.',
    ],
    steps: ['Coloque o item na Lista de desejos.', 'Espere 30 dias.', 'Se ainda quiser e couber no mês, compre sem culpa.'],
    example: 'Um tênis de R$ 300 é 10% de um salário de R$ 3.000. Vale esperar um mês para ter certeza.',
    sources: [{ kind: 'estudo', text: 'George Loewenstein (1996), “Out of Control”, Organizational Behavior and Human Decision Processes' }],
    cta: { label: 'Abrir lista de desejos', to: '/habitos' },
  },
  {
    id: 'horas-de-trabalho',
    group: 'impulsos',
    icon: 'clock',
    color: '#FF6B4A',
    title: 'Quantas horas de trabalho custa?',
    short: 'Traduza o preço em horas de trabalho antes de comprar.',
    body: [
      'R$ 300 parece só um número. “19 horas de trabalho” pesa diferente. Pensar no preço em horas da sua vida ajuda a decidir o que vale a pena.',
      'O app já mostra isso quando você lança um gasto e tem o salário informado.',
    ],
    steps: ['Divida o salário pelas horas que trabalha no mês (com 44 horas por semana, são umas 190).', 'Antes de comprar, pense: isso vale essas horas?'],
    example: 'R$ 3.000 ÷ 190 horas ≈ R$ 15,80 por hora. Um celular de R$ 1.500 custa umas 95 horas: mais de 2 semanas de trabalho.',
    sources: [{ kind: 'livro', text: 'Vicki Robin e Joe Dominguez, “Your Money or Your Life” (1992)' }],
  },
  {
    id: 'cartao-doi-menos',
    group: 'impulsos',
    icon: 'card',
    color: '#C2410C',
    title: 'O cartão de crédito dói menos (e engana)',
    short: 'No cartão, a gente aceita pagar mais caro sem perceber.',
    body: [
      'Pagar com dinheiro ou Pix “dói” na hora. No cartão de crédito, a dor fica para depois, e a gente gasta mais.',
      'Num experimento clássico, pessoas que pagariam com cartão ofereceram até o dobro pelos mesmos ingressos do que as que pagariam em dinheiro.',
    ],
    steps: ['No dia a dia, prefira débito ou Pix.', 'Decida quanto vai gastar antes de chegar ao caixa.', 'Lance a compra no cartão na hora: ela já sai do seu “pode gastar hoje”.'],
    example: 'Se o cartão faz você gastar só 10% a mais, com R$ 1.000 de fatura são R$ 100 a mais por mês.',
    sources: [{ kind: 'estudo', text: 'Prelec e Simester (2001), “Always Leave Home Without It”, Marketing Letters' }],
  },
  {
    id: 'se-entao',
    group: 'impulsos',
    icon: 'target',
    color: '#6E56F0',
    title: 'Planos “se… então”',
    short: 'Decida antes o que fazer na hora da tentação. Funciona muito mais.',
    body: [
      'Querer gastar menos é vago. Um plano do tipo “se for sexta à noite, então peço comida só uma vez” deixa a decisão pronta para o momento difícil.',
      'Uma revisão de quase 100 estudos mostrou que esse tipo de plano aumenta bastante a chance de a pessoa cumprir o que quer.',
    ],
    steps: ['Pense na situação em que você mais gasta sem querer.', 'Escreva: “Se (situação), então (o que vou fazer)”.', 'Cadastre em Hábitos para o app lembrar no dia certo.'],
    example: '“Se eu receber o salário, então mando R$ 150 para a reserva antes de pagar qualquer outra coisa.”',
    sources: [{ kind: 'estudo', text: 'Gollwitzer e Sheeran (2006), Advances in Experimental Social Psychology' }],
    cta: { label: 'Criar um plano', to: '/habitos' },
  },
  {
    id: 'assinaturas',
    group: 'impulsos',
    icon: 'repeat',
    color: '#6E56F0',
    title: 'Assinaturas esquecidas',
    short: 'A gente paga por coisas que quase não usa, todo mês.',
    body: [
      'Um estudo com academias mostrou que as pessoas pagavam o plano mensal, mas iam tão pouco que sairia mais barato pagar por dia. Isso acontece com streaming, apps e planos de celular.',
      'O app soma o que se repete e mostra quanto dá no ano: o número costuma assustar.',
    ],
    steps: ['Veja em Mês › Orçamento quanto você paga por ano em gastos que se repetem.', 'Para cada um, pergunte: usei no último mês?', 'Cancele um. Se sentir falta, assine de novo depois.'],
    example: 'Três assinaturas de R$ 40 são R$ 1.440 por ano: quase meio salário de R$ 3.000.',
    sources: [{ kind: 'estudo', text: 'DellaVigna e Malmendier (2006), “Paying Not to Go to the Gym”, American Economic Review' }],
    cta: { label: 'Ver o que se repete', to: '/mes?aba=orcamento' },
  },
  {
    id: 'rotativo',
    group: 'dividas',
    icon: 'warning',
    color: '#D92D20',
    title: 'Fuja do rotativo e do cheque especial',
    short: 'São os juros mais caros do país. Qualquer outra saída costuma ser melhor.',
    body: [
      'Pagar só o mínimo da fatura joga o resto no rotativo, e usar o limite da conta é cheque especial. No Brasil, essas duas linhas estão entre as mais caras que existem.',
      'Desde 2024, a lei limita os juros e encargos do rotativo ao valor da dívida original. Mesmo assim, a dívida ainda pode dobrar.',
    ],
    steps: ['Se não der para pagar a fatura toda, compare o parcelamento da fatura com o rotativo: o parcelamento costuma sair mais barato.', 'Troque dívida cara por mais barata (renegociação, consignado).', 'Corte o cartão até quitar: não faça compras novas nele.'],
    example: 'Uma fatura de R$ 600 que fica rolando no rotativo pode virar R$ 1.200, quase metade de um salário de R$ 3.000.',
    sources: [
      { kind: 'oficial', text: 'Lei 14.690/2023 (limite dos juros do rotativo do cartão)' },
      { kind: 'oficial', text: 'Banco Central do Brasil, estatísticas de taxas de juros' },
    ],
  },
  {
    id: 'bola-de-neve',
    group: 'dividas',
    icon: 'snowball',
    color: '#0F2433',
    title: 'Bola de neve: quite a menor dívida primeiro',
    short: 'Ver uma dívida sumindo dá força para pagar as outras.',
    body: [
      'Com várias dívidas, pague o mínimo em todas e coloque todo o resto na menor. Quando ela acabar, passe para a próxima. Cada dívida quitada é uma vitória que dá ânimo para continuar.',
      'Estudos com pessoas endividadas mostram que quitar contas inteiras, uma por vez, ajuda a manter a motivação até o fim.',
      'Se a sua motivação está boa, pagar primeiro a de juros mais altos (método avalanche) economiza mais. O melhor método é o que você consegue seguir.',
    ],
    steps: ['Liste as dívidas da menor para a maior.', 'Pague o mínimo em todas.', 'Todo dinheiro extra vai para a menor.', 'Quitou? O valor dela vai para a próxima.'],
    example: 'Dívidas de R$ 300, R$ 800 e R$ 2.000: comece pela de R$ 300. Com R$ 150 extras por mês, ela some em 2 meses.',
    sources: [
      { kind: 'livro', text: 'Dave Ramsey, “The Total Money Makeover” (2003)' },
      { kind: 'estudo', text: 'Gal e McShane (2012), Journal of Marketing Research' },
      { kind: 'estudo', text: 'Kettle e outros (2016), Journal of Consumer Research' },
    ],
  },
  {
    id: 'escassez',
    group: 'cabeca',
    icon: 'brain',
    color: '#6E56F0',
    title: 'Falta de dinheiro cansa a cabeça (não é culpa sua)',
    short: 'Quando o dinheiro aperta, decidir fica mais difícil. Automatize.',
    body: [
      'Pesquisadores mostraram que a preocupação com dinheiro ocupa a cabeça e piora as decisões, em qualquer pessoa. Não é falta de inteligência nem de disciplina.',
      'A saída é decidir menos na hora do aperto: deixar regras prontas, separar o dinheiro no dia do salário e planejar nos momentos de calma.',
    ],
    steps: ['Planeje o mês no dia do salário, com calma.', 'Deixe o app separar as caixinhas e calcular o “pode gastar hoje”.', 'Nos dias apertados, siga o plano em vez de decidir de novo.'],
    example: 'Em vez de pensar a cada compra “posso?”, olhe só um número: “hoje você pode gastar R$ 45”. Coube, compra. Não coube, fica para outro dia.',
    sources: [
      { kind: 'livro', text: 'Sendhil Mullainathan e Eldar Shafir, “Escassez” (2013)' },
      { kind: 'estudo', text: 'Mani e outros (2013), “Poverty Impedes Cognitive Function”, Science' },
    ],
    cta: { label: 'Separar o salário', to: '/separar' },
  },
  {
    id: 'compromisso',
    group: 'cabeca',
    icon: 'lock',
    color: '#0F9D6B',
    title: 'Amarre as suas próprias mãos',
    short: 'Combinar antes que o dinheiro fica guardado ajuda a não mexer nele.',
    body: [
      'Num estudo com famílias nas Filipinas, quem aceitou uma conta em que só podia sacar ao atingir a meta guardou bem mais depois de um ano do que quem não aceitou.',
      'Você pode fazer algo parecido: deixar o dinheiro longe da conta do dia a dia e dizer a alguém da família qual é a sua meta.',
    ],
    steps: ['Defina uma meta e uma data para cada caixinha.', 'Deixe o dinheiro guardado em outro lugar, fora da conta do dia a dia.', 'Conte a meta para alguém de confiança.'],
    example: 'Meta: R$ 1.200 até dezembro para o material escolar. São R$ 100 por mês, sem mexer.',
    sources: [{ kind: 'estudo', text: 'Ashraf, Karlan e Yin (2006), “Tying Odysseus to the Mast”, Quarterly Journal of Economics' }],
    cta: { label: 'Criar uma caixinha', to: '/caixinhas/nova' },
  },
  {
    id: 'lembretes',
    group: 'cabeca',
    icon: 'bell',
    color: '#2F6FEB',
    title: 'Um lembrete na hora certa',
    short: 'Lembretes simples fazem as pessoas guardarem mais.',
    body: [
      'Em estudos em vários países, pessoas que recebiam mensagens lembrando da meta guardaram mais do que quem não recebia. A gente não esquece porque quer: a vida é corrida.',
      'Por isso o app lembra do dia do salário, das contas a vencer e da revisão da semana.',
    ],
    steps: ['Informe o dia do salário em Você.', 'Faça a revisão da semana no domingo ou na segunda.', 'Mantenha a sequência de semanas guardando.'],
    example: 'Lembrete no dia do salário: “Separe os R$ 150 da reserva antes de pagar as contas.”',
    sources: [{ kind: 'estudo', text: 'Karlan e outros (2016), “Getting to the Top of Mind”, Management Science' }],
  },
  {
    id: 'recomeco',
    group: 'cabeca',
    icon: 'sunrise',
    color: '#FF6B4A',
    title: 'Use os recomeços a seu favor',
    short: 'Começo do mês, segunda-feira, aniversário: bons dias para começar.',
    body: [
      'Pesquisas mostram que as pessoas começam mais metas em datas que parecem um novo começo: início de semana, de mês, de ano ou depois do aniversário.',
      'Se o mês passado foi ruim, não tem problema. O que conta é o próximo passo.',
    ],
    steps: ['Escolha a próxima data de recomeço (segunda ou dia 1º).', 'Defina uma meta pequena para ela.', 'Errou? Recomece na próxima data, sem culpa.'],
    example: 'Dia 1º: “Este mês vou guardar R$ 100 e ficar 4 dias sem gastar nada.”',
    sources: [{ kind: 'estudo', text: 'Dai, Milkman e Riis (2014), “The Fresh Start Effect”, Management Science' }],
  },
  {
    id: '50-30-20',
    group: 'cabeca',
    icon: 'pie',
    color: '#0E9AA7',
    title: 'A regra 50-30-20, do jeito possível',
    short: 'Uma referência para dividir o salário. Use como guia, não como cobrança.',
    body: [
      'A ideia do livro: cerca de 50% para o essencial (moradia, comida, contas), 30% para o resto e 20% para guardar ou quitar dívidas.',
      'Para quem ganha pouco, o essencial muitas vezes passa de 50%, e tudo bem. Use a regra como direção: o importante é guardar alguma coisa todo mês e ir melhorando.',
    ],
    steps: ['Veja em Mês › Orçamento como o seu salário está dividido.', 'Se não der 20% para guardar, comece com 5% e aumente aos poucos.', 'Procure primeiro cortar no “resto”, não no essencial.'],
    example: 'Com R$ 3.000: a regra diria R$ 1.500 para o essencial, R$ 900 para o resto e R$ 600 para guardar. Se o essencial for R$ 2.100, comece guardando R$ 150.',
    sources: [{ kind: 'livro', text: 'Elizabeth Warren e Amelia Warren Tyagi, “All Your Worth” (2005)' }],
    cta: { label: 'Ver meu orçamento', to: '/mes?aba=orcamento' },
  },
]

export const lessonById = (id: string | undefined) => LESSONS.find((l) => l.id === id)

/** Lição do dia (muda todo dia, sempre a mesma no mesmo dia). */
export function lessonOfDay(dayIndex: number): Lesson {
  return LESSONS[((dayIndex % LESSONS.length) + LESSONS.length) % LESSONS.length]
}
