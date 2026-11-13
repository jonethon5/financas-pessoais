/**
 * Central de ajuda: perguntas e respostas sobre o app. Texto simples (sem formatação), com o caminho
 * das telas no formato "Você › Bancos". Ao mudar uma tela, atualize a resposta dela aqui.
 */
import { APP_NAME, MASCOT_NAME } from '../brand'

export type HelpItem = { q: string; a: string; to?: { label: string; path: string } }
export type HelpGroup = { id: string; title: string; items: HelpItem[] }

export const HELP: HelpGroup[] = [
  {
    id: 'comecando',
    title: 'Começando',
    items: [
      { q: `Para que serve o ${APP_NAME}?`, a: `Para ajudar você a organizar o dinheiro do mês, gastar sem culpa o que pode e guardar um pouco por vez. As dicas seguem o que os estudos mostram que funciona, e o ${MASCOT_NAME} acompanha você. Não é um banco: o app não guarda nem movimenta seu dinheiro.` },
      { q: 'O app é de graça?', a: 'Sim. Lançar gastos, acompanhar o mês, caixinhas, gráficos, extrato e dicas são de graça. Um plano Premium está sendo preparado (bancos e cartões conectados para todos e roupas exclusivas para o mascote), mas ainda não existe cobrança.', to: { label: 'Ver a prévia do Premium', path: '/premium' } },
      { q: 'Como instalo o app no celular?', a: 'No Android, abra o site no Chrome, toque nos três pontinhos e em "Instalar app" (ou "Adicionar à tela inicial"). No iPhone, abra no Safari, toque em Compartilhar e em "Adicionar à Tela de Início". Ele abre como um app normal.' },
      { q: 'O que é o modo demonstração?', a: 'É o app com dados de exemplo, para conhecer sem criar conta. Tudo fica só no seu aparelho. Para usar com seus dados de verdade, toque em "Criar conta" no topo.' },
      { q: 'Como vejo o guia das telas de novo?', a: `Em Ajustes, toque em "Ver o guia do app de novo". O ${MASCOT_NAME} volta a explicar cada tela na primeira vez que você abrir.`, to: { label: 'Abrir os ajustes', path: '/ajustes' } },
    ],
  },
  {
    id: 'lancamentos',
    title: 'Lançar gastos e rendas',
    items: [
      { q: 'Como lanço um gasto?', a: 'Toque no botão azul + no meio da barra de baixo e escolha "Gasto". Digite o valor, um nome (ex.: Mercado) e a categoria. Se quiser, marque como você estava (estressado, comemorando…): com o tempo dá para ver em que momentos você mais gasta.' },
      { q: 'Como lanço uma renda extra?', a: 'Toque no + e escolha "Renda". Use para bicos, freelas, 13º, venda de algo. Só entra como renda o que você lança (ou o que você liga em "Contar como renda" no extrato).' },
      { q: 'O que é gasto fixo?', a: 'Conta que se repete todo mês (aluguel, internet, academia). Toque no + e escolha "Gasto fixo": ele entra sozinho todo mês no dia do vencimento, e o app avisa antes de vencer. Para mudar ou parar, vá em Você › Gastos fixos.' },
      { q: 'Como lanço uma compra parcelada?', a: 'Toque no + e escolha "Parcelado". Informe o valor total (ou o de cada parcela) e quantas vezes. Cada parcela aparece no mês dela, com "3/10", "4/10"…' },
      { q: 'Como edito ou apago um lançamento?', a: 'Toque nele (no Início, no Mês ou no Extrato). Dá para mudar valor, nome, categoria e data. O que veio do banco não se apaga, porque voltaria na próxima atualização: em vez disso, desligue "Contar".' },
    ],
  },
  {
    id: 'renda',
    title: 'Salário e renda do mês',
    items: [
      { q: 'Como o app calcula a minha renda do mês?', a: 'A renda do mês é o salário que você cadastrou em Você › Salário, mais as rendas extras que você lançar. O salário entra sozinho todo mês no dia do pagamento, sempre com o valor do cadastro.', to: { label: 'Ver meu salário', path: '/voce' } },
      { q: 'Por que o dinheiro que entrou na minha conta não aparece como renda?', a: 'Porque nem todo dinheiro que entra é renda: pode ser um Pix entre suas contas, dinheiro devolvido por alguém ou resgate da caixinha. Para não inflar a sua renda, essas entradas aparecem no extrato em "Não contam". Se uma delas for renda de verdade, toque nela e ligue "Contar como renda do mês": as próximas da mesma pessoa já entram contando.' },
      { q: 'Meu salário caiu com outro valor. E agora?', a: 'Quando o banco está conectado, o depósito do salário só confirma o salário do mês: o valor continua o do cadastro. Se o seu salário mudou de vez, atualize em Você › Salário.' },
      { q: 'Como mudo o dia do pagamento ou as horas de trabalho?', a: 'Em Você › Salário e pagamento. As horas por semana servem para mostrar quanto do seu trabalho custa cada compra (ex.: "esse lanche = 2 horas").' },
    ],
  },
  {
    id: 'extrato',
    title: 'Extrato',
    items: [
      { q: 'Onde vejo o extrato completo?', a: 'No Início, em "Últimos gastos" › Ver extrato completo, ou em Contas e cartões › Ver o extrato de tudo. Também dá para abrir pelo Mês.', to: { label: 'Abrir o extrato', path: '/extrato' } },
      { q: 'Como vejo só um cartão ou uma conta?', a: 'No topo do extrato, toque no cartão ou na conta (ex.: "Nubank cartão"). Para voltar a ver tudo, toque em "Todas".' },
      { q: 'Como vejo só o que entrou ou só o que saiu?', a: 'Toque em "Entrou" ou "Saiu" no topo do extrato. Toque de novo para ver tudo. Entradas aparecem com + e saídas com −.' },
      { q: 'O que é "Não contam"?', a: 'Movimentações que aparecem no banco, mas não são gasto nem renda do mês: transferência entre contas suas, pagamento da fatura do cartão (a compra já contou no dia), dinheiro guardado ou resgatado da caixinha e entradas que você não marcou como renda. Elas ficam visíveis para o extrato bater com o do banco, mas fora dos totais.' },
      { q: 'Como exporto o extrato?', a: 'No fim do extrato, toque em "Exportar extrato", escolha o período (mês atual, mês anterior, período completo ou as datas que quiser) e o formato: PDF ou planilha (abre no Excel). O arquivo é gerado no seu aparelho.' },
      { q: 'Por que aparece o logo da empresa em alguns lançamentos?', a: 'Quando o app reconhece a empresa pelo nome (Uber, iFood, Renner…), mostra o logo para ficar mais fácil de achar. Quando não reconhece, mostra o ícone da categoria.' },
    ],
  },
  {
    id: 'bancos',
    title: 'Banco conectado (Open Finance)',
    items: [
      { q: 'É seguro conectar o banco?', a: 'A conexão é pelo Open Finance, regulado pelo Banco Central, e é só de leitura: o app vê saldos e lançamentos, mas não consegue mover dinheiro. Você pode desconectar quando quiser.' },
      { q: 'Como conecto um banco?', a: 'Em Você › Bancos, toque em "Conectar outro" e busque o seu banco. No beta, a conexão passa pelo Meu Pluggy: você autoriza o banco por lá e cola aqui o código da conexão (Item ID). Cada banco tem o seu código.', to: { label: 'Abrir Bancos', path: '/voce/bancos' } },
      { q: 'Quanto tempo demora para um gasto aparecer?', a: 'O Meu Pluggy busca os dados no banco uma vez por dia. Assim que ele termina, o app é avisado e traz os lançamentos novos na hora. Por isso uma compra de hoje pode aparecer só amanhã. O botão "Atualizar agora" em Você › Bancos busca o que já estiver disponível.' },
      { q: 'O app sabe o que foi no crédito e o que foi no débito?', a: 'Sim. Compra no cartão de crédito conta no dia da compra; o que sai da conta aparece como Pix ou débito. O pagamento da fatura não conta de novo (o gasto já contou na compra).' },
      { q: 'Tirei dinheiro da caixinha (poupança) e não apareceu como renda. Está certo?', a: 'Está. Dinheiro que sai da caixinha volta para a sua conta, mas não é renda nova: aparece no extrato em "Não contam". O saldo guardado aparece em Contas e cartões, separado do dinheiro da conta.' },
      { q: 'Lancei um gasto à mão e ele veio do banco também. Duplicou?', a: 'Não. Se o valor é o mesmo e a data é próxima (até 2 dias), o lançamento do banco só confirma o seu, mantendo o nome, a categoria e o sentimento que você colocou.' },
      { q: 'Apareceu "Autorização vencida" ou "Não atualizou". O que faço?', a: 'A autorização do Open Finance dura um tempo e pode vencer. Autorize de novo no Meu Pluggy e toque em "Atualizar agora". Se o banco estiver fora do ar, tente mais tarde.' },
      { q: 'Como desconecto um banco?', a: 'Em Você › Bancos, toque em "Desconectar" embaixo do banco. Os lançamentos que já vieram continuam no app. Para cortar o acesso de vez, revogue também no Meu Pluggy.' },
    ],
  },
  {
    id: 'categorias',
    title: 'Categorias',
    items: [
      { q: 'Como funcionam as categorias?', a: 'Cada gasto fica numa categoria (Mercado, Transporte…). Elas alimentam os gráficos, o orçamento por categoria e os alertas de limite. "Outros" fica sempre por último, para o que não se encaixa.' },
      { q: 'Como crio uma categoria nova?', a: 'Ao lançar, toque em "Mais" nas categorias: dá para adicionar categorias prontas com um toque ou criar uma nova com nome, ícone e cor. Também em Você › Categorias.', to: { label: 'Abrir Categorias', path: '/voce/categorias' } },
      { q: 'O app aprende a categoria sozinho?', a: 'Sim, no que vem do banco. Quando você muda a categoria de um lançamento, o app lembra: os próximos da mesma loja ou pessoa já chegam nela (ex.: o Pix mensal da pensão vai direto para "Pensão"). Os parecidos que já estão no app também são corrigidos.' },
      { q: 'Como coloco limite numa categoria?', a: 'No Mês › Orçamento, ou em Você › Categorias. O app avisa quando chegar a 80% e quando passar do limite.' },
    ],
  },
  {
    id: 'graficos',
    title: 'Gráficos e indicadores',
    items: [
      { q: 'Como é calculado o "Hoje você pode gastar"?', a: 'É o que sobra do mês dividido pelos dias que faltam: renda, menos fixos e parcelas, menos o que vai para as caixinhas, menos o que você já gastou no dia a dia até ontem. Se gastar menos hoje, o valor dos próximos dias aumenta.' },
      { q: 'O que mostram os gráficos?', a: 'Na aba Gráficos: para onde vai o dinheiro (por categoria e por tipo), como as rendas se dividem, a evolução dos últimos 6 ou 12 meses e os dias em que você mais gasta.', to: { label: 'Abrir Gráficos', path: '/graficos' } },
      { q: 'O que é o painel de cada conta e cartão?', a: 'Em Contas e cartões, toque num cartãozinho: aparecem o gasto do mês, a compra média, a maior compra, as categorias, os dias da semana em que mais sai dinheiro, os lugares que mais se repetem e o que o mascote reparou.' },
      { q: 'O que é a Saúde financeira?', a: 'Uma nota de 0 a 100 feita com cinco partes: sobra no mês, reserva de emergência, controle dos gastos, dívidas e constância em guardar. Toque nela para ver o que mais ajuda a subir.', to: { label: 'Ver a Saúde', path: '/saude' } },
    ],
  },
  {
    id: 'caixinhas',
    title: 'Caixinhas e metas',
    items: [
      { q: 'O que é uma caixinha?', a: 'Um lugar para separar o dinheiro de um objetivo: reserva de emergência, viagem, uma compra. Você define quanto quer juntar e quanto guardar por mês, e o app mostra quando você chega lá.', to: { label: 'Abrir Caixinhas', path: '/caixinhas' } },
      { q: 'O dinheiro da caixinha fica no app?', a: 'Não. O app só anota quanto você separou; o dinheiro continua no seu banco (de preferência numa conta que renda, como a caixinha do seu banco).' },
      { q: 'Por onde começo?', a: 'Pela reserva de emergência: com algumas centenas de reais guardados, um imprevisto não vira dívida. Depois, os sonhos.' },
    ],
  },
  {
    id: 'porquinho',
    title: `${MASCOT_NAME} e moedas`,
    items: [
      { q: `Quem é o ${MASCOT_NAME}?`, a: 'O mascote que dá as dicas. Ele engorda conforme você chega perto da meta que você mesmo definiu, comemora com você e fica tristinho quando o mês aperta, mas nunca morre.' },
      { q: 'Como ganho moedas?', a: 'Cumprindo as metas do dia (lançar os gastos, ficar dentro do valor do dia, guardar). Com as moedas você compra roupas para o mascote na lojinha.', to: { label: 'Abrir o porquinho', path: '/porquinho' } },
      { q: 'O que muda nos modos suave, equilibrado e agressivo?', a: 'O jeito das dicas. Suave: gentil, sem pressão. Equilibrado: direto, com números e prazos realistas. Agressivo: cortes fortes para chegar mais rápido. Troque em Ajustes › Porquinho e dicas.' },
    ],
  },
  {
    id: 'conta',
    title: 'Conta e privacidade',
    items: [
      { q: 'Como escondo os valores da tela?', a: 'Toque no olho no topo da tela inicial. Os valores viram "R$ ••••" em todo o app até você tocar de novo.' },
      { q: 'Como mudo o tema (claro ou escuro) e o tamanho da letra?', a: 'Em Ajustes › Aparência.', to: { label: 'Abrir Aparência', path: '/ajustes/aparencia' } },
      { q: 'Como troco o e-mail ou a senha?', a: 'Em Ajustes › Conta e segurança.', to: { label: 'Abrir Conta e segurança', path: '/ajustes/conta' } },
      { q: 'Como apago a minha conta?', a: 'Em Ajustes › Conta e segurança › Excluir conta. Todos os seus dados são apagados de vez.' },
      { q: 'Quem vê os meus dados?', a: 'Só você. Os dados ficam protegidos por conta (ninguém vê os de outra pessoa) e nada é vendido. Os detalhes estão na Política de Privacidade.', to: { label: 'Ler a Política de Privacidade', path: '/privacidade' } },
    ],
  },
  {
    id: 'problemas',
    title: 'Problemas comuns',
    items: [
      { q: 'O app não mostra a versão nova.', a: 'Feche o app por completo (tire da lista de apps abertos) e abra de novo. Se continuar, no navegador, recarregue a página.' },
      { q: 'A renda do mês está errada.', a: 'Confira o salário em Você › Salário. Depois veja o extrato em "Entrou": só contam o salário e as rendas que você lançou ou marcou como renda. Se alguma entrada não for renda, toque nela e desligue "Contar".' },
      { q: 'Um gasto aparece duas vezes.', a: 'Se um foi lançado à mão e o outro veio do banco com o mesmo valor e data próxima, o app junta os dois na próxima atualização. Se forem de valores ou datas diferentes, toque no repetido e desligue "Contar" (ou apague, se foi lançado à mão).' },
      { q: 'Não chegou o e-mail de confirmação ou de nova senha.', a: 'Veja a caixa de spam e a aba Promoções. Se não chegar em alguns minutos, peça de novo.' },
      { q: 'Não achei a resposta aqui.', a: 'Mande uma mensagem em Ajuda e sugestões: lemos todas.', to: { label: 'Mandar mensagem', path: '/voce/sugestao' } },
    ],
  },
]

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca nas perguntas e respostas (sem acento). Todas as palavras precisam aparecer. */
export function searchHelp(query: string): { group: HelpGroup; item: HelpItem }[] {
  const words = plain(query).split(/\s+/).filter((w) => w.length > 1)
  if (!words.length) return []
  const out: { group: HelpGroup; item: HelpItem; score: number }[] = []
  for (const group of HELP)
    for (const item of group.items) {
      const q = plain(item.q)
      const text = `${q} ${plain(item.a)} ${plain(group.title)}`
      if (words.every((w) => text.includes(w))) out.push({ group, item, score: words.filter((w) => q.includes(w)).length })
    }
  return out.sort((a, b) => b.score - a.score)
}
