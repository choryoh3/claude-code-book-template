// ⚠ 一時的な定義（Phase 3 と Phase 4 を並行して作ったため）。
//
// 次の 2 つは、Phase 3（user/server）の作業で packages/shared に追加される予定のスキーマ。
// この画面のブランチを作った時点の shared にはまだ無いので、同じ形をここに仮に置いている。
// Phase 3 と統合したら、このファイルを削除し、endpoints.ts の import を `@xclone/shared` に置き換えること
// （shared を唯一の真実にする: CLAUDE.md の絶対ルール）。
//   - mediaUploadDtoSchema   … POST /media の応答 { url }
//   - reportCreatedDtoSchema … POST /reports の応答 { id }

import { z } from 'zod'

export const mediaUploadDtoSchema = z.object({ url: z.url() })
export const reportCreatedDtoSchema = z.object({ id: z.uuid() })
