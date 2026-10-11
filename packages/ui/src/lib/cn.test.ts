import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('条件付きのクラスを書ける（false・undefined は無視される）', () => {
    expect(cn('a', true && 'b', false && 'c', undefined, null)).toBe('a b')
  })

  it('競合する Tailwind のクラスは、後から渡したほうで上書きする', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('競合しないクラスはそのまま残す', () => {
    expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold')
  })
})
