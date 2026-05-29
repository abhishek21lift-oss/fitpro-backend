const express = require('express')
const { auth } = require('../middleware/auth')
const { pool } = require('../db')

const router = express.Router()

router.get('/dashboard', auth, async (req, res) => {
  try {
    const uid = req.user.sub

    const totalClients = await pool.query('select count(*)::int as count from clients where trainer_id = $1', [uid])
    const activePlans = await pool.query(
      'select count(*)::int as count from diet_plans dp join clients c on c.id = dp.client_id where c.trainer_id = $1',
      [uid]
    )
    const workoutPlansCount = await pool.query(
      'select count(*)::int as count from workout_plans wp join clients c on c.id = wp.client_id where c.trainer_id = $1',
      [uid]
    )
    const recentClients = await pool.query(
      `select id, full_name, goal, diet_type, weight, calorie_target, plan_status
       from clients where trainer_id = $1
       order by created_at desc limit 10`,
      [uid]
    )
    const recentActivity = await pool.query(
      `(select 'progress' as type, concat(c.full_name, ' logged weight: ', pl.weight, 'kg') as text, pl.created_at as ts
        from progress_logs pl join clients c on c.id = pl.client_id where c.trainer_id = $1)
       union all
       (select 'diet_plan' as type, concat(c.full_name, ' diet plan generated (', dp.total_calories, ' kcal)') as text, dp.created_at as ts
        from diet_plans dp join clients c on c.id = dp.client_id where c.trainer_id = $1)
       union all
       (select 'workout_plan' as type, concat(c.full_name, ' workout plan generated (', wp.split_type, ')') as text, wp.created_at as ts
        from workout_plans wp join clients c on c.id = wp.client_id where c.trainer_id = $1)
       order by ts desc limit 10`,
      [uid]
    )

    const count = totalClients.rows[0].count

    res.json({
      totalClients: count,
      activePlans: activePlans.rows[0].count,
      workoutPlans: workoutPlansCount.rows[0].count,
      revenue: count * 5000,
      successRate: count > 0 ? Math.round((activePlans.rows[0].count / count) * 100) : 0,
      recentClients: recentClients.rows,
      recentActivity: recentActivity.rows,
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to load analytics', error: err.message })
  }
})

module.exports = router
