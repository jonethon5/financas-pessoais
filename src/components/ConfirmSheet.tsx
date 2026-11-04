import type { ReactNode } from 'react'
import { Sheet } from './Sheet'
import { Button } from './ui'

/** Pergunta de confirmação que sobe de baixo (como a folha de ações do iPhone). */
export function ConfirmSheet({
  open,
  title,
  children,
  confirmLabel,
  destructive,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {children && <div className="mb-5 text-center text-[1rem] leading-snug text-muted">{children}</div>}
      <div className="flex flex-col gap-2.5">
        <Button variant={destructive ? 'danger-fill' : 'primary'} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Sheet>
  )
}
