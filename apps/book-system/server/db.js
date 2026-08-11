import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'books.db')
let db = null

export function setDbPath(p) {
  dbPath = p
  process.env.DB_PATH = p
  if (db) {
    db.close()
    db = null
  }
}

export function getDb() {
  return db
}

export function initDb() {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'user',
      avatar TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT,
      category TEXT,
      publisher TEXT,
      isbn TEXT,
      rating REAL DEFAULT 0,
      recommend_score REAL DEFAULT 0,
      cover_url TEXT,
      description TEXT,
      publish_year INTEGER,
      pages INTEGER,
      price REAL,
      stock INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      book_id INTEGER,
      score REAL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(book_id) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS recommend_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      book_id INTEGER,
      model_type TEXT,
      score REAL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      count INTEGER DEFAULT 0
    );
  `)

  seedData()
  return db
}

function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10)
    const userHash = bcrypt.hashSync('user123', 10)
    const insert = db.prepare(
      'INSERT INTO users (username, password, phone, role) VALUES (?, ?, ?, ?)'
    )
    insert.run('admin', hash, '13800000001', 'admin')
    insert.run('editor', bcrypt.hashSync('editor123', 10), '13800000002', 'editor')
    insert.run('user1', userHash, '13800000003', 'user')
    insert.run('user2', userHash, '13900000004', 'user')
  }

  const bookCount = db.prepare('SELECT COUNT(*) as c FROM books').get().c
  if (bookCount === 0) {
    const categories = ['文学', '科技', '历史', '哲学', '艺术', '经济', '教育', '生活', '少儿', '计算机']
    const catInsert = db.prepare('INSERT OR IGNORE INTO categories (name, count) VALUES (?, ?)')
    categories.forEach((c) => catInsert.run(c, 0))

    const authors = ['余华', '莫言', '刘慈欣', '东野圭吾', '村上春树', '王小波', '钱钟书', '鲁迅', '金庸', '张爱玲', '霍金', '吴军', '李笑来', '吴晓波', '柴静']
    const publishers = ['人民文学出版社', '中信出版社', '商务印书馆', '三联书店', '机械工业出版社', '清华大学出版社', '电子工业出版社', '译林出版社']
    const titles = [
      '活着', '三体', '百年孤独', '围城', '平凡的世界', '解忧杂货店', '白夜行', '嫌疑人X的献身',
      '时间简史', '深度学习', '算法导论', '人类简史', '明朝那些事儿', '红楼梦', '西游记',
      '呐喊', '朝花夕拾', '边城', '骆驼祥子', '追风筝的人', '小王子', '月亮与六便士',
      '乌合之众', '思考快与慢', '原则', '从0到1', '黑客与画家', '代码大全', '设计模式',
      '机器学习实战', '统计学习方法', '推荐系统实践', '神经网络与深度学习', 'Python编程',
      'JavaScript高级程序设计', 'Vue.js设计与实现', '数据结构与算法分析', '计算机网络',
      '操作系统概念', '数据库系统概念', '编译原理', '人工智能：现代方法', '模式识别',
      '自然语言处理', '计算机视觉', '强化学习', '图神经网络', 'Transformer详解',
      '大模型基础', '个性化推荐算法'
    ]

    const insert = db.prepare(`
      INSERT INTO books (title, author, category, publisher, isbn, rating, recommend_score, description, publish_year, pages, price, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertMany = db.transaction(() => {
      for (let i = 0; i < titles.length; i++) {
        const cat = categories[i % categories.length]
        insert.run(
          titles[i],
          authors[i % authors.length],
          cat,
          publishers[i % publishers.length],
          '9787' + String(1000000000 + i).slice(0, 9),
          +(Math.random() * 2 + 3).toFixed(1),
          +(Math.random() * 40 + 60).toFixed(1),
          `《${titles[i]}》是一部深受读者喜爱的${cat}类图书，适合深度学习推荐系统演示。`,
          2000 + (i % 25),
          200 + (i % 50) * 10,
          +(Math.random() * 80 + 20).toFixed(1),
          Math.floor(Math.random() * 500 + 50)
        )
        db.prepare('UPDATE categories SET count = count + 1 WHERE name = ?').run(cat)
      }
    })
    insertMany()

    const ratingInsert = db.prepare('INSERT INTO ratings (user_id, book_id, score) VALUES (?, ?, ?)')
    const logInsert = db.prepare(
      'INSERT INTO recommend_logs (user_id, book_id, model_type, score) VALUES (?, ?, ?, ?)'
    )
    const models = ['NCF', 'Wide&Deep', 'DeepFM', 'DIN', 'Transformer']
    const seedRatings = db.transaction(() => {
      for (let u = 1; u <= 4; u++) {
        for (let b = 1; b <= 30; b++) {
          if (Math.random() > 0.4) {
            ratingInsert.run(u, b, +(Math.random() * 2 + 3).toFixed(1))
            logInsert.run(u, b, models[b % models.length], +(Math.random() * 0.4 + 0.6).toFixed(3))
          }
        }
      }
    })
    seedRatings()
  }

  const styleCount = db.prepare("SELECT COUNT(*) as c FROM system_settings WHERE key='theme'").get().c
  if (styleCount === 0) {
    db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run(
      'theme',
      JSON.stringify({
        bgColor: '#0a1628',
        bgGradient: 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #0d2137 100%)',
        primaryColor: '#c9a227',
        accentColor: '#4fc3f7',
        textColor: '#e8f0f8',
        fontFamily: '"Noto Serif SC", "Source Han Serif SC", Georgia, serif',
        chartOpacity: 0.85,
        panelBg: 'rgba(10, 30, 55, 0.55)'
      })
    )
  }
}
