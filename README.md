# Poupei (beta)

App de finanças pessoais (PWA) em português: saber **quanto dá para gastar hoje**, controlar rendas e gastos
(fixos, do dia a dia e parcelados), montar orçamento por categoria e guardar dinheiro em **caixinhas** (metas),
com dicas de um assistente de IA. Valores em reais, sempre calculados em centavos.

> ⚠️ Este repositório é **público**. Nunca coloque aqui senhas, o arquivo `.env`, planilhas ou valores reais.
> Os dados de cada pessoa ficam só no Supabase, protegidos por Row Level Security (RLS).

O nome do app fica num lugar só: [`brand.json`](brand.json). Trocou lá, trocou no app, nos e-mails e no ícone de instalação.

## Etapas

- [x] 0. Fundação: visual, PWA, modo demonstração, cadastro com código do beta, confirmação de e-mail, esqueci a senha,
      perfil com foto, excluir conta, termos e privacidade, sugestões, painel do beta, deploy
- [x] 1. Base: salário e fixos automáticos, gastos do dia a dia e parcelados, lançamento em 2 toques, "quanto posso gastar hoje",
      separar o salário, orçamento por categoria (mensal e semanal, cobrir com outra categoria), 50/30/20, caçador de assinaturas
- [x] 2. Caixinhas: modelos prontos, meta por data, por valor mensal ou sem valor final, foto ou ícone, depósitos e retiradas
      com freio, recálculo automático, marcos 25/50/75/100% com comemoração, prioridade e sobra do mês
- [x] 3. Psicologia: primeiro acesso com perguntas e teste de perfil, horas de trabalho e "isso equivale a…", sequências,
      dias sem gastar, desafios, regras automáticas, lista de desejos (30 dias), planos "se… então", recomeço,
      projeção do ano, revisão da semana e retrospectiva do mês em stories
- [ ] 4. Gráficos
- [ ] 5. Gamificação
- [ ] 6. Assistente (IA)
- [ ] 7. Importar/exportar e avisos
- [ ] 8. Beta: revisão geral e passo a passo completo

## Modo demonstração

Enquanto o Supabase não estiver configurado, o site publicado abre em **modo demonstração**: dados de exemplo
guardados só no próprio aparelho. Com o Supabase ligado, a tela de entrada também tem "Ver demonstração sem conta".

## Ligar de verdade (Supabase + conexão com o banco)

Enquanto isso não for feito, o site publicado fica em modo demonstração. Tudo grátis, sem cartão.

### 1. Supabase (banco, login e funções)

1. Crie uma conta em <https://supabase.com> → **New project** → nome `poupei`, região **South America (São Paulo)**.
   Anote a **senha do banco**.
2. **Project Settings → API Keys:** copie a **Project URL** e a chave **anon / publishable**.
3. <https://supabase.com/dashboard/account/tokens> → **Generate new token** (permissões: Project Settings RW, API Keys R,
   API Key Secrets R, Migrations RW, Database R, Database Config R, Connection Pooling R, Edge Functions RW,
   Edge Function Secrets RW, Auth Config RW).
4. No GitHub do projeto: **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | chave anon / publishable |
| `SUPABASE_ACCESS_TOKEN` | o token do passo 3 |
| `SUPABASE_DB_PASSWORD` | a senha do banco |
| `SETUP_CODE` | invente um código (ex.: `poupei-2026-xyz`): ele cria a conta de administrador |
| `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | *(conexão com o banco, passo 2)* |

5. **Actions → Supabase (banco, funções e login) → Run workflow**, depois **Actions → Deploy no GitHub Pages → Run workflow**.
6. Abra o app → **Configure a conta de administrador** → digite o `SETUP_CODE`, seu nome, e-mail e senha.

### 2. Conexão com o banco (Open Finance, só leitura)

Usa o **Meu Pluggy** (grátis para uso pessoal, até 5 conexões; os dados do banco atualizam 1 vez por dia).
No beta, só a conta de administrador usa, porque as chaves do Meu Pluggy são pessoais.

1. Em <https://meu.pluggy.ai>, crie a conta e conecte o **Nubank** (conta e cartão) e os outros bancos. A autorização é
   feita no app do banco e vale 1 ano.
2. Em <https://dashboard.pluggy.ai> (mesma conta): crie uma **Application** e anote o **Client ID**; gere o
   **Client Secret** (aparece uma vez só). Em **Customization → Connectors**, deixe o **MeuPluggy** ligado.
3. Na aplicação → **Demo → Connect Account → MeuPluggy**, entre com a conta do Meu Pluggy. Cada banco vira um *item*:
   em **Connected Items**, menu ⋯ → **Copiar Item ID**.
4. Cadastre `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` nos secrets do GitHub e rode o workflow do Supabase de novo.
5. No app: **Você → Bancos conectados → Conectar banco** → cole o Item ID. Na primeira vez ele busca os últimos 90 dias.

O que o app faz com os dados: saída da conta e compra no cartão viram gasto (com categoria sugerida pela descrição);
entrada vira renda; o salário e as contas fixas que o app já lançou são **confirmados**, não duplicados; pagamento de
fatura, caixinhas do banco e transferências entre as suas contas são ignorados; compra parcelada vira "3/10". Corrigiu
a categoria de um lançamento que veio do banco? O app aprende e acerta os próximos parecidos.

## Desenvolvimento

Precisa do Node.js 22+ (e do Docker para o banco local).

```bash
npm install
npm run dev        # http://localhost:5180/financas-pessoais/  (sem .env.local = modo demonstração)
npm test           # testes das regras de dinheiro e datas (Vitest)
npm run build
```

Banco local (Supabase no Docker, portas 553xx para não brigar com outros projetos):

```bash
npm run db:start                                         # sobe banco, login, storage e e-mail de teste
echo "SETUP_CODE=configurar-local" > supabase/functions/.env
npm run test:db                                          # testes de segurança (RLS) com usuários de verdade
# .env.local: VITE_SUPABASE_URL=http://127.0.0.1:55321 e VITE_SUPABASE_ANON_KEY=<ANON_KEY do "npx supabase status">
```

Os e-mails do banco local (confirmação, nova senha) chegam em <http://127.0.0.1:55324>. O código do beta local é
`TESTE-LOCAL` (só existe no banco local, vem do `supabase/seed.sql`).

## Segurança

- RLS em **todas** as tabelas: cada pessoa só lê e grava os próprios dados (testado em `tests/db/rls.test.ts`).
- Cadastro exige **código de acesso do beta**, validado no próprio banco (gatilho), não só na tela.
- Fotos e prints em armazenamento **privado**; cada pessoa só acessa a própria pasta.
- A chave `service_role` só existe dentro das Edge Functions, nunca no app. Nenhum segredo no repositório.
- **Excluir conta** apaga login, perfil, lançamentos, fotos e sugestões na hora (LGPD e Play Store).
- O painel do beta mostra só números gerais e sugestões; o administrador **não** vê as finanças dos testadores.

## Publicar

Cada push na `main` roda os testes e publica no GitHub Pages (`.github/workflows/deploy.yml`).
O passo a passo para ligar o Supabase de verdade, os secrets do GitHub, o SMTP grátis para os e-mails e o Gemini
fica na etapa 8. O workflow `supabase.yml` já está pronto e não faz nada enquanto os secrets não existirem.

## Estrutura

```
brand.json        nome e textos do app (um lugar só)
src/
  pages/          telas (Início, Mês, Caixinhas, Você, entrar/criar conta, termos…)
  components/     barra de abas com "+", folhas que sobem de baixo, listas estilo Ajustes, recorte de foto
  data/           acesso a dados: supabaseBackend (conta) e localBackend (demonstração)
  lib/            regras puras com testes: dinheiro em centavos, datas, parcelas, orçamento do mês, "quanto posso gastar hoje"
supabase/
  migrations/     banco (tabelas, RLS, storage)
  functions/      Edge Functions: setup (administrador do beta), delete-account (excluir conta)
  templates/      e-mails em português (gerados do brand.json por scripts/sync-brand.mjs)
tests/db/         testes de integração contra o Supabase local
```
