const express = require('express')
const { auth } = require('../middleware/auth')
const { pool } = require('../db')
const { calculateBMR, calculateTDEE, calculateMacros } = require('./engine')

const router = express.Router()

router.post('/:clientId', auth, async (req, res) => {
  try {
    const clientResult = await pool.query(
      `select * from clients where id = $1 and trainer_id = $2`,
      [req.params.clientId, req.user.sub]
    )
    const c = clientResult.rows[0]
    if (!c) return res.status(404).json({ message: 'Client not found' })

    const progressResult = await pool.query(
      `select * from progress_logs where client_id = $1 order by created_at asc`,
      [req.params.clientId]
    )
    const progress = progressResult.rows

    const adherenceResult = await pool.query(
      `select * from adherence_logs where client_id = $1 order by log_date desc limit 30`,
      [req.params.clientId]
    )
    const adherence = adherenceResult.rows

    const measurementsResult = await pool.query(
      `select * from body_measurements where client_id = $1 order by measured_at desc limit 2`,
      [req.params.clientId]
    )
    const measurements = measurementsResult.rows

    const latestPlan = await pool.query(
      `select * from diet_plans where client_id = $1 order by version desc limit 1`,
      [req.params.clientId]
    )

    const latestWorkout = await pool.query(
      `select * from workout_plans where client_id = $1 order by version desc limit 1`,
      [req.params.clientId]
    )

    const analysis = {
      clientId: c.id,
      clientName: c.full_name,
      goal: c.goal,
      originalWeight: Number(c.weight),
    }

    // Weight trend
    if (progress.length >= 2) {
      const firstWeight = Number(progress[0].weight)
      const lastWeight = Number(progress[progress.length - 1].weight)
      const weightChange = lastWeight - firstWeight
      const weeksElapsed = Math.max(1, Math.round((new Date(progress[progress.length - 1].created_at) - new Date(progress[0].created_at)) / (7 * 86400000)))
      analysis.weightChange = Math.round(weightChange * 10) / 10
      analysis.weeklyRate = Math.round((weightChange / weeksElapsed) * 10) / 10
      analysis.goalAligned = isGoalAligned(c.goal, weightChange, weeksElapsed)
    } else {
      analysis.weightChange = 0
      analysis.weeklyRate = 0
      analysis.goalAligned = 'insufficient_data'
    }

    // Adherence analysis
    if (adherence.length > 0) {
      const avgDietAdherence = Math.round(adherence.reduce((s, a) => s + a.diet_adherence, 0) / adherence.length)
      const avgWorkoutAdherence = Math.round(adherence.reduce((s, a) => s + a.workout_adherence, 0) / adherence.length)
      const avgWater = Math.round((adherence.reduce((s, a) => s + Number(a.water_cups), 0) / adherence.length) * 10) / 10
      analysis.avgDietAdherence = avgDietAdherence
      analysis.avgWorkoutAdherence = avgWorkoutAdherence
      analysis.avgWaterCups = avgWater
    }

    // Measurements
    if (measurements.length >= 2) {
      const m1 = measurements[1]
      const m2 = measurements[0]
      const changes = {}
      if (m1.chest_cm && m2.chest_cm) changes.chestCm = Math.round((Number(m2.chest_cm) - Number(m1.chest_cm)) * 10) / 10
      if (m1.waist_cm && m2.waist_cm) changes.waistCm = Math.round((Number(m2.waist_cm) - Number(m1.waist_cm)) * 10) / 10
      if (m1.hips_cm && m2.hips_cm) changes.hipsCm = Math.round((Number(m2.hips_cm) - Number(m1.hips_cm)) * 10) / 10
      if (m1.arms_cm && m2.arms_cm) changes.armsCm = Math.round((Number(m2.arms_cm) - Number(m1.arms_cm)) * 10) / 10
      if (m1.thighs_cm && m2.thighs_cm) changes.thighsCm = Math.round((Number(m2.thighs_cm) - Number(m1.thighs_cm)) * 10) / 10
      if (m1.body_fat_percentage && m2.body_fat_percentage) {
        changes.bodyFatChange = Math.round((Number(m1.body_fat_percentage) - Number(m2.body_fat_percentage)) * 10) / 10
      }
      analysis.measurementChanges = changes
    }

    // Recommendations
    const recommendations = []

    if (analysis.goalAligned === 'off_track') {
      recommendations.push('Progress is off track. Consider adjusting calorie target.')
      if (c.goal === 'Fat Loss' && analysis.weeklyRate > 0) {
        recommendations.push('Client is gaining weight during a fat loss phase. Reduce calories by 200-300kcal.')
      }
      if (c.goal === 'Muscle Gain' && analysis.weeklyRate < 0) {
        recommendations.push('Client is losing weight during a muscle gain phase. Increase calories by 200-300kcal.')
      }
    }

    if (analysis.avgDietAdherence < 70) {
      recommendations.push('Diet adherence is below 70%. Consider simplifying the meal plan or checking for food preferences.')
    }
    if (analysis.avgWorkoutAdherence < 70) {
      recommendations.push('Workout adherence is below 70%. Consider adjusting split or session duration.')
    }
    if (analysis.avgWaterCups < 8) {
      recommendations.push('Water intake is below target. Client should aim for 8-12 cups/day.')
    }

    // Calorie/macro recalculation
    let newCalorieTarget = c.calorie_target
    let recalculationNeeded = false

    if (progress.length >= 2 && c.calorie_target) {
      if (c.goal === 'Fat Loss' && analysis.weeklyRate > 0.5) {
        newCalorieTarget = c.calorie_target - 200
        recalculationNeeded = true
        recommendations.push(`Reduce calories from ${c.calorie_target} to ${newCalorieTarget} kcal (current gain rate: ${analysis.weeklyRate}kg/week)`)
      } else if (c.goal === 'Muscle Gain' && analysis.weeklyRate < -0.3) {
        newCalorieTarget = c.calorie_target + 250
        recalculationNeeded = true
        recommendations.push(`Increase calories from ${c.calorie_target} to ${newCalorieTarget} kcal (current loss rate: ${analysis.weeklyRate}kg/week)`)
      } else if (c.goal === 'Fat Loss' && analysis.weeklyRate > 1) {
        newCalorieTarget = c.calorie_target - 100
        recalculationNeeded = true
        recommendations.push('Weight loss rate is too fast (>1kg/week). Slight calorie increase recommended to preserve muscle.')
      }
    }

    if (recalculationNeeded) {
      const macros = calculateMacros(newCalorieTarget, c.goal)
      analysis.suggestedCalories = newCalorieTarget
      analysis.suggestedProteinG = macros.proteinG
      analysis.suggestedCarbsG = macros.carbsG
      analysis.suggestedFatG = macros.fatG
    }

    // Workout volume suggestion
    const avgWorkoutAdherenceVal = analysis.avgWorkoutAdherence || 100
    if (avgWorkoutAdherenceVal < 60 && c.workout_days_per_week > 3) {
      analysis.suggestedWorkoutDays = c.workout_days_per_week - 1
      recommendations.push(`Reduce training frequency from ${c.workout_days_per_week} to ${c.workout_days_per_week - 1} days/week to improve adherence.`)
    }

    analysis.recommendations = recommendations

    // Save analysis results
    if (recalculationNeeded && newCalorieTarget !== c.calorie_target) {
      const macros = calculateMacros(newCalorieTarget, c.goal)
      await pool.query(
        `update clients set
          calorie_target = $1, protein_target_g = $2, carbs_target_g = $3, fat_target_g = $4,
          plan_status = 'needs_update', updated_at = now()
         where id = $5`,
        [newCalorieTarget, macros.proteinG, macros.carbsG, macros.fatG, req.params.clientId]
      )
    }

    res.json(analysis)
  } catch (err) {
    res.status(500).json({ message: 'Re-evaluation failed', error: err.message })
  }
})

function isGoalAligned(goal, weightChange, weeksElapsed) {
  const weeklyRate = weightChange / weeksElapsed
  switch (goal) {
    case 'Fat Loss':
      if (weeklyRate < -0.5 && weeklyRate > -1) return 'on_track'
      if (weeklyRate <= -1) return 'too_fast'
      if (weeklyRate >= 0) return 'off_track'
      return 'slow'
    case 'Muscle Gain':
    case 'Strength Gain':
      if (weeklyRate > 0.2 && weeklyRate < 0.5) return 'on_track'
      if (weeklyRate <= 0) return 'off_track'
      if (weeklyRate >= 0.5) return 'too_fast'
      return 'slow'
    case 'Powerlifting':
      if (weeklyRate > 0.3 && weeklyRate < 0.7) return 'on_track'
      if (weeklyRate <= 0) return 'off_track'
      return 'slow'
    default:
      if (Math.abs(weeklyRate) < 0.3) return 'maintained'
      if (weeklyRate < -0.3) return 'losing'
      return 'gaining'
  }
}

module.exports = router
