import { describe, expect, it } from 'vitest'
import { merchantOf } from './merchants'

describe('empresa do lançamento', () => {
  it('reconhece pelo texto do banco, com ou sem acento e símbolos', () => {
    expect(merchantOf('UBER *TRIP HELP.UBER.COM')?.key).toBe('uber')
    expect(merchantOf('IFOOD *RESTAURANTE')?.key).toBe('ifood')
    expect(merchantOf('Rappi Brasil')?.key).toBe('rappi')
    expect(merchantOf('LOJAS RENNER S.A.')?.key).toBe('renner')
    expect(merchantOf('Pão de Açúcar 123')?.key).toBe('paodeacucar')
    expect(merchantOf('Transferência enviada pelo Pix|MERCADO LIVRE')?.key).toBe('mercadolivre')
    expect(merchantOf('NETFLIX.COM')?.key).toBe('netflix')
    expect(merchantOf('99 TECNOLOGIA LTDA')?.key).toBe('99')
  })
  it('não inventa empresa', () => {
    expect(merchantOf('Transferência enviada pelo Pix|MARIA SOUZA')).toBeNull()
    expect(merchantOf('Padaria do bairro')).toBeNull()
    expect(merchantOf('Compra 99,90')).toBeNull()
    expect(merchantOf('Timóteo Silva')).toBeNull()
    expect(merchantOf('')).toBeNull()
  })
})
