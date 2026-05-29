const express = require('express')
const { auth } = require('../middleware/auth')
const { pool } = require('../db')
const { calculateBMR, calculateTDEE, calculateRecoveryScore } = require('./engine')

const router = express.Router()

const EXERCISE_DATABASE = {
  'Push': {
    'Beginner': [
      { name: 'Push-ups', sets: 3, reps: '10-15', rest: 60, rpe: 7 },
      { name: 'Dumbbell Bench Press', sets: 3, reps: '10-12', rest: 60, rpe: 7 },
      { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10-12', rest: 60, rpe: 7 },
      { name: 'Tricep Pushdowns', sets: 3, reps: '12-15', rest: 45, rpe: 7 },
      { name: 'Lateral Raises', sets: 3, reps: '12-15', rest: 45, rpe: 7 },
    ],
    'Intermediate': [
      { name: 'Barbell Bench Press', sets: 4, reps: '8-12', rest: 90, rpe: 8 },
      { name: 'Incline Dumbbell Press', sets: 4, reps: '8-12', rest: 75, rpe: 8 },
      { name: 'Standing Overhead Press', sets: 4, reps: '8-10', rest: 90, rpe: 8 },
      { name: 'Dips', sets: 3, reps: '10-15', rest: 60, rpe: 8 },
      { name: 'Lateral Raises', sets: 4, reps: '12-15', rest: 45, rpe: 7 },
      { name: 'Tricep Rope Pushdowns', sets: 3, reps: '12-15', rest: 45, rpe: 8 },
    ],
    'Advanced': [
      { name: 'Barbell Bench Press', sets: 5, reps: '5-8', rest: 120, rpe: 9 },
      { name: 'Incline Barbell Press', sets: 4, reps: '6-10', rest: 90, rpe: 8 },
      { name: 'Standing Military Press', sets: 4, reps: '6-8', rest: 120, rpe: 9 },
      { name: 'Weighted Dips', sets: 4, reps: '8-12', rest: 90, rpe: 8 },
      { name: 'Cable Flyes', sets: 3, reps: '12-15', rest: 60, rpe: 8 },
      { name: 'Lateral Raises', sets: 4, reps: '12-15', rest: 45, rpe: 8 },
      { name: 'Skull Crushers', sets: 4, reps: '8-12', rest: 60, rpe: 8 },
    ],
  },
  'Pull': {
    'Beginner': [
      { name: 'Lat Pulldowns', sets: 3, reps: '10-12', rest: 60, rpe: 7 },
      { name: 'Seated Cable Rows', sets: 3, reps: '10-12', rest: 60, rpe: 7 },
      { name: 'Dumbbell Bicep Curls', sets: 3, reps: '10-12', rest: 45, rpe: 7 },
      { name: 'Face Pulls', sets: 3, reps: '12-15', rest: 45, rpe: 7 },
    ],
    'Intermediate': [
      { name: 'Deadlifts', sets: 4, reps: '6-10', rest: 120, rpe: 8 },
      { name: 'Pull-ups', sets: 4, reps: '8-12', rest: 90, rpe: 8 },
      { name: 'Barbell Rows', sets: 4, reps: '8-12', rest: 75, rpe: 8 },
      { name: 'Face Pulls', sets: 3, reps: '15-20', rest: 45, rpe: 7 },
      { name: 'Hammer Curls', sets: 3, reps: '10-12', rest: 45, rpe: 8 },
      { name: 'Shrugs', sets: 3, reps: '12-15', rest: 60, rpe: 7 },
    ],
    'Advanced': [
      { name: 'Deadlifts', sets: 5, reps: '3-6', rest: 150, rpe: 9 },
      { name: 'Weighted Pull-ups', sets: 4, reps: '6-10', rest: 90, rpe: 9 },
      { name: 'T-Bar Rows', sets: 4, reps: '8-12', rest: 90, rpe: 8 },
      { name: 'Face Pulls', sets: 4, reps: '15-20', rest: 45, rpe: 8 },
      { name: 'Barbell Curls', sets: 4, reps: '8-12', rest: 60, rpe: 8 },
      { name: 'Preacher Curls', sets: 3, reps: '10-12', rest: 60, rpe: 8 },
      { name: 'Dead Hangs', sets: 3, reps: '30-45s', rest: 45, rpe: 7 },
    ],
  },
  'Legs': {
    'Beginner': [
      { name: 'Goblet Squats', sets: 3, reps: '10-15', rest: 60, rpe: 7 },
      { name: 'Leg Press', sets: 3, reps: '12-15', rest: 60, rpe: 7 },
      { name: 'Romanian Deadlifts (Dumbbell)', sets: 3, reps: '10-12', rest: 60, rpe: 7 },
      { name: 'Leg Curls', sets: 3, reps: '12-15', rest: 45, rpe: 7 },
      { name: 'Calf Raises', sets: 3, reps: '15-20', rest: 45, rpe: 7 },
    ],
    'Intermediate': [
      { name: 'Barbell Squats', sets: 4, reps: '8-12', rest: 120, rpe: 8 },
      { name: 'Romanian Deadlifts', sets: 4, reps: '8-12', rest: 90, rpe: 8 },
      { name: 'Leg Press', sets: 4, reps: '10-15', rest: 75, rpe: 8 },
      { name: 'Walking Lunges', sets: 3, reps: '10-12/leg', rest: 60, rpe: 8 },
      { name: 'Leg Extensions', sets: 3, reps: '12-15', rest: 45, rpe: 8 },
      { name: 'Seated Calf Raises', sets: 4, reps: '12-15', rest: 45, rpe: 7 },
    ],
    'Advanced': [
      { name: 'Barbell Squats', sets: 5, reps: '5-8', rest: 150, rpe: 9 },
      { name: 'Romanian Deadlifts', sets: 4, reps: '6-10', rest: 120, rpe: 9 },
      { name: 'Bulgarian Split Squats', sets: 4, reps: '8-12', rest: 90, rpe: 8 },
      { name: 'Leg Press', sets: 4, reps: '10-15', rest: 90, rpe: 8 },
      { name: 'Nordic Curls', sets: 3, reps: '8-12', rest: 60, rpe: 8 },
      { name: 'Standing Calf Raises', sets: 4, reps: '10-15', rest: 45, rpe: 8 },
      { name: 'Hip Thrusts', sets: 4, reps: '10-15', rest: 90, rpe: 8 },
    ],
  },
  'Core': {
    'Beginner': [
      { name: 'Planks', sets: 3, reps: '30-45s', rest: 45, rpe: 7 },
      { name: 'Dead Bugs', sets: 3, reps: '10-12', rest: 45, rpe: 7 },
      { name: 'Bird Dogs', sets: 3, reps: '10-12', rest: 45, rpe: 7 },
    ],
    'Intermediate': [
      { name: 'Cable Crunches', sets: 3, reps: '12-15', rest: 45, rpe: 8 },
      { name: 'Hanging Leg Raises', sets: 3, reps: '10-15', rest: 45, rpe: 8 },
      { name: 'Pallof Press', sets: 3, reps: '10-12/side', rest: 45, rpe: 7 },
      { name: 'Ab Wheel Rollouts', sets: 3, reps: '8-12', rest: 45, rpe: 8 },
    ],
    'Advanced': [
      { name: 'Weighted Cable Crunches', sets: 4, reps: '12-15', rest: 45, rpe: 8 },
      { name: 'Dragon Flags', sets: 3, reps: '8-12', rest: 60, rpe: 9 },
      { name: 'Hanging Leg Raises (weighted)', sets: 3, reps: '10-15', rest: 45, rpe: 8 },
      { name: 'Pallof Press', sets: 3, reps: '12-15/side', rest: 45, rpe: 8 },
      { name: 'Ab Wheel Rollouts', sets: 3, reps: '10-15', rest: 45, rpe: 8 },
    ],
  },
}

function generateSplit(workoutSplit, experienceLevel, goal, daysPerWeek) {
  const exLvl = experienceLevel || 'Intermediate'
  const lowerExLvl = exLvl.toLowerCase()
  const level = lowerExLvl === 'beginner' ? 'Beginner' : lowerExLvl === 'advanced' ? 'Advanced' : 'Intermediate'

  const splits = {
    'Full Body': [
      { day: 'Day 1', focus: 'Full Body A', muscleGroups: ['Push', 'Pull', 'Legs', 'Core'] },
      { day: 'Day 2', focus: 'Full Body B', muscleGroups: ['Push', 'Pull', 'Legs', 'Core'] },
      { day: 'Day 3', focus: 'Full Body C', muscleGroups: ['Push', 'Pull', 'Legs', 'Core'] },
    ],
    'Push/Pull/Legs': [
      { day: 'Day 1', focus: 'Push (Chest, Shoulders, Triceps)', muscleGroups: ['Push'] },
      { day: 'Day 2', focus: 'Pull (Back, Biceps, Rear Delts)', muscleGroups: ['Pull'] },
      { day: 'Day 3', focus: 'Legs + Core', muscleGroups: ['Legs', 'Core'] },
      { day: 'Day 4', focus: 'Push (Chest, Shoulders, Triceps)', muscleGroups: ['Push'] },
      { day: 'Day 5', focus: 'Pull (Back, Biceps, Rear Delts)', muscleGroups: ['Pull'] },
      { day: 'Day 6', focus: 'Legs + Core', muscleGroups: ['Legs', 'Core'] },
    ],
    'Upper/Lower': [
      { day: 'Day 1', focus: 'Upper Body A (Chest/Back focus)', muscleGroups: ['Push', 'Pull'] },
      { day: 'Day 2', focus: 'Lower Body A (Quad focus)', muscleGroups: ['Legs', 'Core'] },
      { day: 'Day 3', focus: 'Upper Body B (Shoulders/Arms focus)', muscleGroups: ['Push', 'Pull'] },
      { day: 'Day 4', focus: 'Lower Body B (Posterior chain focus)', muscleGroups: ['Legs', 'Core'] },
    ],
    'Bro Split': [
      { day: 'Day 1', focus: 'Chest + Triceps', muscleGroups: ['Push'] },
      { day: 'Day 2', focus: 'Back + Biceps', muscleGroups: ['Pull'] },
      { day: 'Day 3', focus: 'Shoulders + Abs', muscleGroups: ['Push', 'Core'] },
      { day: 'Day 4', focus: 'Legs', muscleGroups: ['Legs'] },
      { day: 'Day 5', focus: 'Arms + Abs', muscleGroups: ['Push', 'Pull', 'Core'] },
    ],
    'Push/Pull': [
      { day: 'Day 1', focus: 'Push (Chest/Shoulders/Triceps)', muscleGroups: ['Push'] },
      { day: 'Day 2', focus: 'Pull (Back/Biceps)', muscleGroups: ['Pull'] },
      { day: 'Day 3', focus: 'Legs + Core', muscleGroups: ['Legs', 'Core'] },
      { day: 'Day 4', focus: 'Push (Chest/Shoulders/Triceps)', muscleGroups: ['Push'] },
    ],
  }

  const selectedSplit = splits[workoutSplit] || splits['Push/Pull/Legs']
  const limited = selectedSplit.slice(0, daysPerWeek)

  return limited.map(d => ({
    ...d,
    exercises: d.muscleGroups.flatMap(group =>
      (EXERCISE_DATABASE[group]?.[level] || []).slice(0, 4)
    ),
  }))
}

function getCardioRecommendation(goal, recoveryScore, activityLevel) {
  const cardio = []
  if (goal === 'Fat Loss') {
    cardio.push('LISS: 30-45 min walking/stairmaster at 120-140 BPM heart rate, 3-4x/week')
    cardio.push('HIIT: 15-20 min sprints/cycling, 2x/week (on leg days or off days)')
  } else if (goal === 'Muscle Gain') {
    cardio.push('Minimal cardio: 10-15 min warm-up before each session')
    cardio.push('Optional: 20 min LISS on rest days for heart health, 2x/week')
  } else if (goal === 'Powerlifting' || goal === 'Strength Gain') {
    cardio.push('Warm-up: 5-10 min incline walk before training')
    cardio.push('Conditioning: 15-20 min sled pushes/farmer walks, 2x/week')
  } else {
    cardio.push('Moderate cardio: 20-30 min incline walk or cycling, 3x/week')
  }
  if (recoveryScore < 50) {
    cardio.push('Warning: Low recovery score. Consider reducing cardio volume.')
  }
  return cardio.join('. ')
}

function getProgressionPlan(experienceLevel, goal) {
  const plans = {
    'Beginner': 'Linear progression: Add 2.5-5kg to main lifts every session. Focus on form first 2 weeks.',
    'Intermediate': 'Double progression: Add reps until top of range, then increase weight. Deload every 4-6 weeks.',
    'Advanced': 'Periodized progression: 4-week blocks (hypertrophy -> strength -> peaking). RPE-based auto-regulation.',
  }
  const base = plans[experienceLevel] || plans['Intermediate']
  if (goal === 'Powerlifting') {
    return base + ' Featured: Competition peaking block last 3 weeks before meet.'
  }
  return base
}

router.get('/by-client/:clientId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select * from workout_plans wp
       join clients c on c.id = wp.client_id
       where wp.client_id = $1 and c.trainer_id = $2
       order by wp.created_at desc`,
      [req.params.clientId, req.user.sub]
    )
    const plans = result.rows
    for (const plan of plans) {
      const daysResult = await pool.query(
        'select * from workout_days where workout_plan_id = $1 order by sort_order',
        [plan.id]
      )
      plan.days = []
      for (const day of daysResult.rows) {
        const exResult = await pool.query(
          'select * from exercises where workout_day_id = $1 order by sort_order',
          [day.id]
        )
        plan.days.push({ ...day, exercises: exResult.rows })
      }
    }
    res.json(plans)
  } catch {
    res.status(500).json({ message: 'Failed to fetch workout plans' })
  }
})

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select wp.*, c.full_name
       from workout_plans wp
       join clients c on c.id = wp.client_id
       where wp.id = $1 and c.trainer_id = $2`,
      [req.params.id, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Workout plan not found' })
    const plan = result.rows[0]
    const daysResult = await pool.query(
      'select * from workout_days where workout_plan_id = $1 order by sort_order',
      [plan.id]
    )
    plan.days = []
    for (const day of daysResult.rows) {
      const exResult = await pool.query(
        'select * from exercises where workout_day_id = $1 order by sort_order',
        [day.id]
      )
      plan.days.push({ ...day, exercises: exResult.rows })
    }
    res.json(plan)
  } catch {
    res.status(500).json({ message: 'Failed to fetch workout plan' })
  }
})

router.post('/generate/:clientId', auth, async (req, res) => {
  try {
    const clientResult = await pool.query(
      `select * from clients where id = $1 and trainer_id = $2`,
      [req.params.clientId, req.user.sub]
    )
    const c = clientResult.rows[0]
    if (!c) return res.status(404).json({ message: 'Client not found' })

    const daysPerWeek = c.workout_days_per_week || 3
    const exLvl = c.experience_level || 'Intermediate'
    const goal = c.goal || 'Recomposition'
    const recoveryScore = c.recovery_score || calculateRecoveryScore(Number(c.sleep_hours), c.stress_level, c.activity_level)
    const splitType = c.workout_split || 'Push/Pull/Legs'

    const splitDays = generateSplit(splitType, exLvl, goal, daysPerWeek)
    const cardioRec = getCardioRecommendation(goal, recoveryScore, c.activity_level)
    const progressionPlan = getProgressionPlan(exLvl, goal)
    const totalVolume = splitDays.reduce((s, d) => s + d.exercises.reduce((ss, e) => ss + e.sets, 0), 0)
    const avgRest = splitDays.length > 0
      ? Math.round(splitDays[0].exercises.reduce((s, e) => s + e.rest, 0) / splitDays[0].exercises.length)
      : 60

    const plan = await pool.query(
      `insert into workout_plans (client_id, title, split_type, days_per_week, session_duration_minutes, cardio_recommendation, progression_plan)
       values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [req.params.clientId, `${c.full_name} — ${splitType} Workout Plan`, splitType, daysPerWeek, c.workout_duration_minutes || 45, cardioRec, progressionPlan]
    )

    for (let d = 0; d < splitDays.length; d++) {
      const day = splitDays[d]
      const dayResult = await pool.query(
        `insert into workout_days (workout_plan_id, day_name, focus, sort_order) values ($1,$2,$3,$4) returning *`,
        [plan.rows[0].id, day.day, day.focus, d + 1]
      )

      for (let e = 0; e < day.exercises.length; e++) {
        const ex = day.exercises[e]
        await pool.query(
          `insert into exercises (workout_day_id, name, sets, reps, rest_seconds, rpe, notes, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [dayResult.rows[0].id, ex.name, ex.sets, ex.reps, ex.rest, ex.rpe, null, e + 1]
        )
      }
    }

    const fullPlan = await pool.query(
      'select * from workout_plans where id = $1',
      [plan.rows[0].id]
    )
    const daysResult = await pool.query(
      'select * from workout_days where workout_plan_id = $1 order by sort_order',
      [plan.rows[0].id]
    )
    const days = []
    for (const day of daysResult.rows) {
      const exResult = await pool.query(
        'select * from exercises where workout_day_id = $1 order by sort_order',
        [day.id]
      )
      days.push({ ...day, exercises: exResult.rows })
    }

    res.status(201).json({ ...fullPlan.rows[0], days })
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate workout plan', error: err.message })
  }
})

router.patch('/:id', auth, async (req, res) => {
  const { splitType, daysPerWeek, sessionDurationMinutes, cardioRecommendation, progressionPlan, trainerNotes, status } = req.body
  try {
    const result = await pool.query(
      `update workout_plans set
        split_type = coalesce($1, split_type),
        days_per_week = coalesce($2, days_per_week),
        session_duration_minutes = coalesce($3, session_duration_minutes),
        cardio_recommendation = coalesce($4, cardio_recommendation),
        progression_plan = coalesce($5, progression_plan),
        trainer_notes = coalesce($6, trainer_notes),
        status = coalesce($7, status),
        version = version + 1,
        updated_at = now()
       from clients
       where workout_plans.id = $8 and workout_plans.client_id = clients.id and clients.trainer_id = $9
       returning workout_plans.*`,
      [splitType, daysPerWeek, sessionDurationMinutes, cardioRecommendation, progressionPlan, trainerNotes, status, req.params.id, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Workout plan not found' })
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ message: 'Failed to update workout plan' })
  }
})

module.exports = router
