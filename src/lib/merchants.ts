/**
 * Empresas conhecidas: pelo texto do lançamento ("UBER *TRIP", "IFOOD *RESTAURANTE"…) mostra o logo da empresa.
 * O logo vem do serviço de ícones do DuckDuckGo (só recebe o site da empresa, nunca dados da pessoa).
 * Quando não reconhece, a tela usa o ícone da categoria.
 */
export type Merchant = { key: string; name: string; domain: string }

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// [chave, nome, site, palavras (no texto já sem acento e em minúsculas; "\b" = palavra inteira)]
const LIST: [string, string, string, string][] = [
  ['uber', 'Uber', 'uber.com', '\\buber\\b|uber trip|ubr pending'],
  ['99', '99', '99app.com', '\\b99 ?app\\b|\\b99 ?pop\\b|\\b99 ?food\\b|99 tecnologia|\\b99 ?taxi'],
  ['ifood', 'iFood', 'ifood.com.br', '\\bifood\\b|\\bifd\\b'],
  ['rappi', 'Rappi', 'rappi.com.br', '\\brappi\\b'],
  ['ze', 'Zé Delivery', 'zedelivery.com.br', 'ze delivery|zedelivery'],
  ['aiqfome', 'aiqfome', 'aiqfome.com', '\\baiqfome\\b'],
  ['mercadolivre', 'Mercado Livre', 'mercadolivre.com.br', 'mercado ?livre|\\bmeli\\b'],
  ['mercadopago', 'Mercado Pago', 'mercadopago.com.br', 'mercado ?pago'],
  ['amazon', 'Amazon', 'amazon.com.br', '\\bamazon\\b|\\bamzn\\b|prime video|amazon prime'],
  ['shopee', 'Shopee', 'shopee.com.br', '\\bshopee\\b'],
  ['shein', 'Shein', 'shein.com', '\\bshein\\b'],
  ['aliexpress', 'AliExpress', 'aliexpress.com', '\\baliexpress\\b|\\balipay\\b'],
  ['temu', 'Temu', 'temu.com', '\\btemu\\b'],
  ['magalu', 'Magalu', 'magazineluiza.com.br', 'magazine ?luiza|\\bmagalu\\b'],
  ['americanas', 'Americanas', 'americanas.com.br', '\\bamericanas\\b'],
  ['casasbahia', 'Casas Bahia', 'casasbahia.com.br', 'casas ?bahia'],
  ['kabum', 'KaBuM!', 'kabum.com.br', '\\bkabum\\b'],
  ['netflix', 'Netflix', 'netflix.com', '\\bnetflix\\b'],
  ['spotify', 'Spotify', 'spotify.com', '\\bspotify\\b'],
  ['youtube', 'YouTube', 'youtube.com', '\\byoutube\\b'],
  ['disney', 'Disney+', 'disneyplus.com', 'disney ?plus|\\bdisney\\b'],
  ['hbo', 'Max', 'max.com', '\\bhbo\\b|hbo ?max|\\bmax com\\b'],
  ['globoplay', 'Globoplay', 'globoplay.globo.com', '\\bgloboplay\\b'],
  ['apple', 'Apple', 'apple.com', '\\bapple\\b|apple com bill|\\bitunes\\b'],
  ['google', 'Google', 'google.com', '\\bgoogle\\b'],
  ['microsoft', 'Microsoft', 'microsoft.com', '\\bmicrosoft\\b|\\bxbox\\b'],
  ['playstation', 'PlayStation', 'playstation.com', '\\bplaystation\\b|\\bpsn\\b|sony interactive'],
  ['steam', 'Steam', 'steampowered.com', '\\bsteam\\b|steampowered'],
  ['renner', 'Renner', 'lojasrenner.com.br', '\\brenner\\b'],
  ['riachuelo', 'Riachuelo', 'riachuelo.com.br', '\\briachuelo\\b'],
  ['cea', 'C&A', 'cea.com.br', '\\bc ?a modas\\b|\\bc e a\\b|\\bcea\\b'],
  ['zara', 'Zara', 'zara.com', '\\bzara\\b'],
  ['nike', 'Nike', 'nike.com.br', '\\bnike\\b'],
  ['centauro', 'Centauro', 'centauro.com.br', '\\bcentauro\\b'],
  ['netshoes', 'Netshoes', 'netshoes.com.br', '\\bnetshoes\\b'],
  ['carrefour', 'Carrefour', 'carrefour.com.br', '\\bcarrefour\\b'],
  ['assai', 'Assaí', 'assai.com.br', '\\bassai\\b'],
  ['atacadao', 'Atacadão', 'atacadao.com.br', '\\batacadao\\b'],
  ['paodeacucar', 'Pão de Açúcar', 'paodeacucar.com', 'pao de acucar'],
  ['oxxo', 'Oxxo', 'oxxo.com', '\\boxxo\\b'],
  ['drogaraia', 'Droga Raia', 'drogaraia.com.br', 'droga ?raia|\\braia\\b'],
  ['drogasil', 'Drogasil', 'drogasil.com.br', '\\bdrogasil\\b'],
  ['paguemenos', 'Pague Menos', 'paguemenos.com.br', 'pague ?menos'],
  ['smartfit', 'Smart Fit', 'smartfit.com.br', 'smart ?fit'],
  ['vivo', 'Vivo', 'vivo.com.br', '\\bvivo\\b|telefonica'],
  ['claro', 'Claro', 'claro.com.br', '\\bclaro\\b'],
  ['tim', 'TIM', 'tim.com.br', '\\btim celular\\b|\\btim s a\\b|\\btim brasil\\b'],
  ['enel', 'Enel', 'enel.com.br', '\\benel\\b'],
  ['sabesp', 'Sabesp', 'sabesp.com.br', '\\bsabesp\\b'],
  ['cemig', 'Cemig', 'cemig.com.br', '\\bcemig\\b'],
  ['copel', 'Copel', 'copel.com', '\\bcopel\\b'],
  ['shell', 'Shell', 'shell.com.br', '\\bshell\\b'],
  ['ipiranga', 'Ipiranga', 'ipiranga.com.br', '\\bipiranga\\b'],
  ['mcdonalds', "McDonald's", 'mcdonalds.com.br', 'mc ?donald|\\bmcdonalds\\b'],
  ['burgerking', 'Burger King', 'burgerking.com.br', 'burger ?king|\\bbk brasil\\b'],
  ['subway', 'Subway', 'subway.com', '\\bsubway\\b'],
  ['starbucks', 'Starbucks', 'starbucks.com.br', '\\bstarbucks\\b'],
  ['outback', 'Outback', 'outback.com.br', '\\boutback\\b'],
  ['kfc', 'KFC', 'kfc.com.br', '\\bkfc\\b'],
  ['habibs', "Habib's", 'habibs.com.br', '\\bhabib'],
  ['bobs', "Bob's", 'bobs.com.br', '\\bbobs\\b'],
  ['cinemark', 'Cinemark', 'cinemark.com.br', '\\bcinemark\\b'],
  ['ingresso', 'Ingresso.com', 'ingresso.com', 'ingresso ?com'],
  ['sympla', 'Sympla', 'sympla.com.br', '\\bsympla\\b'],
  ['airbnb', 'Airbnb', 'airbnb.com.br', '\\bairbnb\\b'],
  ['booking', 'Booking', 'booking.com', '\\bbooking\\b'],
  ['latam', 'LATAM', 'latamairlines.com', '\\blatam\\b'],
  ['gol', 'GOL', 'voegol.com.br', '\\bgol linhas\\b|\\bvoegol\\b'],
  ['azul', 'Azul', 'voeazul.com.br', '\\bazul linhas\\b|\\bvoeazul\\b'],
  ['decolar', 'Decolar', 'decolar.com', '\\bdecolar\\b'],
  ['buser', 'Buser', 'buser.com.br', '\\bbuser\\b'],
  ['clickbus', 'ClickBus', 'clickbus.com.br', '\\bclickbus\\b'],
  ['picpay', 'PicPay', 'picpay.com', '\\bpicpay\\b'],
  ['paypal', 'PayPal', 'paypal.com', '\\bpaypal\\b'],
  ['hotmart', 'Hotmart', 'hotmart.com', '\\bhotmart\\b'],
  ['udemy', 'Udemy', 'udemy.com', '\\budemy\\b'],
  ['alura', 'Alura', 'alura.com.br', '\\balura\\b'],
  ['duolingo', 'Duolingo', 'duolingo.com', '\\bduolingo\\b'],
  ['openai', 'ChatGPT', 'openai.com', '\\bopenai\\b|\\bchatgpt\\b'],
  ['canva', 'Canva', 'canva.com', '\\bcanva\\b'],
  ['adobe', 'Adobe', 'adobe.com', '\\badobe\\b'],
  ['leroy', 'Leroy Merlin', 'leroymerlin.com.br', 'leroy ?merlin'],
  ['havan', 'Havan', 'havan.com.br', '\\bhavan\\b'],
  ['boticario', 'O Boticário', 'boticario.com.br', '\\bboticario\\b'],
  ['natura', 'Natura', 'natura.com.br', '\\bnatura cosmeticos\\b|\\bnatura\\b'],
  ['sephora', 'Sephora', 'sephora.com.br', '\\bsephora\\b'],
  ['cacaushow', 'Cacau Show', 'cacaushow.com.br', 'cacau ?show'],
  ['petz', 'Petz', 'petz.com.br', '\\bpetz\\b'],
  ['cobasi', 'Cobasi', 'cobasi.com.br', '\\bcobasi\\b'],
  ['correios', 'Correios', 'correios.com.br', '\\bcorreios\\b'],
  ['semparar', 'Sem Parar', 'semparar.com.br', 'sem ?parar'],
]

const MERCHANTS = LIST.map(([key, name, domain, words]) => ({ key, name, domain, re: new RegExp(words) }))

/** A empresa do lançamento, pelo texto (ou null). */
export function merchantOf(description: string | null | undefined): Merchant | null {
  if (!description) return null
  const text = plain(description)
  const hit = MERCHANTS.find((m) => m.re.test(text))
  return hit ? { key: hit.key, name: hit.name, domain: hit.domain } : null
}

export const merchantLogo = (m: Merchant) => `https://icons.duckduckgo.com/ip3/${m.domain}.ico`
