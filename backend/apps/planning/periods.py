"""
Period arithmetic for the budget plan.

    biweekly → 1–15 and 16–end of month (quincenas)
    monthly  → calendar month
    weekly   → 7-day blocks counted from the plan's anchor_date
    custom   → N-day blocks counted from the plan's anchor_date
"""

import calendar
from dataclasses import dataclass
from datetime import date, timedelta

from .models import PeriodType

# A Monday, used when a weekly/custom plan has no anchor date yet.
FALLBACK_ANCHOR = date(2024, 1, 1)

MONTHS_ES = [
    "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


@dataclass(frozen=True)
class Period:
    start: date
    end: date
    label: str

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1

    def contains(self, d: date) -> bool:
        return self.start <= d <= self.end


def _last_day(d: date) -> int:
    return calendar.monthrange(d.year, d.month)[1]


def _short(d: date) -> str:
    return f"{d.day} {MONTHS_ES[d.month][:3]}"


def _label(start: date, end: date, period_type: str) -> str:
    if period_type == PeriodType.MONTHLY:
        return f"{MONTHS_ES[start.month].capitalize()} {start.year}"
    if start.year == end.year and start.month == end.month:
        return f"{start.day}–{end.day} {MONTHS_ES[start.month][:3]} {start.year}"
    if start.year == end.year:
        return f"{_short(start)} – {_short(end)} {end.year}"
    return f"{_short(start)} {start.year} – {_short(end)} {end.year}"


def period_for(plan, ref: date) -> Period:
    """The period of `plan` that contains `ref`."""
    ptype = plan.period_type

    if ptype == PeriodType.MONTHLY:
        start = ref.replace(day=1)
        end = ref.replace(day=_last_day(ref))
    elif ptype == PeriodType.BIWEEKLY:
        if ref.day <= 15:
            start, end = ref.replace(day=1), ref.replace(day=15)
        else:
            start, end = ref.replace(day=16), ref.replace(day=_last_day(ref))
    else:
        length = 7 if ptype == PeriodType.WEEKLY else max(int(plan.custom_days or 1), 1)
        anchor = plan.anchor_date or FALLBACK_ANCHOR
        k = (ref - anchor).days // length          # floor division also works before the anchor
        start = anchor + timedelta(days=k * length)
        end = start + timedelta(days=length - 1)

    return Period(start=start, end=end, label=_label(start, end, ptype))


def previous_period(plan, period: Period) -> Period:
    return period_for(plan, period.start - timedelta(days=1))


def next_period(plan, period: Period) -> Period:
    return period_for(plan, period.end + timedelta(days=1))
