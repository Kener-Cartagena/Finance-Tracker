from django.test import TestCase
from rest_framework.test import APIClient

from .models import User

PASSWORD = "Sup3r-Secret-xyz"


class LogoutTests(TestCase):
    def setUp(self):
        User.objects.create_user(email="ana@example.com", password=PASSWORD)
        self.client = APIClient()
        tokens = self.client.post(
            "/api/auth/login/", {"email": "ana@example.com", "password": PASSWORD}, format="json"
        ).json()
        self.refresh = tokens["refresh"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    def logout(self, refresh):
        return self.client.post("/api/auth/logout/", {"refresh": refresh}, format="json")

    def test_logout_blacklists_refresh_token(self):
        self.assertEqual(self.logout(self.refresh).status_code, 200)

        # El refresh token ya no sirve para obtener un access nuevo
        r = self.client.post("/api/auth/token/refresh/", {"refresh": self.refresh}, format="json")
        self.assertEqual(r.status_code, 401)

        # Ni para cerrar sesion otra vez
        self.assertEqual(self.logout(self.refresh).status_code, 400)

    def test_logout_rejects_invalid_token(self):
        self.assertEqual(self.logout("no-es-un-token").status_code, 400)

    def test_refresh_rotates_and_blacklists_previous_token(self):
        r = self.client.post("/api/auth/token/refresh/", {"refresh": self.refresh}, format="json")
        self.assertEqual(r.status_code, 200)
        new_refresh = r.json()["refresh"]
        self.assertNotEqual(new_refresh, self.refresh)

        # El token anterior queda invalidado; el nuevo funciona
        old = self.client.post("/api/auth/token/refresh/", {"refresh": self.refresh}, format="json")
        self.assertEqual(old.status_code, 401)
        new = self.client.post("/api/auth/token/refresh/", {"refresh": new_refresh}, format="json")
        self.assertEqual(new.status_code, 200)
