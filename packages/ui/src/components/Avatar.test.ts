import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Avatar from './Avatar.vue'

describe('avatar', () => {
  it('画像が無いときは、表示名の頭文字（大文字）を表示する', () => {
    const wrapper = mount(Avatar, { props: { name: 'alice' } })
    expect(wrapper.text()).toBe('A')
  })

  it('日本語の表示名でも、最初の 1 文字を表示する', () => {
    expect(mount(Avatar, { props: { name: '山田太郎' } }).text()).toBe('山')
  })

  it('絵文字（2 つのコード単位でできた文字）も、1 文字として切り出す', () => {
    expect(mount(Avatar, { props: { name: '🐱 ねこ' } }).text()).toBe('🐱')
  })

  it('表示名が空なら「?」を表示する', () => {
    expect(mount(Avatar, { props: { name: '   ' } }).text()).toBe('?')
  })

  it('サイズに応じたクラスが付く', () => {
    expect(mount(Avatar, { props: { name: 'a', size: 'lg' } }).classes()).toContain('size-20')
    expect(mount(Avatar, { props: { name: 'a' } }).classes()).toContain('size-10')
  })

  it('画面読み上げ用に、表示名を aria-label として持つ', () => {
    const wrapper = mount(Avatar, { props: { name: 'Alice' } })
    expect(wrapper.find('[aria-label="Alice"]').exists()).toBe(true)
  })
})
