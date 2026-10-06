from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.models import OnboardingPreference, User
from app.routers.auth import get_current_user
from app.schemas.onboarding import OnboardingRequest, OnboardingResponse
from app.services.recommendation_generator import generate_recommendations_for_user

router = APIRouter(prefix="/users/me/onboarding", tags=["onboarding"])


def _generate_recommendations_background(user_id):
    """Runs in a background task after the HTTP response is sent.
    Opens its own DB session since the request-scoped one is closed by then."""
    db = SessionLocal()
    try:
        count = generate_recommendations_for_user(user_id, db)
        print(f"[background] Generated {count} recommendations for user {user_id} after onboarding save")
    except Exception as e:
        print(f"[background] Failed to generate recommendations for user {user_id}: {e}")
    finally:
        db.close()


@router.post("", response_model=OnboardingResponse)
def save_onboarding(
    payload: OnboardingRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = pg_insert(OnboardingPreference).values(
        user_id=current_user.id,
        selected_genres=payload.selected_genres,
        selected_movie_ids=[str(m) for m in payload.selected_movie_ids],
    ).on_conflict_do_update(
        index_elements=["user_id"],
        set_={
            "selected_genres": payload.selected_genres,
            "selected_movie_ids": [str(m) for m in payload.selected_movie_ids],
        },
    ).returning(OnboardingPreference)

    result = db.execute(stmt)
    db.commit()
    pref = result.scalars().first()

    background_tasks.add_task(_generate_recommendations_background, current_user.id)

    return OnboardingResponse(
        selected_genres=pref.selected_genres,
        selected_movie_ids=pref.selected_movie_ids,
    )


@router.get("", response_model=OnboardingResponse)
def get_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = (
        db.query(OnboardingPreference)
        .filter(OnboardingPreference.user_id == current_user.id)
        .first()
    )

    if not pref:
        return OnboardingResponse(selected_genres=None, selected_movie_ids=None)

    return OnboardingResponse(
        selected_genres=pref.selected_genres,
        selected_movie_ids=pref.selected_movie_ids,
    )
