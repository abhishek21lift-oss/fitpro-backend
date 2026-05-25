const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function initSchema() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db-schema.sql'), 'utf-8')
    await pool.query(sql)
  } catch (err) {
    console.error('Schema init error:', err.message)
  }
}

module.exports = { pool, initSchema }
