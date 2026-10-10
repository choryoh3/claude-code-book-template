// 画面仕様書（Excel）を生成するスクリプト。
// 使い方: pnpm spec:screens
//
// 元データ : docs/screens/specs/*.mjs（画面ごとの項目・動作・状態など）
// キャプチャ: docs/screens/captures/<名前>.png（あれば画面シートに自動で貼り付ける）
// 出力     : docs/screens/画面仕様書.xlsx
//
// 構成: 表紙 / 画面一覧 / 画面遷移 / 共通仕様 / メッセージ一覧 / 用語集 / 画面ごとのシート
// 画面シートは「基本設計（目的・構成・キャプチャ）」と「詳細設計（項目・動作・状態・テスト観点）」を 1 枚にまとめている。
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { adminScreens } from '../docs/screens/specs/admin-screens.mjs'
import {
  commonRules,
  glossary,
  messages,
  meta,
  revisions,
  transitions,
} from '../docs/screens/specs/common.mjs'
import { userScreens } from '../docs/screens/specs/user-screens.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CAPTURE_DIR = join(ROOT, 'docs/screens/captures')
const OUTPUT_FILE = join(ROOT, 'docs/screens/画面仕様書.xlsx')

// ---------------------------------------------------------------- 見た目の定義
const COLOR = {
  title: 'FF0B4F94', // 見出しバー（濃い青）
  section: 'FF1D9BF0', // セクションバー（青）
  header: 'FFDCE9F7', // 表のヘッダー（薄い青）
  label: 'FFF1F5F9', // ラベル列（薄い灰）
  placeholder: 'FFFFF7E0', // キャプチャ未取得の枠（薄い黄）
  white: 'FFFFFFFF',
  text: 'FF0F1419',
  muted: 'FF536471',
}
const FONT_NAME = 'Meiryo UI'
const THIN = { style: 'thin', color: { argb: 'FFB8C4CE' } }
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN }

/** 画面シートの列幅（A〜I の 9 列）。表はこの 9 列を「結合」して使い分ける */
const SCREEN_COLUMN_WIDTHS = [6, 28, 16, 10, 9, 36, 16, 28, 32]
const LINE_HEIGHT = 18
/** シート名に使うための正規表現（「共通部品: 左ナビ…」のコロン以降を省く / 使えない記号を消す） */
const AFTER_COLON = /[:：].*$/
const SHEET_NAME_FORBIDDEN = /[\\/?*[\]]/g
const MAX_IMAGE_WIDTH_PX = 560

// ---------------------------------------------------------------- 小さな部品
/** 全角を 2 文字分として、セルに必要な行数を見積もる（Excel は結合セルの高さを自動調整しないため） */
function estimateLines(text, widthChars) {
  const value = String(text ?? '')
  return value.split('\n').reduce((sum, line) => {
    const length = [...line].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 2 : 1), 0)
    return sum + Math.max(1, Math.ceil(length / Math.max(1, widthChars - 1)))
  }, 0)
}

function styleCell(
  cell,
  { bold = false, fill, color = COLOR.text, align = 'left', size = 10 } = {},
) {
  cell.font = { name: FONT_NAME, size, bold, color: { argb: color } }
  cell.alignment = { vertical: 'top', horizontal: align, wrapText: true }
  cell.border = BORDER
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
}

/** 列 `from`〜`to`（1 始まり）を結合して値を入れる */
function putMerged(ws, row, from, to, value, style) {
  if (to > from) ws.mergeCells(row, from, row, to)
  const cell = ws.getCell(row, from)
  cell.value = value
  for (let col = from; col <= to; col++) styleCell(ws.getCell(row, col), style)
  return cell
}

function widthOf(ws, from, to) {
  let sum = 0
  for (let col = from; col <= to; col++) sum += ws.getColumn(col).width ?? 10
  return sum
}

/** バー状の見出し（タイトル・セクション用）を書き、次の行番号を返す */
function writeBar(ws, row, lastCol, text, { fill, size }) {
  putMerged(ws, row, 1, lastCol, text, { bold: true, fill, color: COLOR.white, size })
  ws.getRow(row).height = size + 14
  return row + 1
}

/**
 * 表を書く。spans は各列が占める「画面シートの列数」で、合計が lastCol になる。
 * 例: spans [1,1,2,2,1,1,1] → 7 つの項目を 9 列に割り付ける。
 */
function writeTable(ws, startRow, headers, rows, spans) {
  const cursor = { row: startRow }
  const writeRow = (values, style) => {
    let col = 1
    let lines = 1
    values.forEach((value, i) => {
      const to = col + spans[i] - 1
      putMerged(ws, cursor.row, col, to, value, style)
      lines = Math.max(lines, estimateLines(value, widthOf(ws, col, to)))
      col = to + 1
    })
    ws.getRow(cursor.row).height = Math.max(20, lines * LINE_HEIGHT)
    cursor.row++
  }
  writeRow(headers, { bold: true, fill: COLOR.header })
  rows.forEach((values) => writeRow(values, {}))
  return cursor.row
}

/** 「ラベル | 値」の 1 行（基本設計の基本情報用）。値は複数行にできる */
function writeLabelValue(ws, row, label, value) {
  putMerged(ws, row, 1, 2, label, { bold: true, fill: COLOR.label })
  putMerged(ws, row, 3, 9, value, {})
  ws.getRow(row).height = Math.max(20, estimateLines(value, widthOf(ws, 3, 9)) * LINE_HEIGHT)
  return row + 1
}

function readPngSize(buffer) {
  // PNG のヘッダー（IHDR）に幅と高さが入っている
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function sheetNameOf(screen) {
  // Excel のシート名は 31 文字まで、: \ / ? * [ ] は使えない
  const shortName = screen.name.replace(AFTER_COLON, '').replace(SHEET_NAME_FORBIDDEN, '・')
  return `${screen.id} ${shortName}`.slice(0, 31)
}

// ---------------------------------------------------------------- シートごとの生成
function addCoverSheet(wb, screens, captureStats) {
  const ws = wb.addWorksheet('表紙', { views: [{ showGridLines: false }] })
  ws.columns = [{ width: 4 }, { width: 22 }, { width: 70 }, { width: 24 }]

  putMerged(ws, 2, 2, 4, meta.title, {
    bold: true,
    fill: COLOR.title,
    color: COLOR.white,
    size: 20,
  })
  ws.getRow(2).height = 48
  putMerged(
    ws,
    3,
    2,
    4,
    `版数 ${meta.version} ／ 作成日 ${new Date().toISOString().slice(0, 10)}`,
    {
      fill: COLOR.header,
    },
  )

  let row = 5
  const info = [
    ['この資料について', meta.note],
    [
      '対象',
      `画面 ${screens.length} 件（一般ユーザー ${userScreens.length} / 管理者 ${adminScreens.length}）`,
    ],
    [
      'キャプチャ',
      `${captureStats.found} / ${captureStats.total} 枚取得済み（未取得は UI 実装後に /screen-spec で追加）`,
    ],
    [
      '再生成の方法',
      '元データ: docs/screens/specs/*.mjs、画像: docs/screens/captures/*.png → `pnpm spec:screens`',
    ],
    [
      '読み方',
      '各画面シートは「基本設計（目的・構成・キャプチャ）」→「詳細設計（項目定義・動作定義・状態表示・テスト観点）」の順。',
    ],
  ]
  for (const [label, value] of info) {
    putMerged(ws, row, 2, 2, label, { bold: true, fill: COLOR.label })
    putMerged(ws, row, 3, 4, value, {})
    ws.getRow(row).height = Math.max(20, estimateLines(value, 94) * LINE_HEIGHT)
    row++
  }

  row += 1
  putMerged(ws, row, 2, 4, '目次（クリックでシートへ移動）', {
    bold: true,
    fill: COLOR.section,
    color: COLOR.white,
  })
  row++
  const toc = [
    ['画面一覧', '全画面の一覧と実装状況'],
    ['画面遷移', '画面から画面への移動'],
    ['共通仕様', 'レイアウト・入力・通信・アクセシビリティなどの共通ルール'],
    ['メッセージ一覧', 'エラー・成功・空状態の文言'],
    ['用語集', '用語の説明'],
    ...screens.map((s) => [sheetNameOf(s), s.purpose]),
  ]
  for (const [sheet, description] of toc) {
    const link = ws.getCell(row, 2)
    link.value = { text: sheet, hyperlink: `#'${sheet}'!A1` }
    styleCell(link, { color: 'FF0563C1' })
    link.font = { name: FONT_NAME, size: 10, underline: true, color: { argb: 'FF0563C1' } }
    putMerged(ws, row, 3, 4, description, {})
    ws.getRow(row).height = Math.max(20, estimateLines(description, 94) * LINE_HEIGHT)
    row++
  }

  row += 1
  putMerged(ws, row, 2, 4, '改訂履歴', { bold: true, fill: COLOR.section, color: COLOR.white })
  row++
  const headers = ['日付 / 版', '内容', '担当']
  headers.forEach((h, i) => styleCell(ws.getCell(row, 2 + i), { bold: true, fill: COLOR.header }))
  headers.forEach((h, i) => (ws.getCell(row, 2 + i).value = h))
  row++
  for (const [date, version, content, author] of revisions) {
    ws.getCell(row, 2).value = `${date} / ${version}`
    ws.getCell(row, 3).value = content
    ws.getCell(row, 4).value = author
    for (let col = 2; col <= 4; col++) styleCell(ws.getCell(row, col), {})
    ws.getRow(row).height = Math.max(20, estimateLines(content, 70) * LINE_HEIGHT)
    row++
  }
}

function addListSheet(wb, screens, captureFound) {
  const ws = wb.addWorksheet('画面一覧', { views: [{ state: 'frozen', ySplit: 3 }] })
  const columns = [
    ['画面ID', 9],
    ['画面名', 26],
    ['アプリ', 9],
    ['URL パス', 30],
    ['認証・権限', 22],
    ['目的', 46],
    ['項目数', 8],
    ['動作数', 8],
    ['主な API', 34],
    ['主なテーブル', 24],
    ['キャプチャ', 12],
    ['実装状況', 10],
  ]
  ws.columns = columns.map(([, width]) => ({ width }))
  writeBar(ws, 1, columns.length, '画面一覧', { fill: COLOR.title, size: 16 })
  ws.getRow(2).height = 6
  columns.forEach(([title], i) => {
    const cell = ws.getCell(3, i + 1)
    cell.value = title
    styleCell(cell, { bold: true, fill: COLOR.header, align: 'center' })
  })
  screens.forEach((screen, index) => {
    const row = 4 + index
    const captured = screen.captures.filter((name) => captureFound.has(name)).length
    const values = [
      screen.id,
      screen.name,
      screen.app === 'admin' ? '管理者' : 'ユーザー',
      screen.path,
      screen.auth,
      screen.purpose,
      screen.items.length,
      screen.actions.length,
      screen.apis.join('\n'),
      screen.tables.join(', '),
      `${captured} / ${screen.captures.length}`,
      screen.status ?? '未実装',
    ]
    values.forEach((value, i) => {
      const cell = ws.getCell(row, i + 1)
      cell.value = value
      styleCell(cell, { align: i >= 6 && i <= 7 ? 'center' : 'left' })
    })
    const idCell = ws.getCell(row, 1)
    idCell.value = { text: screen.id, hyperlink: `#'${sheetNameOf(screen)}'!A1` }
    idCell.font = { name: FONT_NAME, size: 10, underline: true, color: { argb: 'FF0563C1' } }
    const lines = Math.max(...values.map((v, i) => estimateLines(v, columns[i][1])))
    ws.getRow(row).height = Math.max(20, lines * LINE_HEIGHT)
  })
  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + screens.length, column: columns.length },
  }
}

function addSimpleTableSheet(wb, name, title, headers, widths, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }] })
  ws.columns = widths.map((width) => ({ width }))
  writeBar(ws, 1, headers.length, title, { fill: COLOR.title, size: 16 })
  ws.getRow(2).height = 6
  headers.forEach((header, i) => {
    const cell = ws.getCell(3, i + 1)
    cell.value = header
    styleCell(cell, { bold: true, fill: COLOR.header })
  })
  rows.forEach((values, index) => {
    const row = 4 + index
    values.forEach((value, i) => {
      const cell = ws.getCell(row, i + 1)
      cell.value = value
      styleCell(cell, {})
    })
    const lines = Math.max(...values.map((v, i) => estimateLines(v, widths[i])))
    ws.getRow(row).height = Math.max(20, lines * LINE_HEIGHT)
  })
}

/** 画面ごとのシート: 基本設計 → キャプチャ → 詳細設計 */
function addScreenSheet(wb, screen) {
  const LAST = SCREEN_COLUMN_WIDTHS.length
  const ws = wb.addWorksheet(sheetNameOf(screen), { views: [{ showGridLines: false }] })
  ws.columns = SCREEN_COLUMN_WIDTHS.map((width) => ({ width }))

  let row = writeBar(ws, 1, LAST, `${screen.id}  ${screen.name}`, { fill: COLOR.title, size: 16 })
  const back = ws.getCell(row, 1)
  back.value = { text: '← 画面一覧へ戻る', hyperlink: "#'画面一覧'!A1" }
  back.font = { name: FONT_NAME, size: 10, underline: true, color: { argb: 'FF0563C1' } }
  row += 2

  // ---- 基本設計
  row = writeBar(ws, row, LAST, '【基本設計】画面の概要', { fill: COLOR.section, size: 12 })
  row = writeLabelValue(ws, row, '画面ID', screen.id)
  row = writeLabelValue(ws, row, '画面名', screen.name)
  row = writeLabelValue(
    ws,
    row,
    'アプリ',
    screen.app === 'admin' ? '管理者アプリ（admin）' : '一般ユーザーアプリ（user）',
  )
  row = writeLabelValue(ws, row, 'URL パス', screen.path)
  row = writeLabelValue(ws, row, '認証・権限', screen.auth)
  row = writeLabelValue(ws, row, '目的', screen.purpose)
  row = writeLabelValue(ws, row, '画面構成', screen.layout.map((line) => `・${line}`).join('\n'))
  row = writeLabelValue(ws, row, '関連 API', screen.apis.join('\n') || '-')
  row = writeLabelValue(ws, row, '関連テーブル', screen.tables.join(', ') || '-')
  row = writeLabelValue(ws, row, '実装状況', screen.status ?? '未実装（Phase 4/6 で実装予定）')
  row += 1

  // ---- 画面キャプチャ
  row = writeBar(ws, row, LAST, '【画面キャプチャ】', { fill: COLOR.section, size: 12 })
  for (const name of screen.captures) {
    const file = join(CAPTURE_DIR, `${name}.png`)
    putMerged(ws, row, 1, LAST, `■ ${name}`, { bold: true, fill: COLOR.label })
    row++
    if (existsSync(file)) {
      const buffer = readFileSync(file)
      const { width, height } = readPngSize(buffer)
      const scale = Math.min(1, MAX_IMAGE_WIDTH_PX / width)
      const drawW = Math.round(width * scale)
      const drawH = Math.round(height * scale)
      const imageId = wb.addImage({ buffer, extension: 'png' })
      ws.addImage(imageId, { tl: { col: 0.1, row }, ext: { width: drawW, height: drawH } })
      row += Math.ceil(drawH / 20) + 1
    } else {
      putMerged(
        ws,
        row,
        1,
        LAST,
        `（未取得）docs/screens/captures/${name}.png — UI 実装後に /screen-spec で自動取得して貼り付けます`,
        {
          fill: COLOR.placeholder,
          color: COLOR.muted,
          align: 'center',
        },
      )
      ws.getRow(row).height = 60
      row += 2
    }
  }
  row += 1

  // ---- 詳細設計
  row = writeBar(ws, row, LAST, '【詳細設計】画面項目定義', { fill: COLOR.section, size: 12 })
  row = writeTable(
    ws,
    row,
    ['No', '項目名', '種別', '入出力', '必須', '制約・書式', '初期値', '表示・活性の条件', '備考'],
    screen.items,
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
    LAST,
  )
  row += 1

  row = writeBar(ws, row, LAST, '【詳細設計】動作定義（イベントと処理）', {
    fill: COLOR.section,
    size: 12,
  })
  row = writeTable(
    ws,
    row,
    ['No', 'きっかけ', '条件', '処理内容', '呼び出す API', '成功したとき', '失敗したとき'],
    screen.actions,
    [1, 1, 2, 2, 1, 1, 1],
    LAST,
  )
  row += 1

  row = writeBar(ws, row, LAST, '【詳細設計】状態ごとの表示', { fill: COLOR.section, size: 12 })
  row = writeTable(ws, row, ['状態', '表示内容'], screen.states, [2, 7], LAST)
  row += 1

  row = writeBar(ws, row, LAST, '【詳細設計】テスト観点（テストデータ: docs/test-data.md）', {
    fill: COLOR.section,
    size: 12,
  })
  writeTable(
    ws,
    row,
    ['No', '確認すること'],
    screen.tests.map((test, i) => [i + 1, test]),
    [1, 8],
    LAST,
  )

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
}

// ---------------------------------------------------------------- 実行
async function main() {
  const screens = [...userScreens, ...adminScreens]
  const allCaptures = screens.flatMap((screen) => screen.captures)
  const captureFound = new Set(
    allCaptures.filter((name) => existsSync(join(CAPTURE_DIR, `${name}.png`))),
  )

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Claude Code'
  wb.created = new Date()

  addCoverSheet(wb, screens, { found: captureFound.size, total: allCaptures.length })
  addListSheet(wb, screens, captureFound)
  addSimpleTableSheet(
    wb,
    '画面遷移',
    '画面遷移',
    ['遷移元', 'きっかけ', '遷移先', '条件・備考'],
    [30, 30, 30, 40],
    transitions,
  )
  addSimpleTableSheet(
    wb,
    '共通仕様',
    '共通仕様',
    ['区分', '項目', '内容'],
    [18, 22, 110],
    commonRules,
  )
  addSimpleTableSheet(
    wb,
    'メッセージ一覧',
    'メッセージ一覧',
    ['ID', '種別', '表示場所', '文言', '発生条件'],
    [11, 9, 14, 56, 40],
    messages,
  )
  addSimpleTableSheet(wb, '用語集', '用語集', ['用語', '意味'], [28, 100], glossary)
  for (const screen of screens) addScreenSheet(wb, screen)

  await wb.xlsx.writeFile(OUTPUT_FILE)
  console.log(`画面仕様書を作成しました: ${OUTPUT_FILE}`)
  console.log(
    `  画面 ${screens.length} 件 / キャプチャ ${captureFound.size} / ${allCaptures.length} 枚取得済み`,
  )
}

main().catch((error) => {
  console.error('画面仕様書の生成に失敗しました:', error)
  process.exit(1)
})
