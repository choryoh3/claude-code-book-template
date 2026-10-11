import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Button from './Button.vue'

describe('button', () => {
  it('スロットの内容を表示し、既定では type="button"（フォームを勝手に送信しない）', () => {
    const wrapper = mount(Button, { slots: { default: '投稿する' } })
    expect(wrapper.text()).toBe('投稿する')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('バリアントに応じた見た目のクラスが付く', () => {
    expect(mount(Button).classes()).toContain('bg-accent')
    expect(mount(Button, { props: { variant: 'danger' } }).classes()).toContain('bg-red-600')
    expect(mount(Button, { props: { size: 'lg' } }).classes()).toContain('h-12')
  })

  it('外から渡した class で、同じ種類のクラスを上書きできる', () => {
    const wrapper = mount(Button, { attrs: { class: 'px-8' } })
    expect(wrapper.classes()).toContain('px-8')
    expect(wrapper.classes()).not.toContain('px-5') // 既定の px-5 は置き換えられる
  })

  it('class 以外の属性（aria-label など）は、そのまま button に渡る', () => {
    const wrapper = mount(Button, { attrs: { 'aria-label': '閉じる', 'data-testid': 'close' } })
    expect(wrapper.attributes('aria-label')).toBe('閉じる')
    expect(wrapper.attributes('data-testid')).toBe('close')
  })

  it('loading のあいだは操作できず、「処理中」のスピナーが出る（二重送信の防止）', () => {
    const wrapper = mount(Button, { props: { loading: true }, slots: { default: '送信' } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[role="status"]').attributes('aria-label')).toBe('処理中')
  })

  it('disabled のときはクリックしても click が発生しない', async () => {
    const wrapper = mount(Button, { props: { disabled: true } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('loading でなければスピナーは出ない', () => {
    expect(mount(Button).find('[role="status"]').exists()).toBe(false)
  })
})
