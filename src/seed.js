require('dotenv').config()
const bcrypt = require('bcryptjs')
const { pool, initSchema } = require('./db')

async function seed() {
  await initSchema()
  const email = 'admin@fitpro.com'
  const password = 'fitpro123'
  const hash = await bcrypt.hash(password, 10)

  const existing = await pool.query('select id from users where email = $1', [email])
  if (existing.rows.length > 0) {
    console.log('Default user already exists — skipping seed.')
    await pool.end()
    return
  }

  await pool.query(
    'insert into users (name, email, password_hash) values ($1, $2, $3)',
    ['Admin Trainer', email, hash]
  )
  console.log(`Seed complete. Login: ${email} / ${password}`)
  await pool.end()
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1) })
