// Monta a configuração do login do Supabase (usada pelo workflow supabase.yml via Management API):
// endereço do site, senha mínima, e-mails em português e, se houver, o SMTP próprio.
// Sem SMTP o Supabase só envia e-mail para a equipe do projeto, então a confirmação de e-mail fica desligada.
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const brand = JSON.parse(read('brand.json'))
const subjects = JSON.parse(read('supabase/templates/subjects.json'))
const template = (name) => read(`supabase/templates/${name}.html`)
const env = process.env
const site = env.SITE_URL
if (!site) throw new Error('Falta SITE_URL')

const smtp = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_SENDER)

const config = {
  site_url: site,
  uri_allow_list: site,
  disable_signup: false,
  external_email_enabled: true,
  password_min_length: 8,
  mailer_autoconfirm: !smtp,
  mailer_secure_email_change_enabled: true,
  mailer_subjects_confirmation: subjects.confirmation,
  mailer_templates_confirmation_content: template('confirmation'),
  mailer_subjects_recovery: subjects.recovery,
  mailer_templates_recovery_content: template('recovery'),
  mailer_subjects_email_change: subjects.email_change,
  mailer_templates_email_change_content: template('email_change'),
  mailer_subjects_invite: subjects.invite,
  mailer_templates_invite_content: template('invite'),
}

if (smtp) {
  Object.assign(config, {
    smtp_host: env.SMTP_HOST,
    smtp_port: env.SMTP_PORT || '587',
    smtp_user: env.SMTP_USER,
    smtp_pass: env.SMTP_PASS,
    smtp_admin_email: env.SMTP_SENDER,
    smtp_sender_name: brand.name,
    rate_limit_email_sent: 30,
  })
}

process.stdout.write(JSON.stringify(config))
console.error(smtp ? 'SMTP próprio configurado: confirmação de e-mail LIGADA.' : 'Sem SMTP: confirmação de e-mail DESLIGADA (beta).')
