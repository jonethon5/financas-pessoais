import { useFileUrl } from '../data/hooks'
import type { Profile } from '../types'

export function displayName(p: Pick<Profile, 'name' | 'nickname'> | null | undefined): string {
  return p?.nickname?.trim() || p?.name?.trim().split(/\s+/)[0] || ''
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const SIZES = {
  sm: 'size-8 text-[0.8125rem]',
  md: 'size-11 text-[1rem]',
  lg: 'size-16 text-[1.375rem]',
  xl: 'size-24 text-[2rem]',
}

/** Foto do perfil (ou as iniciais em verde sobre cinza, como nos apps do iPhone). */
export function ProfileAvatar({ profile, size = 'md', preview }: { profile: Pick<Profile, 'name' | 'avatar_path'> | null | undefined; size?: keyof typeof SIZES; preview?: string | null }) {
  const url = useFileUrl('fotos', preview ? null : profile?.avatar_path)
  const src = preview ?? url.data
  if (src) return <img src={src} alt="" className={`shrink-0 rounded-full bg-surface-2 object-cover ${SIZES[size]}`} />
  const text = initials(profile?.name ?? '')
  return (
    <span aria-hidden className={`inline-grid shrink-0 place-items-center rounded-full bg-[#e6ebef] font-semibold text-primary-strong ${SIZES[size]}`}>
      {text || <svg viewBox="0 0 24 24" className="size-1/2 fill-current opacity-70"><circle cx="12" cy="8" r="4.2" /><path d="M4 20.5c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5" /></svg>}
    </span>
  )
}
