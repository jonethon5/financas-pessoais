import { describe, expect, it } from 'vitest'
import { ALL_BANKS, accountTitle, findInstitution, searchBanks } from './institutions'

describe('findInstitution', () => {
  it('reconhece o Nubank pelo nome da conta que vem do Open Finance', () => {
    expect(findInstitution(undefined, 'Nu Pagamentos S.A. - Instituição de Pagamento')?.key).toBe('nubank')
    expect(findInstitution('Nubank')?.name).toBe('Nubank')
  })
  it('o primeiro nome que der certo ganha (a conta antes da conexão) e reconhece outros bancos', () => {
    expect(findInstitution('Neon', 'Nu Pagamentos')?.key).toBe('neon')
    // uma conexão do Meu Pluggy chamada "Nubank" pode trazer também a conta do Neon
    expect(findInstitution('Neon Pagamentos S.A.', 'Nubank')?.key).toBe('neon')
    expect(findInstitution('Conta corrente', 'Nubank')?.key).toBe('nubank')
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

describe('lista de bancos do Open Finance', () => {
  it('tem os bancos mais usados, sem repetir, cada um com logo', () => {
    const names = ALL_BANKS.map((b) => b.name)
    for (const n of ['Nubank', 'Neon', 'Inter', 'Itaú', 'PicPay', 'Mercado Pago', 'C6 Bank']) expect(names).toContain(n)
    expect(new Set(ALL_BANKS.map((b) => b.key)).size).toBe(ALL_BANKS.length)
    expect(ALL_BANKS.length).toBeGreaterThan(60)
    expect(ALL_BANKS.every((b) => b.logo.startsWith('https://'))).toBe(true)
  })
  it('busca sem acento e por qualquer parte do nome; o que começa com o texto vem primeiro', () => {
    expect(searchBanks('neo')[0].name).toBe('Neon')
    expect(searchBanks('ITAU').some((b) => b.key === 'itau')).toBe(true)
    expect(searchBanks('zzzz')).toEqual([])
    expect(searchBanks('  ')).toBe(ALL_BANKS)
  })
})
