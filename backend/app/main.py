from fastapi import FastAPI

from app.routers import auth, movies, ratings, watchlist, recommendations, onboarding, users

app = FastAPI(title="Plotline API")

app.include_router(auth.router)
app.include_router(movies.router)
app.include_router(ratings.router)
app.include_router(watchlist.router)
app.include_router(recommendations.router)
app.include_router(onboarding.router)
app.include_router(users.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
