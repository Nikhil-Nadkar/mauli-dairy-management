"""Business-day helpers. "Today" means today in APP_TIMEZONE (default Asia/Kolkata), not UTC."""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from src.core.config import get_settings


def business_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().APP_TIMEZONE)


def today_local() -> date:
    return datetime.now(business_tz()).date()


def day_bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    """[start, end) as timezone-aware datetimes covering date_from..date_to inclusive, local time."""
    tz = business_tz()
    return (
        datetime.combine(date_from, time.min, tzinfo=tz),
        datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=tz),
    )


def months_ago(d: date, months: int) -> date:
    """Same day N calendar months earlier (clamped, e.g. 31 May - 3 months = 28/29 Feb)."""
    index = d.year * 12 + (d.month - 1) - months
    year, month = divmod(index, 12)
    month += 1
    for day in (d.day, 30, 29, 28):
        try:
            return date(year, month, min(day, d.day))
        except ValueError:
            continue
    raise ValueError("unreachable")
