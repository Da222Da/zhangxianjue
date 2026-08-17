import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { initDb, getDb, setDbPath } from './db.js'
import authRoutes, { authMiddleware, requireRole } from './routes/auth.js'
import userRoutes from './routes/users.js'
import bookRoutes from './routes/books.js'
import dataRoutes from './routes/data.js'
import predictRoutes from './routes/predict.js'
import settingsRoutes from './routes/settings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 3001
const dataDir = path.join(__dirname, 'data')

const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use('/uploads', express.static(uploadDir))

initDb()

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/books', bookRoutes)
app.use('/api/data', dataRoutes)
app.use('/api/predict', predictRoutes)
app.use('/api/settings', settingsRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: getDb() ? 'connected' : 'disconnected' })
})

app.post('/api/db/connect', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { dbPath } = req.body
    if (!dbPath) return res.status(400).json({ message: '请提供数据库路径' })
    const resolved = path.resolve(dbPath)
    if (!resolved.startsWith(path.resolve(dataDir)) && !resolved.endsWith('.db')) {
      return res.status(400).json({ message: '仅允许连接 .db 数据库文件' })
    }
    setDbPath(resolved)
    initDb()
    res.json({ message: '数据库连接成功', path: resolved })
  } catch (e) {
    res.status(500).json({ message: '连接失败: ' + e.message })
  }
})

app.get('/api/db/info', authMiddleware, requireRole('admin'), (_req, res) => {
  res.json({ path: process.env.DB_PATH || path.join(dataDir, 'books.db') })
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
