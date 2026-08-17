import { Router } from 'express'
import { getDb } from '../db.js'
import { authMiddleware, requireRole } from './auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/theme', (_req, res) => {
  const db = getDb()
  const row = db.prepare("SELECT value FROM system_settings WHERE key='theme'").get()
  res.json(row ? JSON.parse(row.value) : {})
})

router.put('/theme', requireRole('admin'), (req, res) => {
  const db = getDb()
  db.prepare(
    `INSERT INTO system_settings (key, value) VALUES ('theme', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(JSON.stringify(req.body))
  res.json({ message: '样式已保存' })
})

export default router
