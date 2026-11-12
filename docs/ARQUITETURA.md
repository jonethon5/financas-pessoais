# Arquitetura do Poupei

Como o código está organizado, o que fazem as principais funções e por que as coisas foram feitas assim.
Serve para estudar o projeto e para responder "por que você fez desse jeito?".

## 1. Visão geral

O app é um **PWA em React** (roda no navegador e pode ser instalado no celular) com o **Supabase** como back-end.
Ele tem quatro camadas:

```
src/pages        telas: montam a interface, não fazem conta
src/components   peças reutilizáveis: botões, listas, folhas que sobem de baixo, gráficos, porquinho, guia
src/data         acesso a dados: hooks do React Query e a interface Backend (Supabase ou demonstração)
src/lib          regras de negócio puras (sem React, sem rede), cada uma com testes
supabase/        banco (migrations com RLS) e Edge Functions (código que roda no servidor)
```

A regra de ouro: **conta de dinheiro só em `src/lib`**, em funções puras com teste. As telas chamam essas funções
e só desenham o resultado. Assim a mesma conta aparece igual na tela inicial, nos gráficos e no assistente.

## 2. Mapa de pastas

| Pasta / arquivo | Para que serve |
| --- | --- |
| `brand.json` | Nome do app, do mascote, textos e cores. Trocou aqui, trocou no app, nos e-mails e no ícone. |
| `src/main.tsx` | Ponto de entrada: React Query, autenticação, escolha do Backend, rotas (`HashRouter`). |
| `src/App.tsx` | Todas as rotas. Se o primeiro acesso não foi feito, mostra o `OnboardingPage`. |
| `src/components/Layout.tsx` | Barra de abas flutuante, botão "+", menu ☰ global, aviso de offline. |
| `src/components/ui.tsx` | Design system: `Button`, `Field`, `List`/`Row`, `NavBar`, `Money`, `ProgressBar`, `EmptyState`… |
| `src/data/backend.ts` | A **interface `Backend`** (list, insert, update, remove, upsert, perfil, arquivos…). |
| `src/data/supabaseBackend.ts` | Implementação real: Supabase, paginando de 1000 em 1000 linhas. |
| `src/data/localBackend.ts` | Implementação da demonstração: `localStorage`, com dados de exemplo (`demoSeed.ts`). |
| `src/data/finance.ts` | Hooks: `useMonthTxs`, `useHistory`, `useGoals`, `useTable`, `useWrite`, sincronização com o banco e Realtime. |
| `src/data/monthView.ts` | **`useMonthView`**: junta tudo de um mês e já entrega calculado (o "coração" das telas). |
| `src/data/pig.ts` | `usePig`: humor do porquinho, moedas a receber, loja. |
| `src/lib/*.ts` | Regras de negócio (próxima seção). |
| `supabase/migrations/` | Banco, em ordem: `0001` perfis e beta, `0002` lançamentos, `0003`/`0004` caixinhas, `0005` hábitos, `0006` bancos, `0007` IA, `0008` porquinho. |
| `supabase/functions/` | Edge Functions: `setup`, `delete-account`, `bank-sync`, `ask`, e `_shared` com o código comum. |
| `tests/db/` | Testes de integração contra o Supabase local: RLS, conexão com banco, IA, moedas. |
| `scripts/` | `sync-brand.mjs` (e-mails e nome a partir do `brand.json`), `sync-lessons.mjs` (base da IA), `vitrine.mjs` (prints do README). |

## 3. As regras de dinheiro (`src/lib`)

Tudo em **centavos inteiros**. `R$ 10,50` é `1050`.

### Orçamento do mês: `budget.ts`

- **`summarizeMonth(txs, save)`**: soma o mês por tipo.
  - renda = salário + extras;
  - comprometido = fixos + parcelas;
  - dia a dia;
  - **sobra = renda − comprometido − guardar − dia a dia**.
- **`spendToday(txs, save, hoje)`**: o "quanto posso gastar hoje".
  ```
  disponível = renda − fixos − parcelas − caixinhas do mês − gasto do dia a dia ATÉ ONTEM
  por dia    = disponível ÷ dias que faltam (contando hoje)
  pode hoje  = por dia − gasto de hoje
  ```
  O gasto de hoje sai do valor de hoje. Amanhã a conta é refeita: gastar menos hoje aumenta os próximos dias.
- **`categoryStatuses`** e **`effectiveLimit`**: limite por categoria (mensal e semanal), com dinheiro movido de uma
  categoria para outra (estilo YNAB). `levelOf` diz `ok`, `warn` (80%) ou `over`.
- **`subscriptions`**: tudo o que se repete (gastos fixos e gastos parecidos em 3 meses ou mais) e quanto dá no ano.

### Gastos que se repetem: `recurring.ts` e `installments.ts`

- O salário e os gastos fixos viram **lançamentos de verdade no mês atual**, com **id estável**:
  `stableId("salario:<usuario>:<mês>")` é um UUID derivado de um SHA-1. Se o app abrir duas vezes (ou em dois
  aparelhos), o mesmo id é gerado e o banco ignora a duplicata (`insert ... ignoreDuplicates`).
- Meses futuros mostram as linhas **virtuais** (não gravadas); meses passados mostram só o que existe.
- `buildInstallments` divide uma compra parcelada em N linhas. Os centavos que sobram da divisão vão um a um nas
  primeiras parcelas (`splitEqual`), então a soma das parcelas fecha exatamente o total.

### Caixinhas: `goals.ts`

- **`goalStatus(meta, movimentos, mês)`**: quanto foi guardado, quanto guardar por mês e quando chega.
  - **Por data:** `(meta − guardado antes do mês) ÷ meses que faltam`, arredondado para cima no real.
    Se um mês falha, os seguintes se recalculam sozinhos.
  - **Por mês** (ou livre com valor): `quando chega = mês atual + ⌈(meta − guardado após este mês) ÷ por mês⌉`.
- `withdrawImpact` (o "freio" ao tirar dinheiro), `distribute` (sobra repartida por prioridade), `crossedMilestones`
  (25/50/75/100%).

### Hábitos e psicologia: `psych.ts`

Sequências (`savingWeekStreak`, `loggingDayStreak`), desafios (`challengeProgress`), lista de desejos de 30 dias,
horas de trabalho (`workTime`), recomeço (`freshStart`), revisão da semana e do mês, teste de perfil e
`projection` ("em dezembro você terá…": o mês atual conta só o que ainda falta guardar nele).

### Saúde financeira: `health.ts`

**`financialHealth`**: nota de 0 a 100 em 5 pilares, inspirados no FinHealth Score:

| Pilar | Peso |
| --- | --- |
| Gastar menos do que ganha | 30 |
| Contas em dia | 15 |
| Reserva para imprevistos | 25 |
| Guardar todo mês | 20 |
| Ter um plano | 10 |

Pilar sem dados fica de fora, e a nota é proporcional ao que dá para medir. `next` traz os dois pilares que mais
perdem pontos, cada um com dica e lição.

### Porquinho: `pig.ts`

- **`dayGoals`**: metas do dia.
  - "Lançou" e "guardou" contam na hora.
  - "No limite" e "dia sem gastar" contam só quando o dia acaba.
- **`pendingRewards`**: moedas dos últimos 7 dias, semana completa (+10) e marcos de caixinha (+5).
- **`pigState`**: barriga = 65% "guardou o que combinou" + 35% hábitos da semana. Por isso quem guarda R$ 20 de uma
  meta de R$ 20 fica igual a quem guarda R$ 500 de R$ 500. Antes do dia do pagamento, vale o mês anterior.

### Assistente: `coach.ts`

- `cutPlan`: plano de corte; `purchaseImpact`: "posso comprar isso?" (% do salário, horas de trabalho, dias do
  "pode gastar hoje", atraso das metas).
- `buildFacts`: o resumo enviado à IA, só com totais.
- `localAnswer`: resposta sem IA, usada na demonstração e quando a chave não está configurada.

### Outros

`charts.ts` (dados dos gráficos), `regions.ts` (renda média por estado, IBGE), `institutions.ts` (logos e
reconhecimento do banco pelo nome), `learn.ts` (as 16 lições), `money.ts` e `dates.ts` (formatação e datas sem fuso).

## 4. Como os dados andam

**Exemplo: lançar um gasto de R$ 30.**

1. `TxFormPage` monta a linha e chama `useWrite` → `insertTxWithRules`, que aplica as regras automáticas (ex.:
   "arredondar e guardar o troco").
2. O `Backend` grava: no Supabase, o **RLS** confere que o `user_id` é da pessoa logada.
3. `useWrite` invalida as consultas do React Query (chaves `['t', tabela, …]`).
4. `useMonthView` busca de novo e recalcula: resumo, "pode gastar hoje", categorias, caixinhas.
5. A tela inicial, o Mês e os Gráficos se atualizam sozinhos. Em outro aparelho, o **Realtime** do Supabase
   avisa e a mesma invalidação acontece.

**Demonstração × conta:** o `main.tsx` escolhe `localBackend` ou `supabaseBackend` e entrega por um Context.
As telas não sabem qual estão usando. É assim que a demonstração funciona sem servidor.

## 5. Banco de dados (Supabase / Postgres)

- **RLS em todas as tabelas.** Padrão: `using ((select public.owns(user_id)))`. A função `owns` compara com o
  usuário logado; um futuro "modo casal" só precisa mudar essa função.
- **Permissões por coluna:** o app pode alterar só algumas colunas do perfil (`grant update (name, …)`), nunca
  `is_admin`.
- **Gatilhos que garantem regras no servidor:**
  - código do beta no cadastro;
  - `check_refs`: a categoria de um lançamento tem que ser da mesma pessoa;
  - loja do porquinho: só compra com saldo;
  - moedas: não vale data futura.
- **Valores conferidos por `check`:** moedas com valor fixo por tipo, textos com tamanho máximo, cores em hexadecimal.
- **Storage privado:** cada pessoa só acessa a própria pasta de fotos.

## 6. Edge Functions (servidor, Deno)

Todas conferem o login manualmente (`callerUserId`) e usam a chave de serviço só ali dentro.

- **`bank-sync`** (Open Finance via Pluggy):
  1. autentica na Pluggy;
  2. lista as contas do item;
  3. grava saldos e limites;
  4. busca os lançamentos com paginação por cursor;
  5. `mapTransaction` (em `_shared/bankmap.ts`) limpa a descrição ("Pix para Maria"), sugere a categoria e ignora
     pagamento de fatura e transferências internas;
  6. o salário e os fixos já lançados pelo app são **confirmados** (não duplicados);
  7. `reconcileSalary` acerta o histórico quando o salário muda.

  A chave única `(user_id, external_id)` impede lançamento repetido.
- **`ask`** (Gemini):
  1. confere a cota diária (20 perguntas, contadas por uma função no banco);
  2. monta o prompt com o tom da pessoa, a base de lições (gerada de `learn.ts`) e os números já calculados;
  3. tenta o modelo principal e, se falhar, um mais leve;
  4. se tudo falhar, devolve a pergunta para a cota.
- **`setup`** cria a conta de administrador com um código de uso único; **`delete-account`** apaga tudo (LGPD).

## 7. Interface

- **Design system** em `ui.tsx` + cores como variáveis CSS (`index.css`), com tema claro e escuro trocando as variáveis.
- **Mascote** (`Pig.tsx`): escolhe a arte pelo humor, modo e roupa. As artes ficam em `public/mascote/{azul,rosa}`.
- **Guia interativo** (`Tour.tsx`): marca o alvo com `data-tour`, escurece o resto com um `box-shadow` gigante e
  espera a comemoração fechar antes de começar.
- **PWA:** o service worker guarda o app para abrir offline; as consultas ao Supabase ficam em cache (NetworkFirst)
  e as artes do mascote baixam só quando aparecem.

## 8. Testes e publicação

- `npm test`: 154 testes de regra (Vitest), um arquivo `.test.ts` ao lado de cada regra.
- `npm run test:db`: 33 testes contra o Supabase local (Docker), com usuários de verdade. Confere que uma pessoa
  não vê os dados de outra, a conexão com o banco (com uma "Pluggy de mentira"), a IA (com um "Gemini de mentira")
  e a loja de moedas.
- **CI (GitHub Actions):**
  - cada push na `main` roda os testes e publica o app no GitHub Pages;
  - outro workflow aplica as migrations e publica as funções no Supabase quando os secrets existem.

## 9. Dependências que importam

| Pacote | Para quê | Dá para trocar? |
| --- | --- | --- |
| `react`, `react-dom` | A interface. | É a base de tudo. |
| `typescript` | Tipos: pega erro antes de rodar. | Essencial. |
| `vite` | Servidor de desenvolvimento e build. | Essencial (alternativas: webpack, mais lento). |
| `@supabase/supabase-js` | Login, banco, storage, realtime e funções. | Só trocando o back-end inteiro. |
| `@tanstack/react-query` | Cache, recarga e invalidação dos dados. Evita estado global feito à mão. | Essencial para a arquitetura. |
| `react-router` | Rotas. `HashRouter` porque o GitHub Pages não reescreve URLs. | Sim, mas é padrão. |
| `tailwindcss` | Estilos. | Sim, mas mudaria todo o CSS. |
| `recharts` | Gráficos. | Sim (ex.: Chart.js). Usado só na tela de gráficos. |
| `@phosphor-icons/react` | Ícones (duotone). | Sim. |
| `vite-plugin-pwa` | Service worker e instalação. | Essencial para o PWA. |
| `vitest` | Testes. | Sim (Jest), mas o Vitest usa a config do Vite. |
| `supabase` (CLI, dev) | Banco local no Docker, migrations e deploy. | Essencial no fluxo. |
| `@fontsource-variable/*` | Fontes embutidas (funcionam offline). | A Maven Pro é a padrão; as outras estão em teste e podem sair. |
| `lucide-react` | Alguns ícones antigos. | Pode ser removido trocando por Phosphor. |

## 10. Decisões e o porquê

- **Centavos inteiros:** ponto flutuante erra em dinheiro (`0.1 + 0.2 ≠ 0.3`).
- **Regras puras + testes:** a parte que não pode errar fica isolada e testada; as telas mudam sem medo.
- **Demonstração no aparelho:** quem testa vê o app completo sem criar conta e sem servidor.
- **IA só escreve:** modelos de linguagem erram conta. O app calcula e manda o resultado pronto.
- **Pluggy em vez de integrar com cada banco:** o Open Finance exige autorização do Banco Central para quem conecta
  direto; um agregador já tem.
- **PWA antes do app nativo:** um código só, publicado na hora. O app de loja vem depois, empacotando o mesmo código.

## 11. Perguntas que podem aparecer numa entrevista

- **Como você garante que um usuário não vê o dado de outro?** RLS no Postgres em todas as tabelas, com testes de
  integração que tentam ler e gravar com outro usuário.
- **Como evita lançamento duplicado do banco ou do salário?** Chave única `(user_id, external_id)` no banco e ids
  estáveis (SHA-1) para as linhas geradas pelo app.
- **Por que React Query?** Os dados vêm do servidor; o React Query cuida de cache, recarga e invalidação, e o
  Realtime só precisa invalidar.
- **Como o app funciona offline?** Service worker com cache do app e das consultas (NetworkFirst).
- **Como você testa código que depende de serviço externo?** Servidores HTTP de mentira nos testes (Pluggy e
  Gemini) apontados por variável de ambiente.

## 12. O que melhorar (dívida técnica)

- Algumas telas grandes (`YouPage`, `ChartsPage`, `GoalsPages`) poderiam ser divididas em componentes menores.
- Não há testes de componentes de tela (só de regras e de banco) nem ESLint configurado.
- As artes do mascote ainda são provisórias (recortes); a versão final virá em arquivos separados.
- Fontes em teste e `lucide-react` podem sair para diminuir o pacote.
