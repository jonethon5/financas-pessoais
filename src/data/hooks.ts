import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Bucket, FeedbackStatus, ProfilePatch } from '../types'
import { useBackend, type FeedbackInput, type NewBetaCode } from './backend'

export const keys = {
  profile: ['profile'] as const,
  myFeedback: ['feedback', 'mine'] as const,
  file: (bucket: Bucket, path: string) => ['file', bucket, path] as const,
  admin: ['admin'] as const,
}

export function useProfile() {
  const backend = useBackend()
  return useQuery({ queryKey: keys.profile, queryFn: () => backend.getProfile(), staleTime: 5 * 60_000 })
}

export function useUpdateProfile() {
  const backend = useBackend()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: ProfilePatch) => backend.updateProfile(patch),
    onSuccess: (profile) => qc.setQueryData(keys.profile, profile),
  })
}

export function useSetAvatar() {
  const backend = useBackend()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (image: Blob | null) => backend.setAvatar(image),
    onSuccess: (profile) => qc.setQueryData(keys.profile, profile),
  })
}

/** Endereço temporário (1 hora) de um arquivo privado; renovado antes de expirar. */
export function useFileUrl(bucket: Bucket, path: string | null | undefined) {
  const backend = useBackend()
  return useQuery({
    queryKey: keys.file(bucket, path ?? ''),
    queryFn: () => backend.fileUrl(bucket, path!),
    enabled: Boolean(path),
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
  })
}

export function useMyFeedback() {
  const backend = useBackend()
  return useQuery({ queryKey: keys.myFeedback, queryFn: () => backend.listMyFeedback() })
}

export function useSendFeedback() {
  const backend = useBackend()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FeedbackInput) => backend.sendFeedback(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  })
}

// ---------------------------------------------------------------------------
// Painel do beta (administrador)
// ---------------------------------------------------------------------------

export function useAdminStats() {
  const backend = useBackend()
  return useQuery({ queryKey: [...keys.admin, 'stats'], queryFn: () => backend.admin.stats() })
}

export function useAdminFeedback() {
  const backend = useBackend()
  return useQuery({ queryKey: [...keys.admin, 'feedback'], queryFn: () => backend.admin.feedback() })
}

export function useBetaCodes() {
  const backend = useBackend()
  return useQuery({ queryKey: [...keys.admin, 'codes'], queryFn: () => backend.admin.codes() })
}

export function useBetaRequired() {
  const backend = useBackend()
  return useQuery({ queryKey: [...keys.admin, 'required'], queryFn: () => backend.admin.betaRequired() })
}

/** Ações do painel: todas recarregam o painel depois. */
export function useAdminActions() {
  const backend = useBackend()
  const qc = useQueryClient()
  const onSuccess = () => qc.invalidateQueries({ queryKey: keys.admin })
  return {
    setFeedbackStatus: useMutation({ mutationFn: (v: { id: string; status: FeedbackStatus }) => backend.admin.setFeedbackStatus(v.id, v.status), onSuccess }),
    createCode: useMutation({ mutationFn: (v: NewBetaCode) => backend.admin.createCode(v), onSuccess }),
    setCodeActive: useMutation({ mutationFn: (v: { code: string; active: boolean }) => backend.admin.setCodeActive(v.code, v.active), onSuccess }),
    deleteCode: useMutation({ mutationFn: (code: string) => backend.admin.deleteCode(code), onSuccess }),
    setBetaRequired: useMutation({ mutationFn: (required: boolean) => backend.admin.setBetaRequired(required), onSuccess }),
  }
}
