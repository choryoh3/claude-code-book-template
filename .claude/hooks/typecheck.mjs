// Stop: TS/Vue ファイルに変更があれば pnpm typecheck を実行し、エラーを報告する
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { absolute, deny, projectDir, readInput } from './lib.mjs'

const input = await readInput()
// typecheck 失敗 → Claude が修正 → 再度 Stop、の無限ループを避ける
if (input.stop_hook_active) process.exit(0)

const pkgPath = absolute('package.json')
if (!existsSync(pkgPath) || !existsSync(absolute('node_modules'))) process.exit(0)
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
if (!pkg.scripts?.typecheck) process.exit(0)

const git = spawnSync('git', ['status', '--porcelain'], { cwd: projectDir, encoding: 'utf8' })
const changed = (git.stdout ?? '').split('\n').filter((l) => /\.(?:ts|mts|cts|vue)$/.test(l.trim()))
if (changed.length === 0) process.exit(0)

const res = spawnSync('pnpm', ['typecheck'], { cwd: projectDir, encoding: 'utf8', shell: true })
if (res.status !== 0) {
  deny(
    `pnpm typecheck が失敗しました。修正してください:\n${(res.stdout + res.stderr).slice(-3000)}`,
  )
}
