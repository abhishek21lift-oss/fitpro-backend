const express = require('express')
const { auth } = require('../middleware/auth')
const { pool } = require('../db')

const router = express.Router()

function calculateBMR(weightKg, heightCm, age, gender) {
  if (gender === 'Male') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5)
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161)
}

const ACTIVITY_MULTIPLIERS = {
  'Sedentary': 1.2,
  'Lightly Active': 1.375,
  'Moderately Active': 1.55,
  'Very Active': 1.725,
  'Extremely Active': 1.9,
}

function calculateTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55
  return Math.round(bmr * multiplier)
}

function calculateMacros(calorieTarget, goal) {
  const goalProfiles = {
    'Fat Loss': { proteinPct: 35, carbsPct: 30, fatPct: 35 },
    'Muscle Gain': { proteinPct: 30, carbsPct: 45, fatPct: 25 },
    'Strength Gain': { proteinPct: 30, carbsPct: 40, fatPct: 30 },
    'Recomposition': { proteinPct: 35, carbsPct: 35, fatPct: 30 },
    'Powerlifting': { proteinPct: 30, carbsPct: 40, fatPct: 30 },
  }
  const profile = goalProfiles[goal] || goalProfiles['Recomposition']
  return {
    proteinG: Math.round((calorieTarget * profile.proteinPct / 100) / 4),
    carbsG: Math.round((calorieTarget * profile.carbsPct / 100) / 4),
    fatG: Math.round((calorieTarget * profile.fatPct / 100) / 9),
  }
}

function calculateRecoveryScore(sleepHours, stressLevel, activityLevel) {
  let score = 50
  if (sleepHours >= 7 && sleepHours <= 9) score += 20
  else if (sleepHours >= 6) score += 10
  else score -= 10
  if (stressLevel === 'Low') score += 15
  else if (stressLevel === 'Medium') score += 5
  else score -= 10
  if (activityLevel === 'Sedentary' || activityLevel === 'Lightly Active') score += 10
  else if (activityLevel === 'Very Active' || activityLevel === 'Extremely Active') score -= 5
  return Math.max(0, Math.min(100, score))
}

function calculateTrainingVolume(daysPerWeek, durationMinutes) {
  return daysPerWeek * durationMinutes
}

const SPLIT_OPTIONS = {
  'Push/Pull/Legs': { days: [3, 6], desc: 'Classic PPL — 3 or 6 days' },
  'Upper/Lower': { days: [4], desc: 'Upper/Lower split — 4 days' },
  'Bro Split': { days: [5, 6], desc: 'Body part split — 5-6 days' },
  'Full Body': { days: [3], desc: 'Full body — 3 days' },
  'Push/Pull': { days: [4], desc: 'Push/Pull — 4 days' },
}

function selectWorkoutSplit(daysPerWeek, experienceLevel, goal) {
  if (daysPerWeek >= 5 && goal === 'Muscle Gain') return 'Bro Split'
  if (daysPerWeek >= 5 && goal === 'Powerlifting') return 'Push/Pull/Legs'
  if (daysPerWeek >= 4 && experienceLevel === 'Advanced') return 'Upper/Lower'
  if (daysPerWeek >= 3 && daysPerWeek <= 4 && experienceLevel !== 'Beginner') return 'Push/Pull/Legs'
  if (daysPerWeek <= 3) return 'Full Body'
  if (daysPerWeek >= 5) return 'Bro Split'
  if (daysPerWeek >= 4) return 'Upper/Lower'
  return 'Push/Pull/Legs'
}

router.post('/calculate/:clientId', auth, async (req, res) => {
  try {
    const clientResult = await pool.query(
      `select * from clients where id = $1 and trainer_id = $2`,
      [req.params.clientId, req.user.sub]
    )
    const c = clientResult.rows[0]
    if (!c) return res.status(404).json({ message: 'Client not found' })

    const bmr = calculateBMR(Number(c.weight), Number(c.height), c.age, c.gender)
    const tdee = calculateTDEE(bmr, c.activity_level)

    let calorieTarget = tdee
    if (c.goal === 'Fat Loss') calorieTarget = tdee - 500
    else if (c.goal === 'Muscle Gain') calorieTarget = tdee + 300
    else if (c.goal === 'Strength Gain') calorieTarget = tdee + 200
    else if (c.goal === 'Powerlifting') calorieTarget = tdee + 400

    calorieTarget = Math.max(1200, Math.min(5000, calorieTarget))

    const macros = calculateMacros(calorieTarget, c.goal)
    const recoveryScore = calculateRecoveryScore(Number(c.sleep_hours), c.stress_level, c.activity_level)
    const trainingVolumeMinutes = calculateTrainingVolume(c.workout_days_per_week || 3, c.workout_duration_minutes || 45)
    const workoutSplit = selectWorkoutSplit(c.workout_days_per_week || 3, c.experience_level, c.goal)

    await pool.query(
      `update clients set
        bmr = $1, tdee = $2, calorie_target = $3,
        protein_target_g = $4, carbs_target_g = $5, fat_target_g = $6,
        recovery_score = $7, training_volume_minutes = $8, workout_split = $9,
        plan_status = 'calculated', updated_at = now()
       where id = $10`,
      [bmr, tdee, calorieTarget, macros.proteinG, macros.carbsG, macros.fatG,
        recoveryScore, trainingVolumeMinutes, workoutSplit, req.params.clientId]
    )

    res.json({
      bmr, tdee, calorieTarget,
      proteinTargetG: macros.proteinG,
      carbsTargetG: macros.carbsG,
      fatTargetG: macros.fatG,
      recoveryScore,
      trainingVolumeMinutes,
      workoutSplit,
    })
  } catch (err) {
    res.status(500).json({ message: 'Calculation failed', error: err.message })
  }
})

router.get('/splits', auth, async (_req, res) => {
  res.json(SPLIT_OPTIONS)
})

module.exports = { router, calculateBMR, calculateTDEE, calculateMacros, calculateRecoveryScore, selectWorkoutSplit, SPLIT_OPTIONS }
