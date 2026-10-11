"""
Dia de operação (business date).

O dia de operação de um instante é a data no fuso BUSINESS_TIMEZONE
(padrão America/Sao_Paulo), recuada um dia quando a hora local é menor que
BUSINESS_DAY_CUTOFF_HOUR (padrão 0 = virada à meia-noite). Independe do fuso
do servidor e do banco. Requer o pacote `tzdata` no Windows/Vercel.
"""
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings


def business_date_for(
    moment: datetime | None = None,
    *,
    cutoff_hour: int | None = None,
    tz_name: str | None = None,
) -> date:
    """
    Retorna o dia de operação de `moment` (padrão: agora).
    Datetimes "naive" são tratados como UTC.
    `cutoff_hour`/`tz_name` sobrescrevem as configurações (útil em testes).
    """
    if moment is None:
        moment = datetime.now(timezone.utc)
    elif moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)

    tz = ZoneInfo(tz_name or settings.BUSINESS_TIMEZONE)
    cutoff = settings.BUSINESS_DAY_CUTOFF_HOUR if cutoff_hour is None else cutoff_hour

    local = moment.astimezone(tz)
    business_day = local.date()
    if local.hour < cutoff:
        business_day -= timedelta(days=1)
    return business_day


def current_business_date() -> date:
    """Dia de operação atual."""
    return business_date_for()
