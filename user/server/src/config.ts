// サーバーの設定。環境変数を起動時に Zod で検証し、型のついた `config` として公開する。
// アプリのコードは process.env を直接読まず、必ずこの config を使う（.claude/rules/express-server.md）。

import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

/** リポジトリのルート（logs/ や uploads/ の既定の置き場所） */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

/** URL の末尾のスラッシュ（「…/」と「…」を同じに扱うため取り除く） */
const TRAILING_SLASH = /\/$/

/** 開発専用の JWT シークレット。本番でこの値のまま起動しようとしたら止める */
const DEV_ONLY_ACCESS_SECRET = 'dev-only-user-access-secret-do-not-use-in-production'

/** ルートの .env を読み込む（無ければ何もしない。既定値とシェルの環境変数で動く） */
function loadRootEnvFile() {
  try {
    process.loadEnvFile(`${REPO_ROOT}.env`)
  } catch {
    // .env が無いのは正常
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  USER_SERVER_PORT: z.coerce.number().int().positive().default(3000),
  /** 画面（Vue）の URL。CORS と Socket.IO の接続元として許可する */
  USER_CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  /** access token（JWT）の署名用。管理者用とは別の値にする（docs/adr/0004） */
  JWT_ACCESS_SECRET: z.string().min(16).default(DEV_ONLY_ACCESS_SECRET),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_DIR: z.string().default(`${REPO_ROOT}logs`),
  UPLOAD_DIR: z.string().default(`${REPO_ROOT}uploads`),
  /** アップロードした画像の URL の先頭（例 http://localhost:3000/uploads/xxx.png） */
  PUBLIC_BASE_URL: z.string().default('http://localhost:3000'),
  /** ログイン・登録の試行回数の上限（1 分あたり・IP ごと）。総当たり攻撃を防ぐ */
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),
  /** 画像のアップロードの回数の上限（1 分あたり・IP ごと） */
  MEDIA_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
})

function loadConfig() {
  loadRootEnvFile()
  const env = envSchema.parse(process.env)

  if (env.NODE_ENV === 'production' && env.JWT_ACCESS_SECRET === DEV_ONLY_ACCESS_SECRET) {
    throw new Error('本番では JWT_ACCESS_SECRET を必ず設定してください（開発用の既定値のままです）')
  }

  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    port: env.USER_SERVER_PORT,
    clientOrigin: env.USER_CLIENT_ORIGIN,
    jwtAccessSecret: env.JWT_ACCESS_SECRET,
    logLevel: env.LOG_LEVEL,
    logFile: `${env.LOG_DIR}/user-server.log`,
    uploadDir: env.UPLOAD_DIR,
    publicBaseUrl: env.PUBLIC_BASE_URL.replace(TRAILING_SLASH, ''),
    authRateLimitPerMinute: env.AUTH_RATE_LIMIT_PER_MINUTE,
    mediaRateLimitPerMinute: env.MEDIA_RATE_LIMIT_PER_MINUTE,
  })
}

export const config = loadConfig()
export type Config = typeof config
