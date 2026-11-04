import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { APP_NAME, CONTACT_EMAIL } from '../../brand'
import { BackButton, NavBar } from '../../components/ui'

const UPDATED = '4 de novembro de 2026'

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto w-full max-w-[30rem] px-4 pb-12">
      <NavBar title={title} large={false} left={<BackButton onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} />} />
      <article className="pt-3 text-[1rem] leading-relaxed [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:text-[1.125rem] [&_h2]:font-bold [&_li]:mt-1 [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">{title}</h1>
        <p className="text-[0.875rem] text-muted">Última atualização: {UPDATED}</p>
        {children}
      </article>
    </div>
  )
}

function Contact() {
  return (
    <>
      pelo botão <strong>Você › Enviar sugestão ou relatar problema</strong>
      {CONTACT_EMAIL ? (
        <>
          {' '}ou pelo e-mail <strong>{CONTACT_EMAIL}</strong>
        </>
      ) : null}
    </>
  )
}

export function TermsPage() {
  return (
    <LegalPage title="Termos de uso">
      <p>
        Estes termos valem para o uso do {APP_NAME}, um app para organizar finanças pessoais: registrar rendas e gastos, montar orçamento,
        acompanhar caixinhas (metas) e receber dicas. Ao criar uma conta, você concorda com eles.
      </p>

      <h2>1. Versão de teste (beta)</h2>
      <p>
        O {APP_NAME} está em teste fechado e é gratuito durante o beta. Funções podem mudar, ser retiradas ou apresentar erros. Se o beta
        terminar, avisaremos no app com antecedência e você poderá exportar seus dados.
      </p>

      <h2>2. O app não movimenta dinheiro</h2>
      <p>
        O {APP_NAME} só registra e calcula. As caixinhas são um controle: o dinheiro continua no seu banco. O app não acessa sua conta
        bancária, não faz pagamentos e não guarda dados de cartão.
      </p>

      <h2>3. Não é consultoria financeira</h2>
      <p>
        As dicas (inclusive as do assistente) tratam de orçamento e hábitos de consumo. Não são recomendação de investimento, crédito,
        seguro ou consultoria financeira. As decisões sobre o seu dinheiro são suas. Confira os valores importantes: durante o beta pode
        haver erros de cálculo.
      </p>

      <h2>4. Sua conta</h2>
      <ul>
        <li>Para usar o app você precisa ter 18 anos ou mais.</li>
        <li>Informe um e-mail que seja seu e guarde sua senha com cuidado; não compartilhe o acesso.</li>
        <li>Você é responsável pelas informações que lança no app.</li>
      </ul>

      <h2>5. Uso adequado</h2>
      <p>Não é permitido tentar acessar dados de outras pessoas, burlar a segurança, sobrecarregar o serviço ou usar o app para algo ilegal.</p>

      <h2>6. Excluir a conta</h2>
      <p>
        Você pode excluir a conta quando quiser em <strong>Você › Excluir conta</strong>. Seus dados são apagados na hora, como explica a
        Política de privacidade.
      </p>

      <h2>7. Responsabilidade</h2>
      <p>
        Durante o beta, o app é oferecido como está. Faremos o possível para mantê-lo funcionando e seguro, mas não garantimos que estará
        sempre disponível ou livre de falhas. Nada nestes termos limita os direitos que você tem pelo Código de Defesa do Consumidor.
      </p>

      <h2>8. Mudanças e lei aplicável</h2>
      <p>
        Se estes termos mudarem, avisaremos no app. Valem as leis do Brasil, e você pode usar o foro da sua cidade para qualquer questão.
      </p>

      <h2>9. Contato</h2>
      <p>
        Dúvidas: <Contact />.
      </p>
    </LegalPage>
  )
}

export function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade">
      <p>
        Esta política explica quais dados o {APP_NAME} usa, para quê e como você controla isso, de acordo com a Lei Geral de Proteção de
        Dados (LGPD, Lei 13.709/2018).
      </p>

      <h2>1. Quem cuida dos seus dados</h2>
      <p>
        O {APP_NAME} é desenvolvido por uma pessoa física, responsável (controladora) pelos dados durante o beta. Fale com ela <Contact />.
      </p>

      <h2>2. Quais dados usamos</h2>
      <ul>
        <li><strong>Conta:</strong> nome, e-mail e senha (a senha é guardada criptografada; ninguém consegue lê-la).</li>
        <li><strong>Perfil:</strong> apelido, foto, data de nascimento, dia do pagamento, salário e preferências, se você informar.</li>
        <li><strong>Seus lançamentos:</strong> rendas, gastos, categorias, orçamentos, caixinhas e o que você registrar no app.</li>
        <li><strong>Sugestões:</strong> as mensagens e imagens que você enviar, com a versão do app e o modelo do aparelho.</li>
        <li><strong>Notificações:</strong> se você ativar, o endereço técnico do navegador para entregar os avisos.</li>
      </ul>
      <p>O app não pede CPF, dados bancários, senha de banco nem cartão.</p>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Fazer o app funcionar: cálculos, metas, avisos e o seu histórico (execução do serviço que você pediu).</li>
        <li>Melhorar o app durante o beta, a partir das sugestões e problemas relatados (legítimo interesse).</li>
        <li>Enviar notificações e usar o assistente de IA, somente se você ligar essas funções (consentimento).</li>
        <li>Manter a segurança da conta, como confirmar o e-mail e trocar a senha.</li>
      </ul>
      <p>Não vendemos seus dados, não usamos para propaganda e não compartilhamos com anunciantes.</p>

      <h2>4. Onde os dados ficam</h2>
      <p>
        Os dados ficam no Supabase, serviço de banco de dados e login em nuvem, com conexão criptografada (HTTPS). Cada conta só enxerga os
        próprios dados: essa regra é aplicada no próprio banco, não só na tela. Fotos e imagens ficam em armazenamento privado. O site do
        app é hospedado no GitHub Pages, e os e-mails de confirmação e de nova senha são enviados por um provedor de e-mail.
      </p>

      <h2>5. Assistente de IA</h2>
      <p>
        Quando você usa o assistente, o app manda para o Google Gemini só um resumo dos números necessários para a resposta (totais,
        categorias e metas), sem seu nome, e-mail ou foto. No plano gratuito do Gemini, o Google pode usar esse conteúdo para melhorar os
        produtos dele. Se preferir, simplesmente não use o assistente.
      </p>

      <h2>6. Seus direitos</h2>
      <ul>
        <li>Ver e corrigir seus dados a qualquer momento no próprio app.</li>
        <li>Exportar seus lançamentos para planilha.</li>
        <li>Desligar notificações e deixar de usar o assistente quando quiser.</li>
        <li>Excluir a conta em <strong>Você › Excluir conta</strong>: login, perfil, lançamentos, caixinhas, fotos e sugestões são apagados na hora.</li>
        <li>Pedir informações sobre o uso dos seus dados <Contact />.</li>
      </ul>

      <h2>7. Por quanto tempo</h2>
      <p>
        Enquanto a conta existir. Depois da exclusão, só podem restar cópias de segurança automáticas do provedor, que expiram sozinhas em
        poucos dias.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Usamos senha criptografada, conexão segura, regras de acesso no banco e armazenamento privado. Nenhum sistema é 100% à prova de
        falhas; se acontecer um incidente que possa afetar você, avisaremos.
      </p>

      <h2>9. Menores de idade</h2>
      <p>O app é destinado a maiores de 18 anos.</p>

      <h2>10. Mudanças</h2>
      <p>Se esta política mudar, avisaremos no app antes de a mudança valer.</p>
    </LegalPage>
  )
}
