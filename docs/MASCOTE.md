# Mascote: artes, recorte e poses novas

O Poupinho (azul) e a Poupinha (rosa) vêm de três folhas de arte. Cada pose é recortada, ganha fundo transparente e vira um `.webp` em `public/mascote/{azul,rosa}/`. A versão rosa sai da azul por troca de cor (e o contrário, para as roupas que vieram só na rosa).

## Como o recorte funciona

`scripts/mascote.py recortar <imagem> <nome>` faz, nesta ordem:

1. **Fundo:** inunda a partir da borda tudo que é claro e sem cor forte. Isso pega o fundo, o degradê dos cartões e a **sombra cinza do chão**. Essa sombra aparecia como uma mancha branca no modo escuro. O contorno escuro do porquinho segura a inundação, então o branco dos olhos e do logo do moletom fica.
2. **Borda sem halo:** nos 2 px da borda, a transparência sai da distância até a cor do fundo. A cor é "descontaminada", ou seja, o fundo claro que vazou no anti-aliasing é tirado. Assim não sobra contorno branco ou colorido em fundo escuro.
3. **Pedaços soltos:** fica a maior parte. Pedaços pequenos e os que encostam na borda do recorte somem: pedaços de texto, de etiqueta, do cartão vizinho.
4. **Cor:** a rosa é feita a partir da azul só onde a cor é do porco (matiz azul). Moeda, roupa e acessórios ficam iguais.

Depois de trocar artes, suba `ART_VERSION` em `src/components/Pig.tsx`. O app guarda as artes por 90 dias, então sem isso quem já usa continuaria vendo as antigas.

## Abertura

A abertura é uma cena de 3 s. O porquinho entra pensando e uma moeda cai girando no cofrinho da cabeça. Ele amassa com o impacto e faz "uau", com olhos de estrela. Moedas saltam, ele pula e termina feliz. Ela usa três rostos (`abertura-pensa`, `abertura-uau`, `abertura-feliz`) alinhados pela moeda, para a troca de pose não "pular".

`python scripts/mascote.py abertura` refaz os três a partir de `rosto-pensativo`, `rosto-animado` e `rosto-feliz`. O comando imprime onde a moeda ficou; esses valores vão em `--cx`, `--cy` e `--coin` do `.splash-stage` (`src/index.css`).

## 20 poses novas (para gerar)

Poses novas precisam ser desenhadas no mesmo estilo. Isso eu (Claude) não consigo fazer sem um gerador de imagem, porque montar a partir das artes atuais deixa costura. O caminho:

1. Na mesma ferramenta em que as folhas originais foram feitas, **anexe a imagem do porquinho principal** como referência.
2. Cole o **estilo fixo** abaixo e depois o pedido de **uma pose por imagem**.
3. Salve cada imagem com o nome da pose e rode `python scripts/mascote.py recortar arquivo.png <nome>`.

**Estilo fixo (colar sempre):**

> Same character as the reference image: a chubby blue piggy-bank pig mascot. It has a gold coin with a "$" sign sticking out of the slot on top of its head, a dark navy hoodie with a small white piggy-bank logo on the chest, and pink blush on the cheeks. Thick dark outline, soft cel shading, friendly cartoon style, same proportions and colors as the reference. Full body, centered, one character only. Plain pure white background, no floor shadow, no text, no frame, no extra objects unless described. Square image, at least 1024 px.

| # | Nome do arquivo | Pose (pedido) | Onde usar |
| --- | --- | --- | --- |
| 1 | `acenando` | Waving hello with one hand, big smile, slight head tilt | Boas-vindas, primeiro acesso |
| 2 | `pulando` | Jumping with joy, both arms up, feet off the ground, eyes closed happy | Fim da abertura, meta batida |
| 3 | `guardando-moeda` | Holding a gold coin above its own head about to drop it into the slot, excited | Abertura, "guardou na caixinha" |
| 4 | `apontando-direita` | Pointing to the right with one arm extended, looking at the viewer, confident smile | Banners, dicas que apontam para um botão |
| 5 | `apontando-cima` | Pointing up with one finger, eyebrows raised like "look at this" | Destaque do valor no topo da tela |
| 6 | `piscando-joinha` | Winking and giving a thumbs up | Confirmação: "gasto lançado" |
| 7 | `confete` | Celebrating with confetti falling around, arms open | Caixinha concluída |
| 8 | `trofeu` | Holding a small gold trophy over its head, proud | Conquistas, sequência de dias |
| 9 | `dormindo` | Sleeping sitting down, eyes closed, a small "z" bubble | Dia sem gastos, noite |
| 10 | `lupa` | Looking through a big magnifying glass, curious | Busca sem resultado, achar o banco |
| 11 | `extrato` | Reading a long paper receipt that rolls to the floor, focused | Extrato vazio, importar |
| 12 | `calculadora` | Typing on a big calculator, tongue out concentrating | Orçamento, resumo do mês |
| 13 | `saco-de-moedas` | Hugging a big sack of gold coins, delighted | Salário caiu |
| 14 | `celular` | Looking at a smartphone in its hands, a notification bubble on the screen | Pedir permissão de avisos |
| 15 | `cadeado` | Holding a big shield with a padlock, calm and trustworthy | Segurança, Open Finance |
| 16 | `suando` | Nervous, sweat drop, holding a bill with a calendar behind | Conta perto de vencer |
| 17 | `meditando` | Meditating cross-legged, eyes closed, peaceful | Modo suave, "respira antes de comprar" |
| 18 | `correndo` | Running forward carrying a coin, determined | Ritmo da meta |
| 19 | `calendario` | Holding a monthly calendar with one day circled | Contas a pagar |
| 20 | `sentado-moedas` | Sitting relaxed on top of a pile of gold coins, legs dangling, smug | Banners de marketing, Premium |

Dica: peça 2 ou 3 variações de cada e escolha a que mais parece o original (rosto, orelhas e moeda iguais). Imagem com sombra no chão ou fundo colorido também recorta, mas o fundo branco liso dá a borda mais limpa.
