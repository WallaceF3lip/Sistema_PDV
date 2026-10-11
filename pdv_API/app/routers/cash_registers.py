import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.cash_register import CashRegister, CashRegisterStatusEnum
from app.models.user import RoleEnum
from app.schemas.schemas import (
    CashRegisterOpen,
    CashRegisterClose,
    CashMovementCreate,
    CashMovementOut,
    CashRegisterOut,
    CashRegisterPage,
    CashRegisterSummaryOut,
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
    """
    Abre o caixa único do estabelecimento com fundo de troco.
    409 se já existir um caixa aberto (de qualquer usuário).
    """
    return CashRegisterService.open_register(
        db=db,
        user_id=current_user.id,
        opening_amount=payload.opening_amount,
        notes=payload.notes,
    )


# GET — Histórico de caixas (somente ADMIN)
@router.get("/", response_model=CashRegisterPage)
def list_registers(
    start_date: Optional[dt.date] = None,
    end_date: Optional[dt.date] = None,
    status: Optional[CashRegisterStatusEnum] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Lista caixas (mais recentes primeiro), paginado, com filtro por período de abertura e status."""
    return CashRegisterService.list_registers(
        db=db,
        start_date=start_date,
        end_date=end_date,
        status=status,
        page=page,
        page_size=page_size,
    )


# GET — Caixa atual (compartilhado); null se não houver
@router.get("/current", response_model=CashRegisterOut | None)
def get_current_register(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Retorna o caixa aberto do estabelecimento ou null (200) se não houver."""
    return CashRegisterService.get_current_register(db)


# GET — Alias legado
@router.get("/my-open", response_model=CashRegisterOut)
def get_my_open_register(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Depreciado — use /current. Retorna o caixa compartilhado aberto (404 se não houver)."""
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


# GET — Resumo do caixa (OPEN: qualquer usuário; CLOSED: somente ADMIN)
@router.get("/{register_id}/summary", response_model=CashRegisterSummaryOut)
def get_register_summary(
    register_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Totais por forma de pagamento, por canal Balcão vs Delivery, taxas, pendentes e dinheiro esperado."""
    register = db.query(CashRegister).filter(CashRegister.id == register_id).first()
    if not register:
        raise HTTPException(status_code=404, detail="Caixa não encontrado")
    if register.status != CashRegisterStatusEnum.OPEN and current_user.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=403, detail="Apenas administradores podem consultar caixas fechados"
        )
    return CashRegisterService.build_summary(db, register)


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

