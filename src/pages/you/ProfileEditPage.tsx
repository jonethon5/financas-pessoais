import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ProfileAvatar } from '../../components/Avatar'
import { PhotoCropper } from '../../components/PhotoCropper'
import { useToast } from '../../components/Toast'
import { Button, ErrorBox, Field, NavBar, NavButton, Spinner } from '../../components/ui'
import { useProfile, useSetAvatar, useUpdateProfile } from '../../data/hooks'
import { isValidISODate, todayISO } from '../../lib/dates'
import { friendlyError } from '../../lib/supabase'
import type { Profile } from '../../types'

export function ProfileEditPage() {
  const profile = useProfile()
  if (profile.isPending) return <Spinner />
  if (profile.isError) return <ErrorBox message={friendlyError(profile.error)} onRetry={() => profile.refetch()} />
  return <ProfileForm profile={profile.data} />
}

function ProfileForm({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const toast = useToast()
  const update = useUpdateProfile()
  const setAvatar = useSetAvatar()
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile.name)
  const [nickname, setNickname] = useState(profile.nickname ?? '')
  const [birthday, setBirthday] = useState(profile.birthday ?? '')
  const [errors, setErrors] = useState<{ name?: string; birthday?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<File | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!name.trim()) errs.name = 'Digite seu nome.'
    if (birthday && (!isValidISODate(birthday) || birthday > todayISO())) errs.birthday = 'Data inválida.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      await update.mutateAsync({ name: name.trim(), nickname: nickname.trim() || null, birthday: birthday || null })
      toast('Perfil salvo')
      navigate('/voce')
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  async function changePhoto(image: Blob | null) {
    setPicked(null)
    try {
      await setAvatar.mutateAsync(image)
      toast(image ? 'Foto atualizada' : 'Foto removida')
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <>
      <NavBar
        title="Editar perfil"
        large={false}
        left={<NavButton onClick={() => navigate('/voce')}>Cancelar</NavButton>}
        right={
          <NavButton type="submit" form="perfil" strong disabled={update.isPending}>
            Salvar
          </NavButton>
        }
      />
      <form id="perfil" onSubmit={onSubmit} noValidate className="flex flex-col gap-5 pt-4">
        <div className="flex flex-col items-center gap-3">
          <button type="button" onClick={() => fileInput.current?.click()} className="relative rounded-full transition active:scale-[0.98]" aria-label="Alterar foto">
            <ProfileAvatar profile={profile} size="xl" />
            {setAvatar.isPending && <span className="absolute inset-0 grid place-items-center rounded-full bg-surface/70 text-[0.8125rem] font-medium">Enviando…</span>}
          </button>
          <div className="flex gap-2">
            <Button variant="soft" size="sm" onClick={() => fileInput.current?.click()} disabled={setAvatar.isPending}>
              {profile.avatar_path ? 'Trocar foto' : 'Adicionar foto'}
            </Button>
            {profile.avatar_path && (
              <Button variant="secondary" size="sm" onClick={() => changePhoto(null)} disabled={setAvatar.isPending}>
                Remover
              </Button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              e.target.value = ''
              if (file) setPicked(file)
            }}
          />
        </div>

        {error && <ErrorBox message={error} />}
        <Field label="Nome" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={60} />
        <Field label="Como quer ser chamado" placeholder="ex.: Ana" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} hint="Aparece na tela inicial e nas mensagens do app." />
        <Field
          label="Data de nascimento (opcional)"
          type="date"
          value={birthday}
          max={todayISO()}
          onChange={(e) => setBirthday(e.target.value)}
          error={errors.birthday}
          hint="No seu aniversário o app manda uma mensagem de recomeço."
        />
      </form>

      <PhotoCropper file={picked} onCancel={() => setPicked(null)} onDone={(image) => changePhoto(image)} />
    </>
  )
}
