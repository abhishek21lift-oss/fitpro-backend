const express = require('express')
const { auth } = require('../middleware/auth')
const { pool } = require('../db')

const router = express.Router()

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select dp.id, dp.title, dp.total_calories, dp.protein_g, dp.carbs_g, dp.fats_g, dp.water_liters, c.full_name
       from diet_plans dp
       join clients c on c.id = dp.client_id
       where dp.id = $1 and c.trainer_id = $2`,
      [req.params.id, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Diet plan not found' })
    res.json({
      ...result.rows[0],
      meals: [
        { name: 'Breakfast', time: '07:30 AM', foods: 'Oats, whey, banana', calories: 420, protein: 32 },
        { name: 'Lunch', time: '01:00 PM', foods: 'Rice, paneer, salad', calories: 610, protein: 34 },
        { name: 'Dinner', time: '08:30 PM', foods: 'Roti, dal, tofu', calories: 520, protein: 29 }
      ]
    })
  } catch {
    res.status(500).json({ message: 'Failed to fetch diet plan' })
  }
})

router.post('/generate/:clientId', auth, async (req, res) => {
  try {
    const client = await pool.query('select id, full_name from clients where id = $1 and trainer_id = $2', [req.params.clientId, req.user.sub])
    if (!client.rows[0]) return res.status(404).json({ message: 'Client not found' })
    const plan = await pool.query(
      'insert into diet_plans (client_id, title, total_calories, protein_g, carbs_g, fats_g, water_liters) values ($1,$2,$3,$4,$5,$6,$7) returning *',
      [req.params.clientId, `${client.rows[0].full_name} AI Diet`, 2100, 150, 220, 60, 3.5]
    )
    res.status(201).json(plan.rows[0])
  } catch {
    res.status(500).json({ message: 'Failed to generate diet plan' })
  }
})

module.exports = router
