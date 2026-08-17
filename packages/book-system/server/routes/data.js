import { Router } from 'express'
import multer from 'multer'
import XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDb } from '../db.js'
import { authMiddleware, requireRole } from './auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const upload = multer({ dest: path.join(__dirname, '../uploads') })
const router = Router()
router.use(authMiddleware)

router.get('/export', requireRole('admin', 'editor'), (req, res) => {
  const db = getDb()
  const books = db.prepare('SELECT * FROM books').all()
  const ws = XLSX.utils.json_to_sheet(books)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'books')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', 'attachment; filename=books.xlsx')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

router.post('/import', requireRole('admin', 'editor'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请上传文件' })
    const wb = XLSX.readFile(req.file.path)
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet)
    const db = getDb()
    const insert = db.prepare(
      `INSERT INTO books (title, author, category, publisher, isbn, rating, recommend_score, description, publish_year, pages, price, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    let count = 0
    const tx = db.transaction(() => {
      for (const r of rows) {
        if (!r.title) continue
        insert.run(
          r.title,
          r.author || '',
          r.category || '其他',
          r.publisher || '',
          r.isbn || '',
          r.rating || 0,
          r.recommend_score || 0,
          r.description || '',
          r.publish_year || null,
          r.pages || null,
          r.price || 0,
          r.stock || 0
        )
        if (r.category) {
          db.prepare(
            `INSERT INTO categories (name, count) VALUES (?, 1)
             ON CONFLICT(name) DO UPDATE SET count = count + 1`
          ).run(r.category)
        }
        count++
      }
    })
    tx()
    res.json({ message: `成功导入 ${count} 条数据`, count })
  } catch (e) {
    res.status(500).json({ message: '导入失败: ' + e.message })
  } finally {
    if (req.file?.path) {
      import('fs').then((fs) => fs.unlink(req.file.path, () => {}))
    }
  }
})

router.get('/tables', requireRole('admin'), (_req, res) => {
  const db = getDb()
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
  res.json(tables)
})

router.get('/table/:name', requireRole('admin'), (req, res) => {
  const db = getDb()
  const name = req.params.name.replace(/[^a-zA-Z0-9_]/g, '')
  const { page = 1, pageSize = 20 } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)
  try {
    const total = db.prepare(`SELECT COUNT(*) as c FROM ${name}`).get().c
    const list = db.prepare(`SELECT * FROM ${name} LIMIT ? OFFSET ?`).all(Number(pageSize), offset)
    const columns = db.prepare(`PRAGMA table_info(${name})`).all()
    res.json({ list, total, columns })
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

export default router
