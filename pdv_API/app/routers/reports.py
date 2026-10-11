import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin
from app.schemas.schemas import SalesSummaryOut, TopProductsOrderEnum
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])

MAX_REPORT_DAYS = 366


# GET — Resumo de vendas por período (somente ADMIN, somente leitura)
@router.get("/sales-summary", response_model=SalesSummaryOut)
def sales_summary(
    start_date: dt.date,
    end_date: dt.date,
    top_limit: int = Query(10, ge=1, le=50),
    top_by: TopProductsOrderEnum = TopProductsOrderEnum.REVENUE,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Agrega as vendas do período (intervalo inclusivo, por dia de operação).
    Faturamento considera somente vendas PAID; cancelados e pendentes vêm à parte.
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="A data inicial deve ser anterior ou igual à data final",
        )
    if (end_date - start_date).days + 1 > MAX_REPORT_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"O período máximo do relatório é de {MAX_REPORT_DAYS} dias",
        )
    return ReportService.sales_summary(db, start_date, end_date, top_limit, top_by)
