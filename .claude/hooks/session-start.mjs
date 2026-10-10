// SessionStart: 現在のブランチと作業ツリーの状態を表示する(stdout は Claude の文脈に追加される)
import { spawnSync } from 'node:child_process'
import { projectDir } from './lib.mjs'

const git = (...args) =>
  spawnSync('git', args, { cwd: projectDir, encoding: 'utf8' }).stdout?.trim() ?? ''

const branch = git('branch', '--show-current') || '(detached HEAD)'
const status = git('status', '--short')

console.log(`現在のブランチ: ${branch}`)
console.log(status ? `未コミットの変更:\n${status}` : '作業ツリーはクリーンです。')
