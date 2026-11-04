import { describe, expect, it } from 'vitest'
import { parseAuthLink } from './authLink'

const base = 'https://jonethon5.github.io/financas-pessoais/'

describe('parseAuthLink', () => {
  it('lê o link de nova senha', () => {
    expect(parseAuthLink(`${base}?token_hash=abc123&type=recovery`)).toEqual({ tokenHash: 'abc123', type: 'recovery' })
  })
  it('lê o link mesmo dentro do # (rotas do app)', () => {
    expect(parseAuthLink(`${base}#/?token_hash=xyz&type=email`)).toEqual({ tokenHash: 'xyz', type: 'email' })
  })
  it('devolve o erro quando o Supabase manda um', () => {
    expect(parseAuthLink(`${base}?error=access_denied&error_description=Email+link+is+invalid+or+has+expired`)).toEqual({
      error: 'Email link is invalid or has expired',
    })
  })
  it('ignora URLs sem link ou com tipo desconhecido', () => {
    expect(parseAuthLink(`${base}#/voce`)).toBeNull()
    expect(parseAuthLink(`${base}?token_hash=abc&type=hack`)).toBeNull()
  })
})
