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
import { PrivacyPage, TermsPage } from './pages/legal/LegalPages'
import { GoalsPage } from './pages/Placeholders'
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
  const { linkEvent, clearLinkEvent } = useAuth()
  const toast = useToast()

  // Voltou de um link do e-mail: avisa o que aconteceu
  useEffect(() => {
    if (linkEvent?.kind === 'confirmed') toast('E-mail confirmado. Bem-vindo!')
    else if (linkEvent?.kind === 'email_changed') toast('E-mail atualizado')
    else return
    clearLinkEvent()
  }, [linkEvent, clearLinkEvent, toast])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="mes" element={<MonthPage />} />
        <Route path="caixinhas" element={<GoalsPage />} />
        <Route path="lancar" element={<TxFormPage />} />
        <Route path="lancamento/:id" element={<TxFormPage />} />
        <Route path="separar" element={<SplitPage />} />
        <Route path="voce/categorias" element={<CategoriesPage />} />
        <Route path="voce/fixos" element={<FixedPage />} />
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
