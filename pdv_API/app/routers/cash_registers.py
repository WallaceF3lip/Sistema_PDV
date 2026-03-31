from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.cash_register import CashRegister
from app.schemas.schemas import (
    CashRegisterOpen,
    CashRegisterClose,
    CashMovementCreate,
    CashMovementOut,
    CashRegisterOut,
)
from app.services.cash_register_service import CashRegisterService

router = APIRouter(prefix="/cash-registers", tags=["cash-registers"])


# POST — Abrir caixa (qualquer usuário autenticado)
@router.post("/", response_model=CashRegisterOut, status_code=201)
def open_register(
    payload: CashRegisterOpen,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Abre uma nova sessão de caixa com fundo de troco."""
    return CashRegisterService.open_register(
        db=db,
        user_id=current_user.id,
        opening_amount=payload.opening_amount,
        notes=payload.notes,
    )


# GET — Consultar caixa aberto do operador logado
@router.get("/my-open", response_model=CashRegisterOut)
def get_my_open_register(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retorna o caixa OPEN do operador logado."""
    return CashRegisterService.get_my_open_register(db=db, user_id=current_user.id)


# GET — Consultar caixa por ID
@router.get("/{register_id}", response_model=CashRegisterOut)
def get_register(
    register_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Retorna os detalhes de um caixa (incluindo saldo calculado)."""
    register = db.query(CashRegister).filter(CashRegister.id == register_id).first()
    if not register:
        raise HTTPException(status_code=404, detail="Caixa não encontrado")
    return register


# GET — Listar movimentações de um caixa
@router.get("/{register_id}/movements", response_model=list[CashMovementOut])
def list_movements(
    register_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Retorna o histórico de movimentações de um caixa."""
    register = db.query(CashRegister).filter(CashRegister.id == register_id).first()
    if not register:
        raise HTTPException(status_code=404, detail="Caixa não encontrado")
    return register.movements


# POST — Registrar sangria (somente ADMIN)
@router.post("/{register_id}/sangria", response_model=CashMovementOut)
def create_sangria(
    register_id: int,
    payload: CashMovementCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Registra uma sangria (retirada de dinheiro). Restrito a ADMIN."""
    return CashRegisterService.create_sangria(
        db=db,
        register_id=register_id,
        amount=payload.amount,
        description=payload.description,
        user_id=current_user.id,
    )


# POST — Registrar suprimento (somente ADMIN)
@router.post("/{register_id}/suprimento", response_model=CashMovementOut)
def create_suprimento(
    register_id: int,
    payload: CashMovementCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Registra um suprimento (entrada adicional de dinheiro). Restrito a ADMIN."""
    return CashRegisterService.create_suprimento(
        db=db,
        register_id=register_id,
        amount=payload.amount,
        description=payload.description,
        user_id=current_user.id,
    )


# POST — Fechar caixa (somente ADMIN)
@router.post("/{register_id}/close", response_model=CashRegisterOut)
def close_register(
    register_id: int,
    payload: CashRegisterClose,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """
    Fecha uma sessão de caixa. Restrito a ADMIN.
    O operador informa o valor contado fisicamente.
    O sistema calcula a diferença entre contagem e saldo esperado.
    """
    return CashRegisterService.close_register(
        db=db,
        register_id=register_id,
        closing_amount=payload.closing_amount,
        user_id=current_user.id,
        notes=payload.notes,
    )

