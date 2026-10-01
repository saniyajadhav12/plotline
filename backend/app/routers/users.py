from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.models import User
from app.routers.auth import get_current_user
from app.schemas.auth import UserResponse
from app.schemas.user import ChangePasswordRequest, ChangeRegionRequest

router = APIRouter(prefix="/users/me", tags=["users"])


@router.put("/password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect"
        )

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password updated successfully"}


@router.put("/region", response_model=UserResponse)
def change_region(
    payload: ChangeRegionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.region_preference = payload.region_preference.upper()
    db.commit()
    db.refresh(current_user)

    return current_user
