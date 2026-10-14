from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import OnboardingPreference, User
from app.routers.auth import get_current_user
from app.schemas.onboarding import OnboardingRequest, OnboardingResponse
from app.services.recommendation_generator import save_recommendations_for_user, upgrade_explanations_background

router = APIRouter(prefix="/users/me/onboarding", tags=["onboarding"])


def _refresh_recommendations(user_id, db: Session, background_tasks: BackgroundTasks) -> None:
    """Saves fresh recommendations BEFORE the response is sent (fast: scoring plus
    templated explanations), so the next page load already has them. Only the
    slow Gemini explanation upgrade is queued as a background task. A failure
    here is logged but never fails the onboarding save request itself."""
    try:
        pending = save_recommendations_for_user(user_id, db)
        print(f"[recommendations] Saved {len(pending)} recommendations for user {user_id} after onboarding save")
    except Exception as e:
        db.rollback()
        print(f"[recommendations] Failed to generate recommendations for user {user_id}: {e}")
        return
    if pending:
        background_tasks.add_task(upgrade_explanations_background, user_id, pending)


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

    _refresh_recommendations(current_user.id, db, background_tasks)

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
