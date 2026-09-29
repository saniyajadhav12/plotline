from fastapi import APIRouter, Depends
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import OnboardingPreference, User
from app.routers.auth import get_current_user
from app.schemas.onboarding import OnboardingRequest, OnboardingResponse

router = APIRouter(prefix="/users/me/onboarding", tags=["onboarding"])


@router.post("", response_model=OnboardingResponse)
def save_onboarding(
    payload: OnboardingRequest,
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
