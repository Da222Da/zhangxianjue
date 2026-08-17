import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db.js'
import { authMiddleware, requireRole } from './auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', requireRole('admin', 'editor'), (req, res) => {
  const db = getDb()
  const { page = 1, pageSize = 10, keyword = '' } = req.query
  const offset = (Number(page) - 1) * Number(pageSize)
  let where = '1=1'
  const params = []
  if (keyword) {
    where += ' AND (username LIKE ? OR phone LIKE ?)'
    params.push(`%${keyword}%`, `%${keyword}%`)
  }
  const total = db.prepare(`SELECT COUNT(*) as c FROM users WHERE ${where}`).get(...params).c
  const list = db
    .prepare(
      `SELECT id, username, phone, role, avatar, created_at FROM users WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, Number(pageSize), offset)
  res.json({ list, total, page: Number(page), pageSize: Number(pageSize) })
})

router.post('/', requireRole('admin'), (req, res) => {
  const { username, password, phone, role = 'user' } = req.body
  if (!username || !password) return res.status(400).json({ message: '用户名和密码必填' })
  const db = getDb()
  try {
    const hash = bcrypt.hashSync(password, 10)
    const r = db
      .prepare('INSERT INTO users (username, password, phone, role) VALUES (?, ?, ?, ?)')
      .run(username, hash, phone || null, role)
    res.json({ id: r.lastInsertRowid, message: '创建成功' })
  } catch (e) {
    res.status(400).json({ message: e.message.includes('UNIQUE') ? '用户名已存在' : e.message })
  }
})

router.put('/:id', requireRole('admin'), (req, res) => {
  const { username, password, phone, role } = req.body
  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ message: '用户不存在' })

  const newPass = password ? bcrypt.hashSync(password, 10) : user.password
  db.prepare('UPDATE users SET username=?, password=?, phone=?, role=? WHERE id=?').run(
    username || user.username,
    newPass,
    phone !== undefined ? phone : user.phone,
    role || user.role,
    req.params.id
  )
  res.json({ message: '更新成功' })
})

router.delete('/:id', requireRole('admin'), (req, res) => {
  const db = getDb()
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ message: '不能删除当前登录用户' })
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id)
  res.json({ message: '删除成功' })
})

export default router
