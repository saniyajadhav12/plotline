"""
Batch script: generates hybrid recommendations + AI explanations for a
demo subset of users, and writes them into recommendation_logs.

Safe to re-run: clears each user's existing recommendation_logs entries
before writing new ones.
"""
import uuid

from app.core.database import SessionLocal
from app.models import Movie, User, RecommendationLog, Rating
from app.services.collaborative_filtering import load_ratings_matrix, compute_item_similarity, recommend_cf
from app.services.content_based_filtering import build_movie_profiles, compute_content_similarity, recommend_content_based
from app.services.hybrid_recommender import compute_hybrid_scores, determine_primary_method
from app.services.explanation_generator import generate_explanation

DEMO_USER_COUNT = 1
RECS_PER_USER = 8


def run():
    db = SessionLocal()

    try:
        print("Loading collaborative filtering components...")
        ratings_matrix = load_ratings_matrix(db)
        item_sim = compute_item_similarity(ratings_matrix)

        print("Loading content-based filtering components...")
        profiles = build_movie_profiles(db)
        content_sim = compute_content_similarity(profiles)

        print("Selecting demo user subset...")
        from sqlalchemy import func
        top_users = (
            db.query(Rating.user_id, func.count(Rating.id).label("rating_count"))
            .group_by(Rating.user_id)
            .order_by(func.count(Rating.id).desc())
            .limit(DEMO_USER_COUNT)
            .all()
        )
        demo_user_ids = [row.user_id for row in top_users]

        # Always include the manual test account if it exists and isn't already in the list
        test_user = db.query(User).filter(User.email == "saniya.test@example.com").first()
        if test_user and test_user.id not in demo_user_ids:
            demo_user_ids.append(test_user.id)

        print(f"Generating recommendations for {len(demo_user_ids)} users...")

        for i, user_id in enumerate(demo_user_ids, start=1):
            print(f"\n[{i}/{len(demo_user_ids)}] User {user_id}")

            cf_scores = recommend_cf(user_id, ratings_matrix, item_sim, top_n=50)
            content_scores = recommend_content_based(user_id, db, content_sim, top_n=50)

            if not cf_scores and not content_scores:
                print("  No signal available (cold-start user) — skipping")
                continue

            hybrid_results = compute_hybrid_scores(user_id, db, cf_scores, content_scores, top_n=RECS_PER_USER)

            # Clear existing recommendation logs for this user (idempotent re-run)
            db.query(RecommendationLog).filter(RecommendationLog.user_id == user_id).delete()
            db.commit()

            for movie_id, score, breakdown in hybrid_results:
                movie = db.query(Movie).filter(Movie.id == movie_id).first()
                if not movie:
                    continue

                method = determine_primary_method(breakdown)
                explanation = generate_explanation(user_id, movie, breakdown, db)

                db.add(RecommendationLog(
                    user_id=user_id,
                    movie_id=movie.id,
                    method=method,
                    explanation_text=explanation,
                    is_cached=True,
                ))
                print(f"  {movie.title} (score={score:.3f}, method={method})")

            db.commit()

        print(f"\nDone. Generated recommendations for {len(demo_user_ids)} users.")

    finally:
        db.close()


if __name__ == "__main__":
    run()
