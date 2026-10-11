"""
Relatórios de vendas por período (agregação no banco).

Regras (ver openspec sales-reports, design.md):
- Data de referência = dia de operação (`business_date`). Vendas PAID sem
  `business_date` (legado) usam a data, no fuso BUSINESS_TIMEZONE, do primeiro
  valor entre paid_at, closed_at e opened_at.
- Faturamento (todas as quebras) considera somente vendas PAID.
- `canceled`/`pending` exigem `business_date` não nulo (pedidos finalizados).
- OPEN é sempre ignorado.
- items_total = total_amount − delivery_fee (invariante persistido).

Observação: a expressão de fallback usa `timezone(tz, ts)` + `date(...)`,
funções do PostgreSQL.
"""
import datetime as dt
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import Date, and_, func, literal, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.delivery_zone import DeliveryZone
from app.models.product import Product
from app.models.sale import (
    OrderTypeEnum, Payment, PaymentMethodEnum, Sale, SaleItem, SaleStatusEnum,
)
from app.models.user import User
from app.schemas.schemas import OrderTypeFilterEnum, TopProductsOrderEnum

MONEY = Decimal("0.01")
QTY = Decimal("0.001")
NO_ZONE_NAME = "Sem zona"
PAYMENT_METHOD_ORDER = [PaymentMethodEnum.CASH, PaymentMethodEnum.CARD, PaymentMethodEnum.PIX]
CHANNEL_ORDER = [OrderTypeFilterEnum.COUNTER, OrderTypeFilterEnum.PICKUP, OrderTypeFilterEnum.DELIVERY]


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _qty(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(QTY, rounding=ROUND_HALF_UP)


def _avg(total: Decimal, count: int) -> Decimal:
    return _money(total / count) if count else _money(0)


def _channel_of(order_type) -> OrderTypeFilterEnum:
    """Canal do relatório: order_type nulo → COUNTER (Balcão)."""
    if order_type is None:
        return OrderTypeFilterEnum.COUNTER
    value = order_type.value if hasattr(order_type, "value") else str(order_type)
    return OrderTypeFilterEnum(value)


def _fallback_date():
    """Data local (fuso de negócio) do primeiro instante disponível — legado."""
    moment = func.coalesce(Sale.paid_at, Sale.closed_at, Sale.opened_at)
    return func.date(func.timezone(literal(settings.BUSINESS_TIMEZONE), moment), type_=Date)


def _report_date():
    return func.coalesce(Sale.business_date, _fallback_date(), type_=Date)


def _period_filter(start: dt.date, end: dt.date, *, allow_fallback: bool):
    """Filtro indexável por business_date (+ fallback opcional para legado)."""
    by_business_date = Sale.business_date.between(start, end)
    if not allow_fallback:
        return by_business_date
    return or_(
        by_business_date,
        and_(Sale.business_date.is_(None), _fallback_date().between(start, end)),
    )


class ReportService:

    @staticmethod
    def sales_summary(
        db: Session,
        start: dt.date,
        end: dt.date,
        top_limit: int = 10,
        top_by: TopProductsOrderEnum = TopProductsOrderEnum.REVENUE,
    ) -> dict:
        # Vendas pagas do período (base de todas as quebras de faturamento)
        paid = (
            select(
                Sale.id.label("id"),
                _report_date().label("report_date"),
                Sale.order_type.label("order_type"),
                Sale.total_amount.label("total_amount"),
                Sale.delivery_fee.label("delivery_fee"),
                Sale.delivery_zone_id.label("delivery_zone_id"),
                Sale.user_id.label("user_id"),
            )
            .where(
                Sale.status == SaleStatusEnum.PAID,
                _period_filter(start, end, allow_fallback=True),
            )
            .subquery("paid_sales")
        )

        # 1. by_channel + totals
        channel_rows = db.execute(
            select(
                paid.c.order_type,
                func.count(paid.c.id),
                func.coalesce(func.sum(paid.c.total_amount), 0),
                func.coalesce(func.sum(paid.c.delivery_fee), 0),
            ).group_by(paid.c.order_type)
        ).all()
        acc = {ch: [0, Decimal("0"), Decimal("0")] for ch in CHANNEL_ORDER}
        for order_type, count, gross, fees in channel_rows:
            slot = acc[_channel_of(order_type)]
            slot[0] += count
            slot[1] += Decimal(str(gross))
            slot[2] += Decimal(str(fees))

        by_channel = []
        for ch in CHANNEL_ORDER:
            count, gross, fees = acc[ch]
            by_channel.append({
                "channel": ch,
                "count": count,
                "gross_total": _money(gross),
                "items_total": _money(gross - fees),
                "delivery_fees_total": _money(fees),
                "avg_ticket": _avg(gross, count),
            })
        paid_count = sum(v[0] for v in acc.values())
        gross_total = sum((v[1] for v in acc.values()), Decimal("0"))
        fees_total = sum((v[2] for v in acc.values()), Decimal("0"))
        totals = {
            "paid_count": paid_count,
            "gross_total": _money(gross_total),
            "items_total": _money(gross_total - fees_total),
            "delivery_fees_total": _money(fees_total),
            "avg_ticket": _avg(gross_total, paid_count),
        }

        # 2. canceled / pending (somente pedidos finalizados: business_date não nulo)
        status_rows = db.execute(
            select(
                Sale.status,
                func.count(Sale.id),
                func.coalesce(func.sum(Sale.total_amount), 0),
            )
            .where(
                Sale.status.in_([SaleStatusEnum.CANCELED, SaleStatusEnum.PENDING]),
                Sale.business_date.is_not(None),
                _period_filter(start, end, allow_fallback=False),
            )
            .group_by(Sale.status)
        ).all()
        by_status = {st: (cnt, tot) for st, cnt, tot in status_rows}

        def _count_total(status: SaleStatusEnum) -> dict:
            cnt, tot = by_status.get(status, (0, 0))
            return {"count": cnt, "total": _money(tot)}

        # 3. by_payment_method
        pm_rows = db.execute(
            select(
                Payment.method,
                func.coalesce(func.sum(Payment.amount), 0),
                func.count(func.distinct(Payment.sale_id)),
            )
            .join(paid, paid.c.id == Payment.sale_id)
            .group_by(Payment.method)
        ).all()
        pm = {method: (amount, cnt) for method, amount, cnt in pm_rows}
        by_payment_method = [
            {"method": m, "amount": _money(pm.get(m, (0, 0))[0]), "count": pm.get(m, (0, 0))[1]}
            for m in PAYMENT_METHOD_ORDER
        ]

        # 4. top_products
        qty_sum = func.sum(SaleItem.quantity)
        revenue_sum = func.sum(SaleItem.subtotal)
        if top_by == TopProductsOrderEnum.QUANTITY:
            ordering = [qty_sum.desc(), revenue_sum.desc(), Product.name.asc()]
        else:
            ordering = [revenue_sum.desc(), qty_sum.desc(), Product.name.asc()]
        top_rows = db.execute(
            select(
                SaleItem.product_id,
                Product.name,
                qty_sum,
                revenue_sum,
                func.count(func.distinct(SaleItem.sale_id)),
            )
            .join(paid, paid.c.id == SaleItem.sale_id)
            .join(Product, Product.id == SaleItem.product_id)
            .group_by(SaleItem.product_id, Product.name)
            .order_by(*ordering)
            .limit(top_limit)
        ).all()
        top_products = [
            {
                "product_id": pid,
                "product_name": name,
                "quantity": _qty(qty),
                "revenue": _money(rev),
                "sales_count": cnt,
            }
            for pid, name, qty, rev, cnt in top_rows
        ]

        # 5. by_day (todos os dias do intervalo, com zeros)
        day_rows = db.execute(
            select(
                paid.c.report_date,
                func.count(paid.c.id),
                func.coalesce(func.sum(paid.c.total_amount), 0),
                func.coalesce(func.sum(paid.c.delivery_fee), 0),
            ).group_by(paid.c.report_date)
        ).all()
        days = {}
        for d, cnt, gross, fees in day_rows:
            if isinstance(d, str):  # defensivo (drivers que devolvem texto)
                d = dt.date.fromisoformat(d[:10])
            days[d] = (cnt, Decimal(str(gross)), Decimal(str(fees)))
        by_day = []
        current = start
        while current <= end:
            cnt, gross, fees = days.get(current, (0, Decimal("0"), Decimal("0")))
            by_day.append({
                "date": current,
                "count": cnt,
                "gross_total": _money(gross),
                "items_total": _money(gross - fees),
                "delivery_fees_total": _money(fees),
            })
            current += dt.timedelta(days=1)

        # 6. by_zone (somente DELIVERY)
        zone_gross = func.coalesce(func.sum(paid.c.total_amount), 0)
        zone_rows = db.execute(
            select(
                paid.c.delivery_zone_id,
                DeliveryZone.name,
                func.count(paid.c.id),
                func.coalesce(func.sum(paid.c.delivery_fee), 0),
                zone_gross,
            )
            .select_from(paid)
            .outerjoin(DeliveryZone, DeliveryZone.id == paid.c.delivery_zone_id)
            .where(paid.c.order_type == OrderTypeEnum.DELIVERY)
            .group_by(paid.c.delivery_zone_id, DeliveryZone.name)
            .order_by(zone_gross.desc(), DeliveryZone.name.asc())
        ).all()
        by_zone = [
            {
                "zone_id": zid,
                "zone_name": zname if zid is not None and zname else NO_ZONE_NAME,
                "count": cnt,
                "delivery_fees_total": _money(fees),
                "gross_total": _money(gross),
            }
            for zid, zname, cnt, fees, gross in zone_rows
        ]

        # 7. by_operator
        op_gross = func.coalesce(func.sum(paid.c.total_amount), 0)
        op_rows = db.execute(
            select(paid.c.user_id, User.name, func.count(paid.c.id), op_gross)
            .select_from(paid)
            .join(User, User.id == paid.c.user_id)
            .group_by(paid.c.user_id, User.name)
            .order_by(op_gross.desc(), User.name.asc())
        ).all()
        by_operator = [
            {"user_id": uid, "user_name": uname, "count": cnt, "gross_total": _money(gross)}
            for uid, uname, cnt, gross in op_rows
        ]

        return {
            "start_date": start,
            "end_date": end,
            "generated_at": dt.datetime.now(dt.timezone.utc),
            "totals": totals,
            "canceled": _count_total(SaleStatusEnum.CANCELED),
            "pending": _count_total(SaleStatusEnum.PENDING),
            "by_payment_method": by_payment_method,
            "by_channel": by_channel,
            "top_products": top_products,
            "by_day": by_day,
            "by_zone": by_zone,
            "by_operator": by_operator,
        }
