// PostToolUse (Edit|Write): 編集ファイルに prettier --write → eslint --fix を適用する
import { existsSync } from 'node:fs'
import { absolute, deny, readInput, runBin, toRelative } from './lib.mjs'

const PRETTIER_EXT = /\.(?:ts|mts|cts|js|mjs|cjs|vue|json|css|md|ya?ml)$/
const ESLINT_EXT = /\.(?:ts|mts|cts|js|mjs|cjs|vue)$/
const SKIP = /^(?:packages\/db\/(?:migrations|generated)\/|docs\/architecture\/)/

const input = await readInput()
const rel = toRelative(input.tool_input?.file_path)
if (!rel || SKIP.test(rel) || !existsSync(absolute(rel))) process.exit(0)

if (PRETTIER_EXT.test(rel)) runBin('prettier', ['--write', rel])

if (ESLINT_EXT.test(rel)) {
  const res = runBin('eslint', ['--fix', rel])
  // 自動修正できなかった問題だけを Claude に返す
  if (res && res.status !== 0)
    deny(`eslint が ${rel} の問題を自動修正できませんでした:\n${res.stdout}${res.stderr}`)
}
