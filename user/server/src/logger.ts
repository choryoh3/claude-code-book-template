// ログ（pino）。1 行 1 JSON で logs/user-server.log に出し、開発中は見やすく整形して画面にも出す。
// すべての行に requestId（と userId）が自動で付くので、`pnpm logs:trace <requestId>` で 1 リクエストを追える。
// 規約: .claude/rules/observability.md

import type { TransportTargetOptions } from 'pino'
import { pino } from 'pino'
import { config } from './config'
import { currentContext } from './context'

/** ログに出してはいけない値（パスワード・トークン・Cookie）を自動で伏せ字にする */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.password_hash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
]

function buildTransportTargets(): TransportTargetOptions[] {
  const file: TransportTargetOptions = {
    target: 'pino/file',
    level: config.logLevel,
    options: { destination: config.logFile, mkdir: true },
  }
  // 開発中は画面に色つきで見やすく、本番は標準出力に JSON のまま
  const console: TransportTargetOptions = config.isProduction
    ? { target: 'pino/file', level: config.logLevel, options: { destination: 1 } }
    : {
        target: 'pino-pretty',
        level: config.logLevel,
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
      }
  return [file, console]
}

export const logger = config.isTest
  ? pino({ level: 'silent' }) // テスト中はログを出さない（必要なら LOG_LEVEL を見直す）
  : pino({
      level: config.logLevel,
      base: { app: 'user-server' },
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      // すべてのログ行に、今処理中のリクエストの requestId / userId を付ける
      mixin() {
        const context = currentContext()
        return context ? { requestId: context.requestId, userId: context.userId } : {}
      },
      transport: { targets: buildTransportTargets() },
    })
