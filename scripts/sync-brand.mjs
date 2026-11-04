// Gera, a partir do brand.json, os arquivos que levam o nome do app fora do front-end:
//  - supabase/templates/*.html      e-mails do Supabase Auth (confirmação, nova senha, troca de e-mail, convite)
//  - supabase/templates/subjects.json  assuntos dos e-mails (usados pelo workflow do Supabase)
//  - supabase/functions/_shared/brand.ts  nome do app nas Edge Functions
// Roda sozinho antes do dev/build/test. Para trocar o nome do app: edite só o brand.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const brand = JSON.parse(readFileSync(new URL('brand.json', root), 'utf8'))
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Os links usam token_hash: funcionam mesmo abrindo o e-mail em outro aparelho.
const emails = {
  confirmation: {
    subject: `Confirme seu e-mail no ${brand.name}`,
    title: 'Confirme seu e-mail',
    text: `Falta só um passo para começar a usar o ${brand.name}. Toque no botão para confirmar seu e-mail.`,
    button: 'Confirmar e-mail',
    type: 'email',
  },
  recovery: {
    subject: `Criar uma nova senha no ${brand.name}`,
    title: 'Criar uma nova senha',
    text: 'Recebemos um pedido para trocar a senha da sua conta. Toque no botão para criar uma nova. O link vale por 1 hora.',
    button: 'Criar nova senha',
    type: 'recovery',
  },
  email_change: {
    subject: `Confirme seu novo e-mail no ${brand.name}`,
    title: 'Confirme seu novo e-mail',
    text: 'Toque no botão para confirmar que este passa a ser o e-mail da sua conta: {{ .NewEmail }}',
    button: 'Confirmar novo e-mail',
    type: 'email_change',
  },
  invite: {
    subject: `Seu convite para o ${brand.name}`,
    title: `Você foi convidado para o ${brand.name}`,
    text: `Você recebeu um convite para testar o ${brand.name} (beta). Toque no botão para criar sua senha e começar.`,
    button: 'Aceitar convite',
    type: 'invite',
  },
}

const page = ({ title, text, button, type }) => `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#F6F7F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F2433">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F9;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:20px;padding:32px 28px">
<tr><td style="font-size:15px;font-weight:700;color:#0B7F5A;padding-bottom:20px">${esc(brand.name)}</td></tr>
<tr><td style="font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;padding-bottom:12px">${esc(title)}</td></tr>
<tr><td style="font-size:16px;line-height:1.5;color:#3E4C59;padding-bottom:24px">${esc(text).replace('{{ .NewEmail }}', '<strong>{{ .NewEmail }}</strong>')}</td></tr>
<tr><td><a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&amp;type=${type}" style="display:inline-block;background:#0B7F5A;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:16px;padding:14px 24px;border-radius:14px">${esc(button)}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#5B6B7A;padding-top:24px">Se você não pediu isso, pode ignorar este e-mail. Ninguém da equipe vai pedir sua senha.</td></tr>
</table>
<p style="font-size:12px;color:#8A94A0;margin:16px 0 0">${esc(brand.name)} · versão beta</p>
</td></tr>
</table>
</body>
</html>
`

const templates = new URL('supabase/templates/', root)
mkdirSync(templates, { recursive: true })
const subjects = {}
for (const [name, email] of Object.entries(emails)) {
  writeFileSync(new URL(`${name}.html`, templates), page(email))
  subjects[name] = email.subject
}
writeFileSync(new URL('subjects.json', templates), JSON.stringify(subjects, null, 2) + '\n')

writeFileSync(
  new URL('supabase/functions/_shared/brand.ts', root),
  `// Gerado por scripts/sync-brand.mjs a partir do brand.json. Não edite à mão.\nexport const APP_NAME = ${JSON.stringify(brand.name)}\n`,
)

// Os assuntos no config.toml (Supabase local) também acompanham o nome
const configUrl = new URL('supabase/config.toml', root)
let config = readFileSync(configUrl, 'utf8')
for (const [name, subject] of Object.entries(subjects)) {
  config = config.replace(new RegExp(`(\\[auth\\.email\\.template\\.${name}\\]\\nsubject = )"[^"]*"`), `$1${JSON.stringify(subject)}`)
}
writeFileSync(configUrl, config)
