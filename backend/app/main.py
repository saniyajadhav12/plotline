from fastapi import FastAPI

from app.routers import auth, movies, ratings, watchlist

app = FastAPI(title="Plotline API")

app.include_router(auth.router)
app.include_router(movies.router)
app.include_router(ratings.router)
app.include_router(watchlist.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
