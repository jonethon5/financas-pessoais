// Gera as imagens do README: abre o app num Chrome invisível (headless), no tamanho de um celular,
// passa pelas telas principais da demonstração e tira os prints. Depois monta o mosaico e o GIF.
//
// Uso:  npm run dev   (em outro terminal)   e   npm run vitrine
// Variáveis opcionais: APP_URL (padrão http://localhost:5180/financas-pessoais/), CHROME_PATH.
// O mosaico e o GIF usam Python com Pillow (pip install pillow); sem ele, ficam só os prints.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const APP = process.env.APP_URL ?? 'http://localhost:5180/financas-pessoais/'
const outDir = join(tmpdir(), 'poupei-vitrine')
mkdirSync(outDir, { recursive: true })

const CHROME =
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((p) => existsSync(p))
if (!CHROME) {
  console.error('Não achei o Chrome. Informe o caminho em CHROME_PATH.')
  process.exit(1)
}

/** Roteiro: as telas que aparecem no README. */
async function vitrine({ go, click, shot, js, wait }) {
  await go(APP, 9000)
  await click('Ver demonstração sem conta', 4000)
  await shot('01-boas-vindas')
  await click('Pular por agora', 3000)
  // Sem o guia interativo na frente dos prints
  await js(`for (const k of ['inicio','graficos','mes','caixinhas']) localStorage.setItem('poupei:guia:'+k,'1'); location.hash = '#/'; location.reload()`)
  await wait(6000)
  await shot('02-inicio')
  await click('Lançar', 1000)
  await shot('03-lancar')
  await click('Fechar', 600)
  const page = async (hash, name, ms = 3500) => {
    await go(`${APP}#${hash}`, ms)
    await js('window.scrollTo(0, 0)')
    await wait(400)
    await shot(name)
  }
  await page('/graficos', '04-graficos')
  await page('/caixinhas', '05-caixinhas')
  await go(`${APP}#/porquinho`, 3500)
  await js(`[...document.querySelectorAll('h2')].find(h => h.textContent.includes('Lojinha')).scrollIntoView({block:'start'}); window.scrollBy(0,-70)`)
  await wait(800)
  await shot('06-lojinha')
  await page('/voce/bancos', '07-bancos')
  await go(`${APP}#/assistente`, 3000)
  await click('Plano de corte', 1500)
  await js('window.scrollTo(0, document.body.scrollHeight)')
  await wait(700)
  await shot('08-assistente')
  await page('/aprender/rotativo', '09-aprender', 3000)
  await page('/saude', '10-saude', 3000)
}

const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'vitrine-'))
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--lang=pt-BR', 'about:blank'])

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 50; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    if (targets.some((t) => t.type === 'page')) break
  } catch {
    /* ainda abrindo */
  }
  await sleep(200)
}
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let seq = 0
const pending = new Map()
const problems = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve: ok, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else ok(msg.result)
  } else if (msg.method === 'Runtime.exceptionThrown') {
    problems.push(`EXCEÇÃO: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`)
  } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    problems.push(`console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300)}`)
  }
}
const send = (method, params = {}) =>
  new Promise((ok, reject) => {
    const id = ++seq
    pending.set(id, { resolve: ok, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })

const W = 390
const H = 844
await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true })

const api = {
  wait: sleep,
  async go(url, ms = 1500) {
    await send('Page.navigate', { url })
    await sleep(ms)
  },
  async js(expression) {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  },
  /** Clica no primeiro botão/link cujo texto (ou aria-label) contém `label`. */
  async click(label, ms = 600) {
    await api.js(`(() => {
      let want = ${JSON.stringify(label)}
      let root = document
      if (want.startsWith('dialog:')) { want = want.slice(7); root = document.querySelector('dialog[open]') }
      const els = [...root.querySelectorAll('button, a, [role=switch], [role=radio], label, summary')]
      const el = els.find((e) => e.getAttribute('aria-label') === want) ?? els.find((e) => e.textContent.trim() === want) ?? els.find((e) => e.textContent.trim().startsWith(want)) ?? els.find((e) => (e.getAttribute('aria-label') ?? '').includes(want)) ?? els.find((e) => e.textContent.includes(want))
      if (!el) throw new Error('Não achei: ' + want)
      el.click()
    })()`)
    await sleep(ms)
  },
  /** Preenche o campo pelo texto do rótulo (label). */
  async fill(label, value) {
    await api.js(`(() => {
      const want = ${JSON.stringify(label)}
      const lab = [...document.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith(want))
      const el = lab ? document.getElementById(lab.htmlFor) ?? lab.querySelector('input,textarea') : document.querySelector(want)
      if (!el) throw new Error('Campo não encontrado: ' + want)
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)})
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })()`)
  },
  async text() {
    return api.js('document.body.innerText')
  },
  /** Print da tela (full: a página inteira, rolando). */
  async shot(name, full = false) {
    let restore = false
    if (full) {
      const h = await api.js('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)')
      if (h > H) {
        await send('Emulation.setDeviceMetricsOverride', { width: W, height: h, deviceScaleFactor: 2, mobile: true })
        await sleep(300)
        restore = true
      }
    }
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(outDir, `${name}.png`), Buffer.from(data, 'base64'))
    if (restore) await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true })
  },
}

try {
  await vitrine(api)
} catch (err) {
  problems.push(`ROTEIRO FALHOU: ${err.message}`)
} finally {
  console.log(problems.length ? problems.join('\n') : 'sem erros no console')
  ws.close()
  chrome.kill()
}

// Mosaico e GIF (Python + Pillow)
const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['scripts/vitrine-gif.py', outDir, 'docs/img'], { stdio: 'inherit' })
if (py.status !== 0) console.log(`Prints em ${outDir}. Para o mosaico e o GIF: pip install pillow e rode de novo.`)
