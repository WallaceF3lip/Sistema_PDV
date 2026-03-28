from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, require_admin, get_current_user
from app.models.user import User, RoleEnum
from app.schemas.schemas import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

# POST - Criar usuario
@router.post("/", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

# GET - Lista de Usuarios
@router.get("/", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()

# GET - Usuario por ID
@router.get("/{user_id}", response_model=UserOut)
def user_id(user_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user

# PATCH - Atualizar usuario
@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Permissões: Admin pode tudo, Usuário comum só pode alterar a si mesmo
    if current_user.role != RoleEnum.ADMIN and current_user.id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Acesso negado: você só pode alterar seu próprio perfil ou deve ser ADMIN",
        )

    # Segurança: Usuário comum NÃO pode alterar cargos
    if current_user.role != RoleEnum.ADMIN and payload.role is not None:
        raise HTTPException(
            status_code=403, detail="Acesso negado: apenas ADMIN pode alterar cargos"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if payload.email:
        existing = (
            db.query(User).filter(User.email == payload.email, User.id != user_id).first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="E-mail já está em uso")

    # Atualiza apenas os campos fornecidos
    if payload.name is not None:
        user.name = payload.name
    if payload.email is not None:
        user.email = payload.email
    if payload.role is not None:
        user.role = payload.role
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    return user

# PATCH - Ativar ou Desativar usuario
@router.patch("/{user_id}/toggle-active", response_model=UserOut)
def toggle_active(user_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user
