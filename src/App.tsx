import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { useToast } from './components/Toast'
import { Spinner } from './components/ui'
import { ForgotPage } from './pages/auth/ForgotPage'
import { LoginPage } from './pages/auth/LoginPage'
import { NewPasswordPage } from './pages/auth/NewPasswordPage'
import { SetupAdminPage } from './pages/auth/SetupAdminPage'
import { SignUpPage } from './pages/auth/SignUpPage'
import { HomePage } from './pages/HomePage'
import { OnboardingPage } from './pages/OnboardingPage'
import { HabitsPage } from './pages/HabitsPage'
import { LearnPage, LessonPage } from './pages/LearnPages'
import { HealthPage } from './pages/HealthPage'
import { AssistantPage } from './pages/AssistantPage'
import { BanksPage } from './pages/you/BanksPage'
import { StoriesPage } from './pages/StoriesPage'
import { useProfile } from './data/hooks'
import { PrivacyPage, TermsPage } from './pages/legal/LegalPages'
import { GoalDetailPage, GoalFormPage, GoalsPage } from './pages/goals/GoalsPages'
import { MonthPage } from './pages/MonthPage'
import { SplitPage } from './pages/SplitPage'
import { TxFormPage } from './pages/TxFormPage'
import { CategoriesPage, FixedPage } from './pages/you/MoneySettingsPages'
import { DeleteAccountPage, EmailPage, PasswordPage } from './pages/you/AccountPages'
import { AdminPage } from './pages/you/AdminPage'
import { FeedbackPage } from './pages/you/FeedbackPage'
import { ProfileEditPage } from './pages/you/ProfileEditPage'
import { YouPage } from './pages/you/YouPage'

function LoggedOut() {
  return (
    <Routes>
      <Route path="/entrar" element={<LoginPage />} />
      <Route path="/criar-conta" element={<SignUpPage />} />
      <Route path="/esqueci" element={<ForgotPage />} />
      <Route path="/configurar" element={<SetupAdminPage />} />
      <Route path="/termos" element={<TermsPage />} />
      <Route path="/privacidade" element={<PrivacyPage />} />
      <Route path="*" element={<Navigate to="/entrar" replace />} />
    </Routes>
  )
}

function LoggedIn() {
  const { linkEvent, clearLinkEvent, mode } = useAuth()
  const toast = useToast()
  const profile = useProfile()

  // Voltou de um link do e-mail: avisa o que aconteceu
  useEffect(() => {
    if (linkEvent?.kind === 'confirmed') toast('E-mail confirmado. Bem-vindo!')
    else if (linkEvent?.kind === 'email_changed') toast('E-mail atualizado')
    else return
    clearLinkEvent()
  }, [linkEvent, clearLinkEvent, toast])

  // Primeiro acesso: perguntas, teste de perfil, salário, fixos e primeira caixinha
  if (mode === 'supabase' && profile.data && !profile.data.onboarded_at) return <OnboardingPage />

  return (
    <Routes>
      <Route path="boas-vindas" element={<OnboardingPage />} />
      <Route path="revisao" element={<StoriesPage kind="semana" />} />
      <Route path="retrospectiva" element={<StoriesPage kind="mes" />} />
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="mes" element={<MonthPage />} />
        <Route path="caixinhas" element={<GoalsPage />} />
        <Route path="caixinhas/nova" element={<GoalFormPage />} />
        <Route path="caixinhas/:id" element={<GoalDetailPage />} />
        <Route path="caixinhas/:id/editar" element={<GoalFormPage />} />
        <Route path="lancar" element={<TxFormPage />} />
        <Route path="lancamento/:id" element={<TxFormPage />} />
        <Route path="separar" element={<SplitPage />} />
        <Route path="habitos" element={<HabitsPage />} />
        <Route path="aprender" element={<LearnPage />} />
        <Route path="saude" element={<HealthPage />} />
        <Route path="assistente" element={<AssistantPage />} />
        <Route path="aprender/:id" element={<LessonPage />} />
        <Route path="voce/categorias" element={<CategoriesPage />} />
        <Route path="voce/fixos" element={<FixedPage />} />
        <Route path="voce/bancos" element={<BanksPage />} />
        <Route path="voce" element={<YouPage />} />
        <Route path="voce/perfil" element={<ProfileEditPage />} />
        <Route path="voce/senha" element={<PasswordPage />} />
        <Route path="voce/email" element={<EmailPage />} />
        <Route path="voce/excluir" element={<DeleteAccountPage />} />
        <Route path="voce/sugestao" element={<FeedbackPage />} />
        <Route path="voce/beta" element={<AdminPage />} />
        <Route path="termos" element={<TermsPage />} />
        <Route path="privacidade" element={<PrivacyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  const { mode, session, loading, mustSetPassword } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (mode === 'supabase' && !session) return <LoggedOut />
  if (mustSetPassword) return <NewPasswordPage />
  return <LoggedIn />
}
