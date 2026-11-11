import { describe, expect, it } from 'vitest'
import { accountTitle, findInstitution } from './institutions'

describe('findInstitution', () => {
  it('reconhece o Nubank pelo nome da conta que vem do Open Finance', () => {
    expect(findInstitution(undefined, 'Nu Pagamentos S.A. - Instituição de Pagamento')?.key).toBe('nubank')
    expect(findInstitution('Nubank')?.name).toBe('Nubank')
  })
  it('prefere o nome da conexão e reconhece outros bancos', () => {
    expect(findInstitution('Neon', 'Nu Pagamentos')?.key).toBe('neon')
    expect(findInstitution('Banco Itaú')?.key).toBe('itau')
    expect(findInstitution('C6 Bank')?.key).toBe('c6')
  })
  it('não inventa banco: palavras parecidas não contam', () => {
    expect(findInstitution('Banco', 'Conta corrente')).toBeNull()
    expect(findInstitution('Nutrição')).toBeNull()
  })
  it('monta um título curto', () => {
    expect(accountTitle(findInstitution('Nubank'), 'CREDIT', 'x')).toBe('Nubank · Cartão')
    expect(accountTitle(null, 'BANK', 'Minha conta')).toBe('Minha conta')
  })
})
