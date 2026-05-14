# FitAI Coach Backend

## Free stack
- Database: Neon
- Backend deploy: Render
- Frontend deploy: Vercel

## Environment
```env
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
JWT_SECRET=change-me
FRONTEND_URL=https://fitai-coach-frontend.vercel.app
```

## Setup
```bash
npm install
npm start
```

## Deploy on Render
- Push repo to GitHub
- Create new Web Service
- Add env vars
- Use free plan

## Run SQL on Neon
Execute `db-init.sql` in Neon SQL editor.
