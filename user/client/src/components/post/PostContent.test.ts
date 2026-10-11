// 投稿本文の表示のテスト（リンク化と、余計な空白が入らないこと）。

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createTestRouter } from '@/test/fixtures'
import PostContent from './PostContent'

function render(content: string) {
  return mount(PostContent, { props: { content }, global: { plugins: [createTestRouter()] } })
}

describe('postContent', () => {
  it('本文の文字を、前後に余計な空白を足さずにそのまま表示する（改行も保つ）', () => {
    const wrapper = render('こんにちは #vue と @alice\n2行目')
    expect(wrapper.text()).toBe('こんにちは #vue と @alice\n2行目')
  })

  it('ハッシュタグは検索、メンションはプロフィール、URL は新しいタブで開くリンクになる', () => {
    const wrapper = render('#Vue @alice https://example.com')
    const links = wrapper.findAll('a')

    expect(links[0]?.attributes('href')).toBe('/search?q=%23vue')
    expect(links[1]?.attributes('href')).toBe('/alice')
    expect(links[2]?.attributes()).toMatchObject({
      href: 'https://example.com',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
  })

  it('本文の HTML は実行されず、文字として出る', () => {
    const wrapper = render('<img src=x onerror=alert(1)>')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('<img src=x onerror=alert(1)>')
  })
})
