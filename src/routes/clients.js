const express = require('express')
const { auth } = require('../middleware/auth')
const { pool } = require('../db')

const router = express.Router()

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'select id, full_name, age, gender, goal, diet_type, weight, height, workout_time, created_at from clients where trainer_id = $1 order by created_at desc',
      [req.user.sub]
    )
    res.json(result.rows)
  } catch {
    res.status(500).json({ message: 'Failed to fetch clients' })
  }
})

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'select id, full_name, age, gender, goal, diet_type, weight, height, workout_time, created_at from clients where id = $1 and trainer_id = $2',
      [req.params.id, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Client not found' })
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ message: 'Failed to fetch client' })
  }
})

router.post('/', auth, async (req, res) => {
  const { fullName, age, gender, goal, dietType, weight, height, workoutTime } = req.body
  try {
    const result = await pool.query(
      'insert into clients (trainer_id, full_name, age, gender, goal, diet_type, weight, height, workout_time) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',
      [req.user.sub, fullName, age, gender, goal, dietType, weight, height, workoutTime]
    )
    res.status(201).json(result.rows[0])
  } catch {
    res.status(500).json({ message: 'Failed to create client' })
  }
})

router.patch('/:id', auth, async (req, res) => {
  const { fullName, goal, dietType, weight, workoutTime } = req.body
  try {
    const result = await pool.query(
      'update clients set full_name = $1, goal = $2, diet_type = $3, weight = $4, workout_time = $5 where id = $6 and trainer_id = $7 returning *',
      [fullName, goal, dietType, weight, workoutTime, req.params.id, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Client not found' })
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ message: 'Failed to update client' })
  }
})

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('delete from clients where id = $1 and trainer_id = $2 returning id', [req.params.id, req.user.sub])
    if (!result.rows[0]) return res.status(404).json({ message: 'Client not found' })
    res.json({ success: true })
  } catch {
    res.status(500).json({ message: 'Failed to delete client' })
  }
})

router.get('/:id/progress', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select pl.id, pl.weight, pl.note, pl.created_at
       from progress_logs pl
       join clients c on c.id = pl.client_id
       where pl.client_id = $1 and c.trainer_id = $2
       order by pl.created_at asc`,
      [req.params.id, req.user.sub]
    )
    res.json(result.rows)
  } catch {
    res.status(500).json({ message: 'Failed to fetch progress' })
  }
})

router.post('/:id/progress', auth, async (req, res) => {
  const { weight, note } = req.body
  try {
    const result = await pool.query(
      `insert into progress_logs (client_id, weight, note)
       select $1, $2, $3
       where exists (select 1 from clients where id = $1 and trainer_id = $4)
       returning *`,
      [req.params.id, weight, note, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Client not found' })
    res.status(201).json(result.rows[0])
  } catch {
    res.status(500).json({ message: 'Failed to add progress' })
  }
})

module.exports = router
