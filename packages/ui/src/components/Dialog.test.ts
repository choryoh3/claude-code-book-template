import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import Dialog from './Dialog.vue'

// Dialog の中身は <body> 直下（ポータル）に出るので、wrapper ではなく document から探す
const mounted: ReturnType<typeof mount>[] = []
interface DialogTestProps {
  title: string
  open?: boolean
  description?: string
  showClose?: boolean
}

function mountDialog(props: DialogTestProps, slots: Record<string, string> = {}) {
  const wrapper = mount(Dialog, { props, slots, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('dialog', () => {
  it('open が true のとき、見出し・説明・中身が表示される', async () => {
    mountDialog(
      { open: true, title: '通報する', description: '理由を選んでください' },
      { default: '<p>本文</p>' },
    )
    await nextTick()

    expect(document.body.textContent).toContain('通報する')
    expect(document.body.textContent).toContain('理由を選んでください')
    expect(document.body.textContent).toContain('本文')
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('open が false のときは何も表示されない', async () => {
    mountDialog({ open: false, title: '通報する' })
    await nextTick()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('見出しが role="dialog" の名前になる（画面読み上げのため）', async () => {
    mountDialog({ open: true, title: 'プロフィールを編集', description: '説明' })
    await nextTick()
    const dialog = document.querySelector('[role="dialog"]')
    const labelledBy = dialog?.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy ?? '')?.textContent).toBe('プロフィールを編集')
  })

  it('× ボタンで閉じる（update:open に false が通知される）', async () => {
    const wrapper = mountDialog({ open: true, title: 'タイトル', description: '説明' })
    await nextTick()
    const close = document.querySelector<HTMLButtonElement>('button[aria-label="閉じる"]')
    expect(close).not.toBeNull()
    close?.click()
    await nextTick()
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('showClose が false なら × ボタンは出ない', async () => {
    mountDialog({ open: true, title: 'タイトル', description: '説明', showClose: false })
    await nextTick()
    expect(document.querySelector('button[aria-label="閉じる"]')).toBeNull()
  })

  it('footer スロットを渡したときだけ、フッターが表示される', async () => {
    mountDialog(
      { open: true, title: 'タイトル', description: '説明' },
      { footer: '<button>送信</button>' },
    )
    await nextTick()
    expect(document.body.textContent).toContain('送信')
  })
})
