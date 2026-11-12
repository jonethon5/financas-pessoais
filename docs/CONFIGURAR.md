# Como rodar e publicar o Poupei

Guia técnico: rodar no computador, ligar o Supabase de verdade, conectar bancos, ligar a IA e publicar.
A apresentação do projeto está no [README](../README.md) e a explicação do código em [ARQUITETURA.md](ARQUITETURA.md).

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
| `GEMINI_API_KEY` | *(assistente com IA, passo 3)* |

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

### 3. Assistente com IA (Gemini, grátis)

Sem a chave, o assistente funciona do mesmo jeito, mas quem responde é o próprio app (respostas prontas com os números).

1. Entre em <https://aistudio.google.com/apikey> com uma conta Google → **Create API key** (não pede cartão).
2. Cadastre a chave no secret `GEMINI_API_KEY` do GitHub e rode o workflow do Supabase de novo.

Cada pessoa pode fazer 20 perguntas por dia. Vai para o Google só o resumo dos números (totais por categoria e caixinha),
sem nome, e-mail, foto nem a descrição dos lançamentos. O assistente nunca recomenda investimentos.

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

## Publicar

Cada push na `main` roda os testes e publica no GitHub Pages (`.github/workflows/deploy.yml`).
O passo a passo para ligar o Supabase de verdade, os secrets do GitHub, o SMTP grátis para os e-mails e o Gemini
está nas seções acima. O workflow `supabase.yml` já está pronto e não faz nada enquanto os secrets não existirem.

## Gerar as imagens do README

Com o app rodando (`npm run dev`), em outro terminal:

```bash
npm run vitrine
```

O script abre o app num Chrome invisível no tamanho de um celular, passa pelas telas principais da demonstração,
tira os prints e monta `docs/img/telas.png` (mosaico) e `docs/img/demo.gif`. O mosaico e o GIF usam Python com
Pillow (`pip install pillow`). Variáveis opcionais: `APP_URL` e `CHROME_PATH`.

