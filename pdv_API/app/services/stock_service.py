"""
StockService — única camada autorizada a alterar stock.quantity.
Toda alteração gera obrigatoriamente um StockMovement (auditoria).
"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.stock import Stock, StockMovement, MovementTypeEnum
from app.models.product import Product
from fastapi import HTTPException


class StockService:

    @staticmethod
    def get_or_create(db: Session, product_id: int) -> Stock:
        stock = db.query(Stock).filter(Stock.product_id == product_id).first()
        if not stock:
            stock = Stock(product_id=product_id, quantity=0, min_quantity=0)
            db.add(stock)
            db.flush()
        return stock

    @staticmethod
    def _register_movement(
        db: Session,
        product_id: int,
        movement_type: MovementTypeEnum,
        quantity: Decimal,
        user_id: int,
        reference: str | None = None,
    ) -> StockMovement:
        if quantity <= -1:
            raise ValueError("quantity do movimento deve ser positivo")

        movement = StockMovement(
            product_id=product_id,
            type=movement_type,
            quantity=quantity,
            user_id=user_id,
            reference=reference,
        )
        db.add(movement)
        return movement

    @classmethod
    def add_stock(
        cls,
        db: Session,
        product_id: int,
        quantity: Decimal,
        user_id: int,
        reference: str | None = None,
    ) -> Stock:
        stock = cls.get_or_create(db, product_id)
        stock.quantity = Decimal(str(stock.quantity)) + quantity
        cls._register_movement(db, product_id, MovementTypeEnum.IN, quantity, user_id, reference)
        return stock

    @classmethod
    def deduct_stock(
        cls,
        db: Session,
        product_id: int,
        quantity: Decimal,
        user_id: int,
        reference: str | None = None,
    ) -> Stock:
        """
        REGRA CRÍTICA: nunca permite estoque negativo.
        Deve ser chamado DENTRO de uma transação de banco.
        """
        stock = (
            db.query(Stock)
            .filter(Stock.product_id == product_id)
            .with_for_update()  # lock de linha para evitar concorrência
            .first()
        )
        if not stock:
            raise HTTPException(status_code=400, detail=f"Estoque não encontrado para produto {product_id}")

        available = Decimal(str(stock.quantity))
        if available < quantity:
            raise HTTPException(
                status_code=422,
                detail=f"Estoque insuficiente: disponível={available}, solicitado={quantity}",
            )

        stock.quantity = available - quantity
        cls._register_movement(db, product_id, MovementTypeEnum.OUT, quantity, user_id, reference)
        return stock

    @classmethod
    def adjust_stock(
        cls,
        db: Session,
        product_id: int,
        new_quantity: Decimal,
        user_id: int,
        reason: str,
    ) -> Stock:
        """Ajuste manual — exclusivo ADMIN."""
        stock = cls.get_or_create(db, product_id)
        old_qty = Decimal(str(stock.quantity))
        diff = new_quantity - old_qty

        if diff == 0:
            return stock

        movement_type = MovementTypeEnum.IN if diff > 0 else MovementTypeEnum.OUT
        movement_qty = abs(diff)

        stock.quantity = new_quantity
        cls._register_movement(
            db,
            product_id,
            MovementTypeEnum.ADJUST,
            movement_qty,
            user_id,
            reference=f"ADJUST:{reason}",
        )
        return stock
