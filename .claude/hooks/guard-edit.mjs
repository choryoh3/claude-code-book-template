// PreToolUse (Edit|Write): 秘密情報・既存マイグレーション・自動生成ファイルの編集をブロックする
import { existsSync } from 'node:fs'
import { absolute, deny, readInput, toRelative } from './lib.mjs'

const input = await readInput()
const rel = toRelative(input.tool_input?.file_path)
if (!rel) process.exit(0)

const name = rel.split('/').at(-1) ?? ''
if (/^\.env(?:\..+)?$/.test(name) && name !== '.env.example') {
  deny(
    `[guard-edit] ${rel} は秘密情報のため編集できません。値の例は .env.example に書いてください。`,
  )
}

// 新規作成は許可、既存マイグレーション（適用済みの履歴）の変更は禁止
if (rel.startsWith('packages/db/migrations/') && existsSync(absolute(rel))) {
  deny(
    `[guard-edit] 既存マイグレーション ${rel} は編集できません。` +
      '新しいマイグレーションを作成して変更してください（skill: db-migration）。',
  )
}

// kysely-codegen が生成する型。手で直さず `pnpm db:codegen` で作り直す
if (rel.startsWith('packages/db/src/generated/')) {
  deny(
    `[guard-edit] ${rel} は自動生成ファイルです。マイグレーション後に \`pnpm db:codegen\` で再生成してください。`,
  )
}
