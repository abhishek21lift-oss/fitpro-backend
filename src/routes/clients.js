const express = require('express')
const { auth } = require('../middleware/auth')
const { pool } = require('../db')

const router = express.Router()

const CLIENT_FIELDS = `
  id, full_name, age, gender, height, weight, body_fat_percentage,
  goal, secondary_goals,
  medical_conditions, medications, allergies, injuries, surgeries,
  diet_type, food_likes, food_dislikes, budget_per_meal, water_intake_cups, meal_frequency,
  experience_level, workout_days_per_week, workout_duration_minutes,
  equipment_available, strength_levels, mobility_issues,
  occupation, activity_level, sleep_hours, stress_level,
  bmr, tdee, calorie_target, protein_target_g, carbs_target_g, fat_target_g,
  recovery_score, training_volume_minutes, workout_split, plan_status,
  created_at, updated_at
`

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select ${CLIENT_FIELDS} from clients where trainer_id = $1 order by created_at desc`,
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
      `select ${CLIENT_FIELDS} from clients where id = $1 and trainer_id = $2`,
      [req.params.id, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Client not found' })
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ message: 'Failed to fetch client' })
  }
})

router.post('/', auth, async (req, res) => {
  const {
    fullName, age, gender, height, weight, bodyFatPercentage,
    goal, secondaryGoals,
    medicalConditions, medications, allergies, injuries, surgeries,
    dietType, foodLikes, foodDislikes, budgetPerMeal, waterIntakeCups, mealFrequency,
    experienceLevel, workoutDaysPerWeek, workoutDurationMinutes,
    equipmentAvailable, strengthLevels, mobilityIssues,
    occupation, activityLevel, sleepHours, stressLevel,
  } = req.body
  try {
    const result = await pool.query(
      `insert into clients (
        trainer_id, full_name, age, gender, height, weight, body_fat_percentage,
        goal, secondary_goals,
        medical_conditions, medications, allergies, injuries, surgeries,
        diet_type, food_likes, food_dislikes, budget_per_meal, water_intake_cups, meal_frequency,
        experience_level, workout_days_per_week, workout_duration_minutes,
        equipment_available, strength_levels, mobility_issues,
        occupation, activity_level, sleep_hours, stress_level
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
      returning ${CLIENT_FIELDS}`,
      [req.user.sub, fullName, age||null, gender, height||null, weight||null, bodyFatPercentage||null,
        goal, secondaryGoals||[],
        medicalConditions, medications, allergies, injuries, surgeries,
        dietType, foodLikes, foodDislikes, budgetPerMeal||null, waterIntakeCups||null, mealFrequency||null,
        experienceLevel, workoutDaysPerWeek||null, workoutDurationMinutes||null,
        equipmentAvailable, strengthLevels, mobilityIssues,
        occupation, activityLevel, sleepHours||null, stressLevel]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ message: 'Failed to create client', error: err.message })
  }
})

router.patch('/:id', auth, async (req, res) => {
  const fields = req.body
  const setClauses = []
  const values = []
  let idx = 1

  const fieldMap = {
    fullName: 'full_name', age: 'age', gender: 'gender',
    height: 'height', weight: 'weight', bodyFatPercentage: 'body_fat_percentage',
    goal: 'goal', secondaryGoals: 'secondary_goals',
    medicalConditions: 'medical_conditions', medications: 'medications',
    allergies: 'allergies', injuries: 'injuries', surgeries: 'surgeries',
    dietType: 'diet_type', foodLikes: 'food_likes', foodDislikes: 'food_dislikes',
    budgetPerMeal: 'budget_per_meal', waterIntakeCups: 'water_intake_cups', mealFrequency: 'meal_frequency',
    experienceLevel: 'experience_level', workoutDaysPerWeek: 'workout_days_per_week',
    workoutDurationMinutes: 'workout_duration_minutes',
    equipmentAvailable: 'equipment_available', strengthLevels: 'strength_levels', mobilityIssues: 'mobility_issues',
    occupation: 'occupation', activityLevel: 'activity_level', sleepHours: 'sleep_hours', stressLevel: 'stress_level',
    bmr: 'bmr', tdee: 'tdee', calorieTarget: 'calorie_target',
    proteinTargetG: 'protein_target_g', carbsTargetG: 'carbs_target_g', fatTargetG: 'fat_target_g',
    recoveryScore: 'recovery_score', trainingVolumeMinutes: 'training_volume_minutes',
    workoutSplit: 'workout_split', planStatus: 'plan_status',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${col} = $${idx}`)
      values.push(fields[key])
      idx++
    }
  }

  if (setClauses.length === 0) return res.status(400).json({ message: 'No fields to update' })

  setClauses.push(`updated_at = now()`)
  values.push(req.params.id, req.user.sub)

  try {
    const result = await pool.query(
      `update clients set ${setClauses.join(', ')} where id = $${idx} and trainer_id = $${idx+1} returning ${CLIENT_FIELDS}`,
      values
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

router.get('/:id/measurements', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select * from body_measurements where client_id = $1
       and exists (select 1 from clients where id = $1 and trainer_id = $2)
       order by measured_at desc`,
      [req.params.id, req.user.sub]
    )
    res.json(result.rows)
  } catch {
    res.status(500).json({ message: 'Failed to fetch measurements' })
  }
})

router.post('/:id/measurements', auth, async (req, res) => {
  const { chestCm, waistCm, hipsCm, armsCm, thighsCm, bodyFatPercentage, notes } = req.body
  try {
    const result = await pool.query(
      `insert into body_measurements (client_id, chest_cm, waist_cm, hips_cm, arms_cm, thighs_cm, body_fat_percentage, notes)
       select $1, $2, $3, $4, $5, $6, $7, $8
       where exists (select 1 from clients where id = $1 and trainer_id = $9)
       returning *`,
      [req.params.id, chestCm||null, waistCm||null, hipsCm||null, armsCm||null, thighsCm||null, bodyFatPercentage||null, notes, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Client not found' })
    res.status(201).json(result.rows[0])
  } catch {
    res.status(500).json({ message: 'Failed to add measurements' })
  }
})

router.get('/:id/adherence', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select * from adherence_logs where client_id = $1
       and exists (select 1 from clients where id = $1 and trainer_id = $2)
       order by log_date desc`,
      [req.params.id, req.user.sub]
    )
    res.json(result.rows)
  } catch {
    res.status(500).json({ message: 'Failed to fetch adherence' })
  }
})

router.post('/:id/adherence', auth, async (req, res) => {
  const { dietAdherence, workoutAdherence, waterCups, sleepHours, moodScore, notes } = req.body
  try {
    const result = await pool.query(
      `insert into adherence_logs (client_id, diet_adherence, workout_adherence, water_cups, sleep_hours, mood_score, notes)
       select $1, $2, $3, $4, $5, $6, $7
       where exists (select 1 from clients where id = $1 and trainer_id = $8)
       returning *`,
      [req.params.id, dietAdherence||0, workoutAdherence||0, waterCups||0, sleepHours||null, moodScore||null, notes, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Client not found' })
    res.status(201).json(result.rows[0])
  } catch {
    res.status(500).json({ message: 'Failed to add adherence' })
  }
})

router.get('/:id/workout-logs', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select * from workout_logs where client_id = $1
       and exists (select 1 from clients where id = $1 and trainer_id = $2)
       order by logged_at desc`,
      [req.params.id, req.user.sub]
    )
    res.json(result.rows)
  } catch {
    res.status(500).json({ message: 'Failed to fetch workout logs' })
  }
})

router.post('/:id/workout-logs', auth, async (req, res) => {
  const { exerciseName, setsCompleted, repsCompleted, weightUsed, rpeActual, notes } = req.body
  try {
    const result = await pool.query(
      `insert into workout_logs (client_id, exercise_name, sets_completed, reps_completed, weight_used, rpe_actual, notes)
       select $1, $2, $3, $4, $5, $6, $7
       where exists (select 1 from clients where id = $1 and trainer_id = $8)
       returning *`,
      [req.params.id, exerciseName, setsCompleted||null, repsCompleted||null, weightUsed||null, rpeActual||null, notes, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Client not found' })
    res.status(201).json(result.rows[0])
  } catch {
    res.status(500).json({ message: 'Failed to add workout log' })
  }
})

module.exports = router
