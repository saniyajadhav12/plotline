# Plotline

Plotline is a full-stack movie recommendation web app built as a portfolio project.
It uses a **hybrid recommendation engine** (collaborative filtering + content-based
filtering) to recommend movies, with real authentication, a watchlist, OTT/streaming
availability, and AI-generated plain-English explanations for each recommendation.

**This project runs entirely on free-tier services — $0 to run and demo.**

## Tech Stack

- **Frontend:** Next.js (App Router)
- **Backend:** Python, FastAPI
- **Database:** PostgreSQL (AWS RDS Free Tier)
- **AI:** Google Gemini API (free tier) for recommendation explanations
- **Data:** MovieLens dataset + TMDb API
- **Auth:** JWT (email/password)
- **ORM/Migrations:** SQLAlchemy + Alembic
- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub Actions
- **Hosting:** Backend on AWS Free Tier, Frontend on Vercel Free Tier

## Architecture Overview
