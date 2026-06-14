from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import require_admin, get_current_user
from app.models.stock import Stock, StockMovement
from app.schemas.schemas import StockOut, StockAdjust, StockMovementOut
from app.services.stock_service import StockService

router = APIRouter(prefix="/stock", tags=["stock"])

# GET - Lista de Itens do estoque
@router.get("/", response_model=list[StockOut])
def list_stock(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Stock).options(joinedload(Stock.product)).all()

# GET - Itens do estoque por ID
@router.get("/product/{product_id}", response_model=StockOut)
def get_stock(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    stock = db.query(Stock).filter(Stock.product_id == product_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Estoque não encontrado")
    return stock

# POST - entrada de estoque
@router.post("/product/{product_id}/in", response_model=StockOut, status_code=201)
def stock_in(
    product_id: int,
    payload: StockAdjust,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Entrada de mercadoria — exclusivo ADMIN."""
    stock = StockService.add_stock(
        db=db,
        product_id=product_id,
        quantity=payload.quantity,
        user_id=current_user.id,
        reference=f"IN:{payload.reason}",
    )
    db.commit()
    db.refresh(stock)
    return stock

# POST - Ajuste de estoque manual
@router.post("/product/{product_id}/adjust", response_model=StockOut)
def stock_adjust(
    product_id: int,
    payload: StockAdjust,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Ajuste manual de inventário — exclusivo ADMIN, sempre logado."""
    stock = StockService.adjust_stock(
        db=db,
        product_id=product_id,
        new_quantity=payload.quantity,
        new_min_quantity=payload.min_quantity,
        user_id=current_user.id,
        reason=payload.reason,
    )
    db.commit()
    db.refresh(stock)
    return stock

# GET - Lista de movimentos do estoque
@router.get("/movements", response_model=list[StockMovementOut])
def list_movements(
    product_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(StockMovement)
    if product_id:
        q = q.filter(StockMovement.product_id == product_id)
    return q.order_by(StockMovement.created_at.desc()).limit(limit).all()
