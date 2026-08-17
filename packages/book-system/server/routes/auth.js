import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import svgCaptcha from 'svg-captcha'
import { getDb } from '../db.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'book-recommend-secret-2024'
const captchaStore = new Map()
const loginAttempts = new Map()

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 }
  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + 15 * 60 * 1000
  }
  entry.count += 1
  loginAttempts.set(ip, entry)
  return entry.count <= 20
}

router.get('/captcha', (_req, res) => {
  const captcha = svgCaptcha.create({
    size: 4,
    ignoreChars: '0oO1ilI',
    noise: 3,
    color: true,
    background: '#f0f4f8',
    width: 120,
    height: 40
  })
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  captchaStore.set(id, captcha.text.toLowerCase())
  setTimeout(() => captchaStore.delete(id), 5 * 60 * 1000)
  res.json({ id, svg: captcha.data })
})

router.post('/login', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ message: '登录尝试过多，请稍后再试' })
  }

  const { username, password, phone, captchaId, captchaCode, loginType } = req.body
  const db = getDb()
  if (!db) return res.status(503).json({ message: '数据库未就绪' })

  if (!captchaId || !captchaCode) {
    return res.status(400).json({ message: '请输入验证码' })
  }
  const stored = captchaStore.get(captchaId)
  captchaStore.delete(captchaId)
  if (!stored || stored !== String(captchaCode).toLowerCase()) {
    return res.status(400).json({ message: '验证码错误' })
  }

  let user
  if (loginType === 'phone') {
    if (!phone || !password) return res.status(400).json({ message: '请填写手机号和密码' })
    if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ message: '手机号格式不正确' })
    user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone)
  } else {
    if (!username || !password) return res.status(400).json({ message: '请填写用户名和密码' })
    user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  }

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: '账号或密码错误' })
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  )

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar
    }
  })
})

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ message: '未登录' })
  try {
    const token = header.replace('Bearer ', '')
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ message: '登录已过期' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '权限不足' })
    }
    next()
  }
}

export { JWT_SECRET }
export default router
