from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Account, Transfer
from apps.expenses.models import Expense
from apps.incomes.models import Income
from apps.investments.models import Investment
from apps.users.models import User

from .models import BudgetPlan, PeriodType, PlannedExpense
from .periods import next_period, period_for, previous_period


class PeriodTests(TestCase):
    def plan(self, **kw):
        return BudgetPlan(**kw)

    def test_biweekly(self):
        p = self.plan(period_type=PeriodType.BIWEEKLY)
        first = period_for(p, date(2026, 11, 3))
        self.assertEqual((first.start, first.end), (date(2026, 11, 1), date(2026, 11, 15)))
        second = period_for(p, date(2026, 2, 20))
        self.assertEqual((second.start, second.end), (date(2026, 2, 16), date(2026, 2, 28)))
        self.assertEqual(next_period(p, second).start, date(2026, 3, 1))
        self.assertEqual(previous_period(p, period_for(p, date(2026, 1, 5))).start, date(2025, 12, 16))

    def test_monthly(self):
        p = self.plan(period_type=PeriodType.MONTHLY)
        per = period_for(p, date(2024, 2, 10))
        self.assertEqual((per.start, per.end), (date(2024, 2, 1), date(2024, 2, 29)))
        self.assertEqual(per.label, "Febrero 2024")

    def test_custom_days_before_and_after_anchor(self):
        p = self.plan(period_type=PeriodType.CUSTOM, custom_days=10, anchor_date=date(2026, 11, 1))
        per = period_for(p, date(2026, 11, 12))
        self.assertEqual((per.start, per.end), (date(2026, 11, 11), date(2026, 11, 20)))
        before = period_for(p, date(2026, 10, 31))
        self.assertEqual((before.start, before.end), (date(2026, 10, 22), date(2026, 10, 31)))


class ApiTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="a@a.com", password="x" * 12, exchange_rate=Decimal("25"))
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.today = date.today()


class MoneyRecordTests(ApiTestCase):
    def test_account_forces_currency_and_default_rate(self):
        airtm = Account.objects.create(user=self.user, name="Airtm", currency="USD")
        r = self.client.post("/api/incomes/", {
            "amount": "100", "source": "Pago", "date": str(self.today),
            "currency": "HNL", "account": airtm.id,
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["currency"], "USD")
        self.assertEqual(Decimal(r.data["exchange_rate"]), Decimal("25"))
        self.assertEqual(Decimal(r.data["amount_hnl"]), Decimal("2500"))

    def test_cannot_use_other_users_account(self):
        other = User.objects.create_user(email="b@b.com", password="x" * 12)
        acc = Account.objects.create(user=other, name="Ajena")
        r = self.client.post("/api/expenses/", {
            "amount": "10", "category": "food", "date": str(self.today), "account": acc.id,
        }, format="json")
        self.assertEqual(r.status_code, 400)

    def test_balances_and_conversion(self):
        airtm = Account.objects.create(user=self.user, name="Airtm", currency="USD")
        bank = Account.objects.create(user=self.user, name="Banco Atlántida", currency="HNL",
                                      initial_balance=Decimal("1000"))
        Income.objects.create(user=self.user, amount=500, source="Pago", date=self.today,
                              currency="USD", exchange_rate=25, account=airtm)
        r = self.client.post("/api/accounts/transfers/", {
            "from_account": airtm.id, "to_account": bank.id, "amount": "200",
            "amount_received": "5100", "date": str(self.today),
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Decimal(r.data["effective_rate"]), Decimal("25.5"))
        Expense.objects.create(user=self.user, amount=600, category="food", date=self.today,
                               currency="HNL", account=bank)

        data = self.client.get("/api/accounts/balances/").data
        by_name = {a["name"]: a for a in data["accounts"]}
        self.assertEqual(by_name["Airtm"]["balance"], Decimal("300"))
        self.assertEqual(by_name["Banco Atlántida"]["balance"], Decimal("5500"))
        self.assertEqual(data["total_hnl"], Decimal("300") * 25 + Decimal("5500"))

    def test_transfer_between_currencies_requires_received_amount(self):
        a = Account.objects.create(user=self.user, name="Airtm", currency="USD")
        b = Account.objects.create(user=self.user, name="Banco", currency="HNL")
        r = self.client.post("/api/accounts/transfers/", {
            "from_account": a.id, "to_account": b.id, "amount": "10", "date": str(self.today),
        }, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("amount_received", r.data)

    def test_account_with_movements_cannot_be_deleted(self):
        a = Account.objects.create(user=self.user, name="Efectivo")
        Expense.objects.create(user=self.user, amount=1, date=self.today, account=a)
        r = self.client.delete(f"/api/accounts/{a.id}/")
        self.assertEqual(r.status_code, 400)

    def test_dashboard_totals_in_hnl_with_range(self):
        Income.objects.create(user=self.user, amount=100, source="USD", date=date(2026, 1, 5),
                              currency="USD", exchange_rate=26)
        Income.objects.create(user=self.user, amount=1000, source="HNL", date=date(2026, 1, 6))
        Income.objects.create(user=self.user, amount=999, source="fuera", date=date(2026, 3, 1))
        r = self.client.get("/api/dashboard/overview/", {"date_from": "2026-01-01", "date_to": "2026-01-31"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["income"], Decimal("3600"))
        self.assertEqual(r.data["income_by_currency"]["USD"], Decimal("100"))
        bad = self.client.get("/api/dashboard/overview/", {"date_from": "2026-02-01", "date_to": "2026-01-01"})
        self.assertEqual(bad.status_code, 400)


class BudgetSummaryTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        BudgetPlan.objects.create(user=self.user, period_type=PeriodType.MONTHLY)
        self.start = self.today.replace(day=1)

    def item(self, **kw):
        r = self.client.post("/api/planning/items/", kw, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def test_full_plan(self):
        Income.objects.create(user=self.user, amount=1000, source="Pago", date=self.start,
                              currency="USD", exchange_rate=25)                         # L 25,000
        self.item(name="Universidad", item_type="fixed", amount="5000", category="university")
        self.item(name="Gasolina", item_type="fixed", amount="1500", category="gasoline")
        self.item(name="Reparaciones", item_type="savings", amount_type="percent", amount="10")  # 2,500
        self.item(name="Invertir", item_type="investment", amount="40", currency="USD")          # 1,000
        PlannedExpense.objects.create(user=self.user, name="Frenos", amount=2000, due_date=self.today)

        Expense.objects.create(user=self.user, amount=2000, category="gasoline", date=self.start)  # +500 over
        Expense.objects.create(user=self.user, amount=300, category="entertainment", date=self.start)
        Investment.objects.create(user=self.user, amount=500, platform="X", date=self.start)       # < planned

        s = self.client.get("/api/planning/summary/").data
        self.assertEqual(s["income"]["basis_hnl"], Decimal("25000"))
        self.assertEqual(s["totals"]["fixed_committed"], Decimal("7000"))  # 5000 + max(1500, 2000)
        self.assertEqual(s["totals"]["savings_planned"], Decimal("2500"))
        self.assertEqual(s["totals"]["investment_committed"], Decimal("1000"))
        self.assertEqual(s["totals"]["upcoming_reserved"], Decimal("2000"))
        self.assertEqual(s["fun"]["available"], Decimal("12500"))
        self.assertEqual(s["fun"]["spent"], Decimal("300"))
        self.assertEqual(s["fun"]["remaining"], Decimal("12200"))
        gas = next(i for i in s["items"] if i["name"] == "Gasolina")
        self.assertEqual(gas["remaining_hnl"], Decimal("-500"))

    def test_expected_income_used_until_received(self):
        self.client.patch("/api/planning/plan/", {"expected_income": "800", "expected_income_currency": "USD"},
                          format="json")
        s = self.client.get("/api/planning/summary/").data
        self.assertEqual(s["income"]["basis_hnl"], Decimal("20000"))
        self.assertEqual(s["income"]["basis_source"], "expected")
        self.assertEqual(s["income"]["pending_hnl"], Decimal("20000"))

    def test_pay_planned_expense_and_reopen(self):
        bank = Account.objects.create(user=self.user, name="Banco", currency="HNL")
        p = PlannedExpense.objects.create(user=self.user, name="Llantas", amount=3000,
                                          due_date=self.today + timedelta(days=3), is_emergency=True)
        r = self.client.post(f"/api/planning/planned-expenses/{p.id}/pay/",
                             {"account": bank.id, "amount": "3200"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "paid")
        expense = Expense.objects.get(description="Llantas")
        self.assertEqual(expense.amount, Decimal("3200"))
        self.assertEqual(expense.account, bank)

        # Paid planned expenses are committed money, not fun spending.
        s = self.client.get("/api/planning/summary/").data
        self.assertEqual(s["totals"]["planned_paid"], Decimal("3200"))
        self.assertEqual(s["fun"]["spent"], Decimal("0"))

        r = self.client.post(f"/api/planning/planned-expenses/{p.id}/reopen/")
        self.assertEqual(r.data["status"], "pending")
        self.assertFalse(Expense.objects.filter(description="Llantas").exists())

    def test_pay_in_other_currency_requires_amount(self):
        airtm = Account.objects.create(user=self.user, name="Airtm", currency="USD")
        p = PlannedExpense.objects.create(user=self.user, name="X", amount=100, due_date=self.today)
        r = self.client.post(f"/api/planning/planned-expenses/{p.id}/pay/", {"account": airtm.id}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_overdue_reserved_only_in_current_period(self):
        PlannedExpense.objects.create(user=self.user, name="Vencido", amount=100,
                                      due_date=self.start - timedelta(days=40))
        current = self.client.get("/api/planning/summary/").data
        self.assertEqual(current["totals"]["upcoming_reserved"], Decimal("100"))
        self.assertTrue(current["upcoming"][0]["is_overdue"])
        future = self.client.get("/api/planning/summary/", {"date": str(current["period"]["next_date"])}).data
        self.assertEqual(future["totals"]["upcoming_reserved"], Decimal("0"))
