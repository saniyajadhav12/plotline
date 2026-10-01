# Plotline

Plotline is a full-stack movie recommendation web application built as a portfolio project. It uses a **hybrid recommendation engine** (collaborative filtering + content-based filtering) to recommend movies, with real authentication, a watchlist feature, OTT/streaming availability information, and AI-generated plain-English explanations for why each movie was recommended.

**This project runs entirely on free-tier services — $0 to run and demo.**

## Features

- **Authentication:** Email/password signup and login (JWT sessions), forgot password / reset flow
- **Onboarding:** Cold-start quiz for new users (favorite genres + favorite movies) to seed initial recommendations
- **Home/Dashboard:** "Recommended for You" carousel, "Because you liked X" rows, trending/popular movies
- **Search:** By title and/or genre filter
- **Movie Detail Page:** Poster, genre, year, description, cast, director, average rating, OTT/streaming availability (region-selectable), watchlist button, star rating, AI-generated "Why this was recommended" explanation
- **Watchlist:** List of movies marked "Want to Watch," acts as a soft signal into the recommendation engine
- **Profile:** Ratings history, edit onboarding preferences, change password/logout, change OTT region preference
- **Recommendation Engine:** Collaborative filtering (rating pattern similarity) + content-based filtering (genre/description/cast/director) + hybrid scoring + AI-generated explanations (pre-generated/cached for demo)

## Tech Stack

- **Frontend:** Next.js (React, App Router)
- **Backend:** Python, FastAPI
- **Database:** PostgreSQL
- **AI:** Google Gemini API (free tier, `google-genai` SDK) for generating recommendation explanations
- **Data sources:** MovieLens dataset (ratings/movies) + TMDb API (cast, director, posters, watch providers)
- **Containerization:** Docker + Docker Compose
- **Cloud:** AWS Free Tier (RDS for Postgres, EC2 or Lambda for backend, S3 for static assets) + Vercel free tier (frontend)
- **CI/CD:** GitHub Actions (lint → test → build Docker image → deploy)
- **Testing:** Pytest (backend), Jest + React Testing Library (frontend)
- **Auth:** JWT-based email/password authentication
- **ORM/Migrations:** SQLAlchemy + Alembic

## Architecture Overview

    plotline/
    ├── backend/            # FastAPI app: routers, models, services, schemas, core, tests
    ├── web/                # Next.js frontend: app routes, components, hooks, lib
    ├── infra/              # docker-compose.yml + AWS deployment configs/scripts
    └── .github/workflows/  # CI/CD pipeline definitions

### Database Schema

- `users` — id, email, hashed_password, region_preference, created_at
- `password_reset_tokens` — id, user_id, token, expires_at
- `movies` — id, tmdb_id, movielens_id, title, year, genres, description, poster_url
- `cast_crew` — id, movie_id, person_name, role (cast/director), character_name
- `watch_providers` — id, movie_id, region, provider_name, provider_type (subscription/rent/buy)
- `ratings` — id, user_id, movie_id, rating_value, created_at
- `watchlist` — id, user_id, movie_id, added_at
- `onboarding_preferences` — id, user_id, selected_genres, selected_movie_ids
- `recommendation_logs` — id, user_id, movie_id, method (collaborative/content/hybrid), explanation_text, created_at, is_cached

## Setup Instructions

### Prerequisites

- Git, Python 3.12, Node 22, npm, Docker, Docker Compose

### Backend

**Option A: Docker (recommended)** - runs Postgres and the API together:

    export JWT_SECRET_KEY=your_secret_here
    export GEMINI_API_KEY=your_gemini_key_here
    export TMDB_API_KEY=your_tmdb_key_here
    docker compose -f infra/docker-compose.yml up --build

The API will be available at http://localhost:8000. Run migrations once the containers are up:

    docker exec -it plotline-backend python -m alembic upgrade head

**Option B: Local Python** - for active development with hot-reload:

    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env   # then fill in real values

Start local Postgres only:

    docker compose -f ../infra/docker-compose.yml up -d db

Run migrations:

    python -m alembic upgrade head

Run the API:

    python -m uvicorn app.main:app --reload

### Frontend

    cd web
    npm install
    cp .env.example .env.local   # then fill in real values
    npm run dev

### Environment Variables

See `backend/.env.example` and `web/.env.example` for the full list of required variables (database URL, JWT secret, Gemini API key, TMDb API key).

## Free-Tier Notice

This project is designed to run at **zero cost**:

- **Gemini API** free tier for LLM-generated recommendation explanations
- **AWS Free Tier** (RDS, EC2/Lambda, S3) for backend hosting
- **Vercel free tier** for frontend hosting
- Recommendation explanations are **pre-generated and cached** for the demo dataset to avoid repeated live LLM calls during interviews/demos

## Project Status

This project is actively under development, built incrementally with Pytest coverage added alongside each backend feature.