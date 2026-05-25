require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool } = require('./db')
const clientsRoutes = require('./routes/clients')
const dietsRoutes = require('./routes/diets')
const analyticsRoutes = require('./routes/analytics')
const { auth } = require('./middleware/auth')

const app = express()
const port = process.env.PORT || 5000
const frontendUrl = process.env.FRONTEND_URL

app.use(express.json())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    try {
      const hostname = new URL(origin).hostname
      if (origin === frontendUrl || hostname.endsWith('.vercel.app')) return callback(null, true)
    } catch {}
    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

app.get('/health', async (_req, res) => {
  try {
    const result = await pool.query('select now() as now')
    res.json({ status: 'ok', db: true, now: result.rows[0].now })
  } catch {
    res.status(500).json({ status: 'error', db: false })
  }
})

app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' })
  try {
    const existing = await pool.query('select id from users where email = $1', [email])
    if (existing.rowCount > 0) return res.status(409).json({ message: 'Email already exists' })
    const passwordHash = await bcrypt.hash(password, 10)
    const created = await pool.query(
      'insert into users(name, email, password_hash) values($1, $2, $3) returning id, name, email, created_at',
      [name, email, passwordHash]
    )
    res.status(201).json(created.rows[0])
  } catch {
    res.status(500).json({ message: 'Registration failed' })
  }
})

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ message: 'Missing credentials' })
  try {
    const result = await pool.query('select * from users where email = $1', [email])
    const user = result.rows[0]
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' })
    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } })
  } catch {
    res.status(500).json({ message: 'Login failed' })
  }
})

app.get('/auth/me', auth, async (req, res) => {
  try {
    const result = await pool.query('select id, name, email from users where id = $1', [req.user.sub])
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found' })
    res.json({ user: result.rows[0] })
  } catch {
    res.status(500).json({ message: 'Failed to fetch user' })
  }
})

app.use('/clients', clientsRoutes)
app.use('/diet-plans', dietsRoutes)
app.use('/analytics', analyticsRoutes)

app.listen(port, () => {
  console.log(`Backend running on ${port}`)
})
