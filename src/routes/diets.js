const express = require('express')
const { auth } = require('../middleware/auth')
const { pool } = require('../db')

const router = express.Router()

const MEAL_TEMPLATES = {
  'Breakfast': { time: '07:30', sort: 1 },
  'Mid-Morning Snack': { time: '10:30', sort: 2 },
  'Lunch': { time: '13:00', sort: 3 },
  'Evening Snack': { time: '16:30', sort: 4 },
  'Dinner': { time: '20:00', sort: 5 },
  'Post-Workout': { time: 'Variable', sort: 6 },
}

function generateMeals(client, calorieTarget, proteinTargetG, carbsTargetG, fatTargetG) {
  const isVeg = client.diet_type === 'Veg' || client.diet_type === 'Vegan'
  const isVegan = client.diet_type === 'Vegan'
  const mealCount = client.meal_frequency || 4
  const budget = client.budget_per_meal

  const mealDistribution = {
    3: [
      { name: 'Breakfast', pct: 0.3 },
      { name: 'Lunch', pct: 0.35 },
      { name: 'Dinner', pct: 0.35 },
    ],
    4: [
      { name: 'Breakfast', pct: 0.25 },
      { name: 'Lunch', pct: 0.30 },
      { name: 'Evening Snack', pct: 0.15 },
      { name: 'Dinner', pct: 0.30 },
    ],
    5: [
      { name: 'Breakfast', pct: 0.20 },
      { name: 'Mid-Morning Snack', pct: 0.15 },
      { name: 'Lunch', pct: 0.25 },
      { name: 'Evening Snack', pct: 0.15 },
      { name: 'Dinner', pct: 0.25 },
    ],
    6: [
      { name: 'Breakfast', pct: 0.20 },
      { name: 'Mid-Morning Snack', pct: 0.10 },
      { name: 'Lunch', pct: 0.25 },
      { name: 'Post-Workout', pct: 0.10 },
      { name: 'Evening Snack', pct: 0.10 },
      { name: 'Dinner', pct: 0.25 },
    ],
  }

  const distribution = mealDistribution[Math.min(Math.max(mealCount, 3), 6)] || mealDistribution[4]

  const foodDatabases = {
    veg: {
      'Breakfast': { foods: 'Oats, whey protein, banana, almonds', calories: 420, protein: 32, carbs: 48, fats: 12 },
      'Mid-Morning Snack': { foods: 'Greek yogurt, mixed berries, honey', calories: 220, protein: 18, carbs: 24, fats: 6 },
      'Lunch': { foods: 'Basmati rice, paneer curry, mixed salad, curd', calories: 610, protein: 34, carbs: 58, fats: 22 },
      'Evening Snack': { foods: 'Protein shake, apple, mixed nuts', calories: 280, protein: 24, carbs: 18, fats: 14 },
      'Dinner': { foods: 'Whole wheat roti, dal, seasonal vegetables, salad', calories: 520, protein: 29, carbs: 62, fats: 16 },
      'Post-Workout': { foods: 'Whey isolate, rice cakes, peanut butter', calories: 310, protein: 30, carbs: 28, fats: 10 },
    },
    vegan: {
      'Breakfast': { foods: 'Smoothie bowl (soy milk, banana, oats, nuts, seeds)', calories: 400, protein: 28, carbs: 52, fats: 14 },
      'Mid-Morning Snack': { foods: 'Soy yogurt, granola, chia seeds', calories: 230, protein: 16, carbs: 26, fats: 8 },
      'Lunch': { foods: 'Quinoa, tofu curry, roasted vegetables, salad', calories: 580, protein: 32, carbs: 56, fats: 20 },
      'Evening Snack': { foods: 'Pea protein shake, dates, almonds', calories: 260, protein: 22, carbs: 20, fats: 12 },
      'Dinner': { foods: 'Lentil soup, brown rice, sautéed greens', calories: 490, protein: 28, carbs: 60, fats: 14 },
      'Post-Workout': { foods: 'Soy isolate, banana, almond butter', calories: 290, protein: 28, carbs: 30, fats: 8 },
    },
    nonveg: {
      'Breakfast': { foods: 'Eggs (3 whole), whole wheat toast, avocado, banana', calories: 480, protein: 36, carbs: 32, fats: 22 },
      'Mid-Morning Snack': { foods: 'Cottage cheese, pineapple, walnuts', calories: 250, protein: 22, carbs: 16, fats: 12 },
      'Lunch': { foods: 'Basmati rice, grilled chicken breast, vegetables, salad', calories: 640, protein: 48, carbs: 52, fats: 18 },
      'Evening Snack': { foods: 'Whey protein, oats, peanut butter', calories: 320, protein: 30, carbs: 24, fats: 12 },
      'Dinner': { foods: 'Grilled fish, sweet potato, steamed broccoli', calories: 550, protein: 44, carbs: 48, fats: 16 },
      'Post-Workout': { foods: 'Whey isolate, rice cakes, honey', calories: 340, protein: 32, carbs: 36, fats: 6 },
    },
  }

  const dbKey = isVegan ? 'vegan' : isVeg ? 'veg' : 'nonveg'
  const db = foodDatabases[dbKey]

  const meals = distribution.map(({ name, pct }) => {
    const template = db[name] || db['Lunch']
    const calTarget = Math.round(calorieTarget * pct)
    const scale = calTarget / template.calories
    return {
      name,
      ...MEAL_TEMPLATES[name],
      foods: template.foods,
      quantities: budget ? `~₹${budget} per meal` : null,
      calories: Math.round(template.calories * scale),
      protein_g: Math.round(template.protein * scale),
      carbs_g: Math.round(template.carbs * scale),
      fats_g: Math.round(template.fats * scale),
    }
  })

  return meals
}

function getSupplementNotes(client, meals) {
  const totalProtein = meals.reduce((s, m) => s + m.protein_g, 0)
  const proteinGap = (client.protein_target_g || 150) - totalProtein
  const recommendations = []

  if (proteinGap > 20) {
    recommendations.push(`Consider adding whey/plant protein isolate (${Math.ceil(proteinGap / 25)} scoops/day)`)
  }
  if (client.goal === 'Fat Loss') {
    recommendations.push('Consider adding L-Carnitine (500mg pre-cardio), Green tea extract')
  }
  if (client.goal === 'Muscle Gain' || client.goal === 'Strength Gain') {
    recommendations.push('Consider Creatine Monohydrate (5g/day), Beta-Alanine (3.2g/day)')
  }
  if (client.diet_type === 'Vegan') {
    recommendations.push('Supplement: Vitamin B12 (1000mcg/day), Vitamin D3 (2000 IU), Omega-3 algae oil')
  }
  if (client.workout_days_per_week >= 5) {
    recommendations.push('Consider Magnesium Glycinate (200mg before bed) for recovery')
  }
  if (client.sleep_hours < 6) {
    recommendations.push('Consider ZMA or Magnesium Glycinate for improved sleep quality')
  }

  return recommendations.length > 0 ? recommendations.join('; ') : 'Currently no additional supplements needed.'
}

router.get('/by-client/:clientId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select dp.* from diet_plans dp
       join clients c on c.id = dp.client_id
       where dp.client_id = $1 and c.trainer_id = $2
       order by dp.created_at desc`,
      [req.params.clientId, req.user.sub]
    )
    const plans = result.rows
    for (const plan of plans) {
      const mealsResult = await pool.query(
        'select * from meals where diet_plan_id = $1 order by sort_order',
        [plan.id]
      )
      plan.meals = mealsResult.rows
    }
    res.json(plans)
  } catch {
    res.status(500).json({ message: 'Failed to fetch diet plans' })
  }
})

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `select dp.*, c.full_name
       from diet_plans dp
       join clients c on c.id = dp.client_id
       where dp.id = $1 and c.trainer_id = $2`,
      [req.params.id, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Diet plan not found' })
    const plan = result.rows[0]
    const mealsResult = await pool.query(
      'select * from meals where diet_plan_id = $1 order by sort_order',
      [plan.id]
    )
    plan.meals = mealsResult.rows
    res.json(plan)
  } catch {
    res.status(500).json({ message: 'Failed to fetch diet plan' })
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

    let calTarget = c.calorie_target
    let proTarget = c.protein_target_g
    let carbTarget = c.carbs_target_g
    let fatTarget = c.fat_target_g

    if (!calTarget) {
      const engine = require('./engine')
      const bmr = engine.calculateBMR(Number(c.weight), Number(c.height), c.age, c.gender)
      const tdee = engine.calculateTDEE(bmr, c.activity_level)
      calTarget = c.goal === 'Fat Loss' ? tdee - 500 : c.goal === 'Muscle Gain' ? tdee + 300 : tdee
      const macros = engine.calculateMacros(calTarget, c.goal)
      proTarget = macros.proteinG
      carbTarget = macros.carbsG
      fatTarget = macros.fatG
    }

    const meals = generateMeals(c, calTarget, proTarget, carbTarget, fatTarget)
    const totalCal = meals.reduce((s, m) => s + m.calories, 0)
    const totalPro = meals.reduce((s, m) => s + m.protein_g, 0)
    const totalCarb = meals.reduce((s, m) => s + m.carbs_g, 0)
    const totalFat = meals.reduce((s, m) => s + m.fats_g, 0)
    const supplementNotes = getSupplementNotes(c, meals)
    const waterLiters = Math.max(2, Math.min(5, Math.round((calTarget / 500) * 10) / 10))

    const plan = await pool.query(
      `insert into diet_plans (client_id, title, total_calories, protein_g, carbs_g, fats_g, water_liters, supplement_notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [req.params.clientId, `${c.full_name} — ${c.goal || 'Custom'} Diet Plan`, totalCal, totalPro, totalCarb, totalFat, waterLiters, supplementNotes]
    )

    for (let i = 0; i < meals.length; i++) {
      const m = meals[i]
      await pool.query(
        `insert into meals (diet_plan_id, name, time_of_day, foods, quantities, calories, protein_g, carbs_g, fats_g, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [plan.rows[0].id, m.name, m.time, m.foods, m.quantities, m.calories, m.protein_g, m.carbs_g, m.fats_g, m.sort]
      )
    }

    const mealsResult = await pool.query(
      'select * from meals where diet_plan_id = $1 order by sort_order',
      [plan.rows[0].id]
    )

    res.status(201).json({ ...plan.rows[0], meals: mealsResult.rows })
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate diet plan', error: err.message })
  }
})

router.patch('/:id', auth, async (req, res) => {
  const { title, totalCalories, proteinG, carbsG, fatsG, waterLiters, supplementNotes, trainerNotes, status } = req.body
  try {
    const result = await pool.query(
      `update diet_plans set
        title = coalesce($1, title),
        total_calories = coalesce($2, total_calories),
        protein_g = coalesce($3, protein_g),
        carbs_g = coalesce($4, carbs_g),
        fats_g = coalesce($5, fats_g),
        water_liters = coalesce($6, water_liters),
        supplement_notes = coalesce($7, supplement_notes),
        trainer_notes = coalesce($8, trainer_notes),
        status = coalesce($9, status),
        version = version + 1,
        updated_at = now()
       from clients
       where diet_plans.id = $10 and diet_plans.client_id = clients.id and clients.trainer_id = $11
       returning diet_plans.*`,
      [title, totalCalories, proteinG, carbsG, fatsG, waterLiters, supplementNotes, trainerNotes, status, req.params.id, req.user.sub]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Diet plan not found' })
    res.json(result.rows[0])
  } catch {
    res.status(500).json({ message: 'Failed to update diet plan' })
  }
})

module.exports = router
