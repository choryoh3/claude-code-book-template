// E2E: 一般ユーザーの主な流れ（Phase 4 の受け入れ条件）。
//   登録 → 投稿 → （別の人が）フォロー・いいね → 通知がリアルタイムに届く
// 2 人の利用者（alice と bob）を、別々のブラウザ（コンテキスト）で同時に動かして確かめる。

import { expect, test } from '@playwright/test'
import { HomePage, newAccount, ProfilePage, SignupPage } from '../pages/app'

test('登録 → 投稿 → いいね → フォロー → 通知のリアルタイム受信', async ({ browser }) => {
  const alice = newAccount('alice')
  const bob = newAccount('bob')
  const postText = `E2E の投稿です #xclone ${Date.now()}`

  // alice: 登録して投稿する（このあと画面を開いたまま、通知を待つ）
  const aliceContext = await browser.newContext()
  const alicePage = await aliceContext.newPage()
  await new SignupPage(alicePage).signUp(alice)
  const aliceHome = new HomePage(alicePage)
  await aliceHome.post(postText)

  // bob: 別のブラウザで登録し、alice のプロフィールを開いてフォローし、投稿にいいねする
  const bobContext = await browser.newContext()
  const bobPage = await bobContext.newPage()
  await new SignupPage(bobPage).signUp(bob)
  const aliceProfile = new ProfilePage(bobPage)
  await aliceProfile.open(alice.handle)
  await aliceProfile.follow()
  await aliceProfile.like(alice.displayName)

  // alice: ページを再読み込みせずに、未読バッジが現れる（Socket.IO のリアルタイム配信）
  await expect(aliceHome.unreadBadge()).toBeVisible()

  // alice: 通知を開くと、いいねとフォローの通知が並んでいる
  await aliceHome.openNotifications()
  await expect(alicePage.getByText('さんがあなたのポストをいいねしました')).toBeVisible()
  await expect(alicePage.getByText('さんにフォローされました')).toBeVisible()
  await expect(alicePage.getByText(bob.displayName).first()).toBeVisible()

  await aliceContext.close()
  await bobContext.close()
})

test('ログアウトして、もう一度ログインできる', async ({ page }) => {
  const carol = newAccount('carol')
  await new SignupPage(page).signUp(carol)

  // ページを再読み込みしても、ログイン状態が戻る（refresh token の Cookie による復元）
  await page.reload()
  await expect(page.getByRole('textbox', { name: '投稿の本文' })).toBeVisible()

  // Cookie を消すとログイン画面に戻り、メールとパスワードでログインし直せる
  await page.context().clearCookies()
  await page.reload()
  await page.locator('input[autocomplete="email"]').fill(carol.email)
  await page.locator('input[autocomplete="current-password"]').fill(carol.password)
  await page.getByRole('button', { name: 'ログイン' }).click()
  await expect(page.getByRole('textbox', { name: '投稿の本文' })).toBeVisible()
})
