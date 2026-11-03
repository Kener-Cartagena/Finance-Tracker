from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
import ipaddress
import json
import logging
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

from .serializers import (
    RegisterSerializer,
    UserProfileSerializer,
    ChangePasswordSerializer,
)

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Public endpoint. Creates a new user and returns JWT tokens immediately.
    """

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Issue tokens immediately after registration
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserProfileSerializer(user).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/auth/me/  → return the authenticated user's profile
    PATCH /api/auth/me/ → update first_name, last_name, currency
    """

    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Requires: old_password, new_password
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password updated successfully."})


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Blacklists the refresh token so it can no longer be used.
    Requires: { "refresh": "<token>" }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Successfully logged out."})
        except Exception:
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )


def _is_loopback(addr) -> bool:
    """True solo si la IP del cliente es loopback (127.0.0.0/8, ::1, ::ffff:127.x)."""
    try:
        ip = ipaddress.ip_address((addr or "").split("%")[0])
    except ValueError:
        return False
    if ip.version == 6 and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_loopback


_PENDING_MAX_AGE = 60.0   # s: un marcador mas viejo se considera obsoleto
_ACCEPT_TIMEOUT = 5.0     # s: espera maxima a que el helper valide y acepte
_STOP_DELAY = 1.5         # s: margen para que la respuesta llegue al cliente


def _acquire_pending(path: Path) -> bool:
    """Crea el marcador de apagado en curso de forma atomica."""
    for _ in range(2):
        try:
            os.close(os.open(str(path), os.O_CREAT | os.O_EXCL | os.O_WRONLY))
            return True
        except FileExistsError:
            try:
                if time.time() - path.stat().st_mtime > _PENDING_MAX_AGE:
                    path.unlink()
                    continue
            except FileNotFoundError:
                continue
            return False
    return False


def _release(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass


class ShutdownView(APIView):
    """
    POST /api/auth/shutdown/
    Apaga unicamente la instancia de Ledger a la que pertenece ESTE backend.

    No mata nada por si mismo y no lee nada del cuerpo de la peticion: delega
    en ledger_proc.py (helper desacoplado, fuera del Job) que valida la
    identidad del Job de Ledger y lo termina por completo. Solo responde 200
    cuando el helper ha validado y aceptado el apagado.

    Un backend no iniciado por iniciar.vbs (p. ej. el de VS Code) no tiene
    LEDGER_JOB_NAME/LEDGER_HOME en su entorno: responde 409 y no toca nada.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_loopback(request.META.get("REMOTE_ADDR")):
            return Response(
                {"detail": "Operacion no permitida desde este origen."},
                status=status.HTTP_403_FORBIDDEN,
            )

        home = os.environ.get("LEDGER_HOME")
        job = os.environ.get("LEDGER_JOB_NAME")
        helper = Path(home) / "ledger_proc.py" if home else None
        if not (home and job and helper and helper.is_file()):
            return Response(
                {"detail": "Esta instancia no fue iniciada por Ledger (iniciar.vbs); "
                           "no se detuvo ningun proceso."},
                status=status.HTTP_409_CONFLICT,
            )

        state_dir = Path(home) / ".ledger"
        pending = state_dir / "stop.pending"
        status_file = state_dir / "stop.status"
        try:
            state_dir.mkdir(exist_ok=True)
            if not _acquire_pending(pending):
                return Response(
                    {"detail": "El apagado ya esta en curso.", "shutdown": "pending"},
                    status=status.HTTP_200_OK,
                )
            _release(status_file)
        except OSError:
            logger.exception("shutdown: no se pudo preparar el estado")
            return Response({"detail": "No se pudo iniciar el apagado."},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        request_id = uuid.uuid4().hex
        cmd = [sys.executable, str(helper), "stop", "--job", job,
               "--requester-pid", str(os.getpid()), "--request-id", request_id,
               "--delay", str(_STOP_DELAY)]
        kwargs = {}
        if os.name == "nt":
            # Fuera del Job (breakaway) para sobrevivir a TerminateJobObject.
            kwargs["creationflags"] = (
                getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
                | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)
                | getattr(subprocess, "CREATE_BREAKAWAY_FROM_JOB", 0x01000000)
            )
        try:
            proc = subprocess.Popen(
                cmd, cwd=home, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, close_fds=True, shell=False, **kwargs,
            )
        except OSError:
            logger.exception("shutdown: no se pudo lanzar el helper")
            _release(pending)
            return Response({"detail": "No se pudo iniciar el apagado."},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        outcome = self._wait_for_acceptance(status_file, request_id, proc)
        if outcome == "accepted":
            return Response({"detail": "Apagando servidores...", "shutdown": "accepted"},
                            status=status.HTTP_200_OK)

        if outcome == "timeout":
            proc.terminate()   # el helper aun no habia aceptado: no debe actuar despues
        _release(pending)
        if outcome == "refused":
            return Response(
                {"detail": "No se pudo verificar que esta instancia pertenezca a Ledger; "
                           "no se detuvo ningun proceso."},
                status=status.HTTP_409_CONFLICT,
            )
        logger.error("shutdown: helper sin aceptacion (%s)", outcome)
        return Response({"detail": "No se pudo iniciar el apagado."},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @staticmethod
    def _wait_for_acceptance(status_file: Path, request_id: str, proc) -> str:
        deadline = time.time() + _ACCEPT_TIMEOUT
        while True:
            try:
                data = json.loads(status_file.read_text(encoding="utf-8"))
                if data.get("request_id") == request_id:
                    return {"accepted": "accepted", "refused": "refused"}.get(data.get("state"), "failed")
            except (OSError, ValueError):
                pass
            if proc.poll() is not None:
                # Reintento final: el estado pudo escribirse justo antes de salir.
                try:
                    data = json.loads(status_file.read_text(encoding="utf-8"))
                    if data.get("request_id") == request_id:
                        return {"accepted": "accepted", "refused": "refused"}.get(data.get("state"), "failed")
                except (OSError, ValueError):
                    pass
                return "failed"
            if time.time() > deadline:
                return "timeout"
            time.sleep(0.05)