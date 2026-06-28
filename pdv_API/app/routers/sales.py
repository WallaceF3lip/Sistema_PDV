from app.schemas.schemas import UpdateItemRequest
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime as dt

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.sale import Sale
from app.schemas.schemas import AddItemRequest, FinalizeSaleRequest, SaleOut
from app.services.sale_service import SaleService

router = APIRouter(prefix="/sales", tags=["sales"])

# GET - Buscar venda aberta do usuário atual
@router.get("/current", response_model=SaleOut | None)
def get_current_open_sale(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Retorna a venda OPEN do usuário, se existir. Retorna null se não houver."""
    sale = SaleService.get_open_sale_for_user(db, user_id=current_user.id)
    return sale

# POST - Abrir venda/carrinho 
@router.post("/", response_model=SaleOut, status_code=201)
def open_sale(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Abre uma nova venda (ou reaproveita OPEN existente)."""
    return SaleService.open_sale(db, user_id=current_user.id)

# GET - Consultar venda por ID
@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    return sale

# GET - Consultar vendas por data
@router.get("/", response_model=list[SaleOut])
def get_sales(
    start_date: dt.date,
    end_date: dt.date,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retorna lista de vendas no intervalo de datas (inclusive)."""
    sales = db.query(Sale).filter(
        func.date(Sale.opened_at).between(start_date, end_date)
    )
    return sales.all()

# POST - Adicionar itens a venda
@router.post("/{sale_id}/items", response_model=SaleOut)
def add_item(
    sale_id: int,
    payload: AddItemRequest,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Bipa SKU e adiciona item à venda. Estoque não é baixado aqui."""
    return SaleService.add_item(
        db=db,
        sale_id=sale_id,
        sku=payload.sku,
        quantity=payload.quantity,
    )

# PUT - Atualizar o valor do item na venda
@router.put("/{sale_id}/items/{item_id}", response_model=SaleOut)
def update_item(
    sale_id: int,
    item_id: int,
    payload: UpdateItemRequest,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Atualiza o valor do item na venda."""
    return SaleService.update_item(
        db=db,
        sale_id=sale_id,
        item_id=item_id,
        quantity=payload.quantity,
    )

# DELETE - Retirar itens da venda
@router.delete("/{sale_id}/items/{item_id}", response_model=SaleOut)
def remove_item(
    sale_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return SaleService.remove_item(db=db, sale_id=sale_id, item_id=item_id)

# POST - Finaliza venda com pagamento
@router.post("/{sale_id}/finalize", response_model=SaleOut)
def finalize_sale(
    sale_id: int,
    payload: FinalizeSaleRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Finaliza a venda em transação atômica:
    re-valida estoque, baixa, registra pagamentos.
    """
    payments = [p.model_dump() for p in payload.payments]
    return SaleService.finalize_sale(
        db=db,
        sale_id=sale_id,
        payments=payments,
        user_id=current_user.id,
    )

# POST - Cancelar venda que ja foi fechada
@router.post("/{sale_id}/cancel", response_model=SaleOut)
def cancel_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Cancela venda OPEN ou PAID (com estorno automático de estoque)."""
    return SaleService.cancel_sale(db=db, sale_id=sale_id, user_id=current_user.id)
