# Conexão com o banco (Open Finance): como funciona hoje

Diagnóstico de 13/11/2026, feito com os dados reais de uma conta conectada (Nubank e Neon), contando só quantidades e nomes de campos.

## Provedor e caminho dos dados

- **Provedor:** [Pluggy](https://pluggy.ai), pelo **Meu Pluggy** (uso pessoal, gratuito, até 5 conexões, sem uso comercial).
- **Caminho:** banco → Open Finance → Meu Pluggy (atualiza **1 vez a cada 24 h**) → Pluggy avisa o app (webhook `item/updated`) → função `bank-webhook` → `bank-sync` grava no Supabase → o app atualiza na hora (Realtime).
- Cada banco autorizado no Meu Pluggy vira um **item** separado, com o seu próprio Item ID.

## Endpoints usados

| Endpoint | Para quê |
|---|---|
| `POST /auth` | chave de acesso (vale 2 h, guardada em memória) |
| `GET /items/{id}` | confere se a conexão está pronta (status, erro de autorização) |
| `GET /accounts?itemId=` | contas e cartões: saldo, limite, fatura, vencimento, dinheiro guardado automático, cheque especial |
| `GET /v2/transactions?accountId=&dateFrom=` | lançamentos (paginação por cursor) |
| `GET /identity?itemId=` | nome do titular (para reconhecer Pix entre contas da própria pessoa) |
| `GET /investments?itemId=` | caixinhas, CDB, poupança e outros investimentos |
| `POST /webhooks` | registra o aviso `item/updated` (no deploy, `scripts/pluggy-webhook.mjs`) |

## Quando os dados chegam

| Momento | O que acontece |
|---|---|
| Meu Pluggy termina de atualizar (1x/dia) | a Pluggy avisa a função `bank-webhook`, que busca na hora |
| Pessoa abre o app | se a última leitura tem mais de 6 h, busca de novo |
| Botão "Atualizar agora" | busca na hora (intervalo mínimo de 15 min entre leituras) |

**Limite real:** o Meu Pluggy não deixa forçar a atualização no banco (o item "não pode ser atualizado manualmente"). Uma movimentação feita agora no banco aparece **depois da próxima atualização diária do Meu Pluggy**. Para atualizar mais vezes (a cada 8 ou 12 h, ou sob demanda), é preciso o plano de produção da Pluggy (contrato pago, Open Finance é recurso "Premium").

## O que dá para obter (testado)

| Informação | Disponível? | Onde aparece no app |
|---|---|---|
| Saldo da conta corrente | Sim | Contas e cartões |
| Dinheiro guardado automático (ex.: Nubank) | Sim (`bankData.automaticallyInvestedBalance`) | cartão da conta |
| Caixinhas, CDB, poupança | Sim (`/investments`) | "Guardado" |
| Movimentações de caixinha (resgate/aplicação) | Sim (`RESGATE_APLIC_FINANCEIRA`) | extrato, em "Não contam" |
| Fatura atual, limite e limite livre do cartão | Sim (`creditData`) | cartão do cartão de crédito |
| Compras no cartão, inclusive parceladas | Sim | extrato |
| Cheque especial contratado e usado | Campo existe (`overdraftContractedLimit`, `overdraftUsedLimit`); depende do banco | cartão da conta e resumo |
| Empréstimos e financiamentos | Endpoint existe (`/loans`); a conta testada não tinha nenhum | ainda não mostrado |
| CPF de quem pagou e de quem recebeu o Pix | Sim (`paymentData`) | usado para achar transferência entre contas próprias |
| Horário da compra | Não (só a data) | — |

## Regras de fidelidade do extrato

- Nada do que o banco manda é descartado. Pagamento de fatura, resgate e aplicação de caixinha, estorno e Pix entre contas próprias aparecem no extrato, marcados como **"não conta"** (com o motivo), para o extrato bater com o do banco sem contar duas vezes.
- A **descrição** é a do banco, sem alteração (ex.: `Transferência enviada pelo Pix|MARIA SOUZA`). Na tela, quem recebeu vira o título e o tipo da operação vai embaixo, como no app do banco. A pessoa pode editar depois.
- **Pendentes** com data até hoje entram (compra no cartão que ainda não fechou). Quando o banco relança a mesma compra com outro id, o app reconhece (mesmo tipo, valor e até 5 dias) e não duplica; o que o banco desfaz sai do app (com trava de segurança para não apagar em massa).
- Renda do mês = salário do cadastro + o que a pessoa lança ou marca como renda. Entrada no banco não vira renda sozinha.

## Webhooks

- **Antes:** não havia; o app só buscava ao abrir (a cada 6 h) ou no botão.
- **Agora:** aviso `item/updated` registrado no deploy, apontando para `bank-webhook?chave=…` (chave derivada do segredo da Pluggy).
- **Duplicidade:** o id que vem do banco é único por pessoa (`unique (user_id, external_id)`), então o mesmo aviso repetido não duplica nada.
- **Falha:** se o aviso falhar, o app ainda busca ao abrir e no botão. A Pluggy reenvia avisos que falham.

## Custos para melhorar a velocidade

| Opção | Atualização | Custo (referência, confirmar com a Pluggy) |
|---|---|---|
| Meu Pluggy (hoje) | 1x/dia, sem forçar | R$ 0 |
| Pluggy produção | 8 a 24 h automática + atualização sob demanda | piso de cerca de R$ 2.500/mês |
| Revendas por conexão | parecido com produção | cerca de R$ 5 a R$ 10 por conta conectada/mês |

## Próximos passos sugeridos

1. Mostrar empréstimos (`/loans`) quando alguém tiver um.
2. Guardar o CPF/CNPJ da contraparte **cifrado** para a regra de categoria por pessoa ficar mais precisa que o nome.
3. Na versão comercial, trocar o Meu Pluggy pelo Connect da Pluggy (cada pessoa conecta o próprio banco dentro do app).
