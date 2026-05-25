const express = require('express')
const { auth } = require('../middleware/auth')
const { pool } = require('../db')

const router = express.Router()

router.get('/dashboard', auth, async (req, res) => {
  try {
    const totalClients = await pool.query('select count(*)::int as count from clients where trainer_id = $1', [req.user.sub])
    const activePlans = await pool.query(
      'select count(*)::int as count from diet_plans dp join clients c on c.id = dp.client_id where c.trainer_id = $1',
      [req.user.sub]
    )
    const paidClients = await pool.query(
      'select count(*)::int as count from clients where trainer_id = $1', // would filter by paid in real app
      [req.user.sub]
    )
    res.json({
      totalClients: totalClients.rows[0].count,
      activePlans: activePlans.rows[0].count,
      revenue: paidClients.rows[0].count * 5000,
      successRate: totalClients.rows[0].count > 0
        ? Math.round((activePlans.rows[0].count / totalClients.rows[0].count) * 100)
        : 0,
    })
  } catch {
    res.status(500).json({ message: 'Failed to load analytics' })
  }
})

module.exports = router
