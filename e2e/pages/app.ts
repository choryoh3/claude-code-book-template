// Page Object: 画面の操作をまとめたクラス（skill: e2e-playwright）。
// テスト側にはセレクタを書かず、「登録する」「投稿する」のような操作の名前だけで書けるようにする。
// セレクタは、利用者から見える名前（役割・ラベル）を優先する（CSS のクラスには依存しない）。

import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** 左のナビの未読バッジの名前（例「未読 2 件」） */
const UNREAD_BADGE_LABEL = /^未読 \d+ 件$/
/** フォロー済みのボタンの名前（「フォロー中」） */
// ⚠ X と同じく、マウスを乗せると「フォロー解除」に変わる。クリックした直後はマウスがボタンの上にあるので、
//   どちらの表示でも「フォロー済み」とみなす（実際に 1 度これで失敗した。docs/troubleshooting.md）
const FOLLOWING_LABEL = /^(?:フォロー中|フォロー解除)$/

export interface TestAccount {
  displayName: string
  handle: string
  email: string
  password: string
}

/** 実行のたびに別のアカウントになる（同じ DB で何度テストしても重複しない） */
export function newAccount(prefix: string): TestAccount {
  const suffix = `${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 36).toString(36)}`
  const handle = `${prefix}${suffix}`.slice(0, 15)
  return {
    displayName: `${prefix} E2E`,
    handle,
    email: `${handle}@example.com`,
    password: 'Password123',
  }
}

/** 登録画面（U-02） */
export class SignupPage {
  constructor(private readonly page: Page) {}

  async signUp(account: TestAccount) {
    await this.page.goto('/signup')
    await this.page.getByLabel('表示名').fill(account.displayName)
    await this.page.locator('input[autocomplete="username"]').fill(account.handle)
    await this.page.locator('input[autocomplete="email"]').fill(account.email)
    await this.page.locator('input[autocomplete="new-password"]').fill(account.password)
    await this.page.getByRole('button', { name: '登録する' }).click()
    // 登録できたらホーム（タイムライン）に移動する（登録はパスワードのハッシュ化があるので、待ち時間を長めにする）
    await expect(this.page.getByRole('textbox', { name: '投稿の本文' })).toBeVisible({
      timeout: 30_000,
    })
  }
}

/** ホーム（U-03）と、どの画面にもある左のナビ（U-12） */
export class HomePage {
  constructor(private readonly page: Page) {}

  private get composer(): Locator {
    return this.page.getByRole('textbox', { name: '投稿の本文' })
  }

  async post(text: string) {
    await this.composer.fill(text)
    // 「ポストする」は左のナビにもあるので、投稿フォームの中のボタンを押す
    await this.page
      .locator('form')
      .filter({ has: this.composer })
      .getByRole('button', { name: 'ポストする' })
      .click()
    await expect(this.page.getByText(text)).toBeVisible()
  }

  /** 左のナビの未読バッジ（例「未読 2 件」） */
  unreadBadge(): Locator {
    return this.page.getByLabel(UNREAD_BADGE_LABEL).first()
  }

  async openNotifications() {
    await this.page.getByRole('link', { name: '通知' }).first().click()
  }
}

/** プロフィール（U-05） */
export class ProfilePage {
  constructor(private readonly page: Page) {}

  async open(handle: string) {
    await this.page.goto(`/${handle}`)
  }

  async follow() {
    await this.page.getByRole('button', { name: 'フォロー', exact: true }).click()
    await expect(this.page.getByRole('button', { name: FOLLOWING_LABEL })).toBeVisible()
  }

  /** 表示名の人の投稿カード */
  postBy(displayName: string): Locator {
    return this.page.getByRole('article', { name: `${displayName} さんの投稿` }).first()
  }

  async like(displayName: string) {
    const card = this.postBy(displayName)
    await card.getByRole('button', { name: 'いいね', exact: true }).click()
    await expect(card.getByRole('button', { name: 'いいねを取り消す' })).toBeVisible()
  }
}
