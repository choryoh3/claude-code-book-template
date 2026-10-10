// hooks 共通ユーティリティ。標準入力の JSON を読み、パスを正規化する。
import { existsSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

export const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd())

export async function readInput() {
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  try {
    return JSON.parse(raw || '{}')
  } catch {
    return {}
  }
}

/** プロジェクトルートからの相対パス(区切りは常に `/`)。ルート外なら null */
export function toRelative(filePath) {
  if (!filePath) return null
  const abs = isAbsolute(filePath) ? filePath : resolve(projectDir, filePath)
  const rel = relative(projectDir, abs).replaceAll('\\', '/')
  return rel.startsWith('..') ? null : rel
}

export function absolute(rel) {
  return resolve(projectDir, rel)
}

/** node_modules/.bin のコマンドを実行(未インストールなら null) */
export function runBin(name, args) {
  const ext = process.platform === 'win32' ? '.cmd' : ''
  const bin = resolve(projectDir, 'node_modules', '.bin', name + ext)
  if (!existsSync(bin)) return null
  return spawnSync(bin, args, {
    cwd: projectDir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
}

/** Claude にフィードバックして終了(PreToolUse ならツール実行をブロック) */
export function deny(message) {
  process.stderr.write(`${message}\n`)
  process.exit(2)
}
