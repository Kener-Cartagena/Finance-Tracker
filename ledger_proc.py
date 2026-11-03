"""
ledger_proc.py - Gestor de procesos de Ledger (solo Windows).

Subcomandos:
  start   Lo ejecuta iniciar.vbs. Comprueba los puertos 8472/3001, crea un Job
          Object con nombre aleatorio, lanza backend y frontend dentro de el,
          registra la identidad de los procesos raiz y termina. NO queda ningun
          proceso residente: el Job vive mientras vivan sus procesos.
  stop    Lo lanza ShutdownView (o una persona). Abre el Job por nombre, valida
          la identidad y termina el Job completo con TerminateJobObject.
  status  Diagnostico (JSON).

Garantias:
  * Nunca se termina nada por nombre de ejecutable ni por PID suelto.
  * Un puerto ocupado por un proceso que no esta dentro del Job de Ledger se
    informa como conflicto: no se adopta ni se apaga.
  * Solo biblioteca estandar + ctypes.
"""
from __future__ import annotations

import argparse
import json
import os
import struct
import subprocess
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATE_DIR = ROOT / ".ledger"
REGISTRY = STATE_DIR / "run.json"
LOG_FILE = STATE_DIR / "ledger.log"
STATUS_TXT = STATE_DIR / "status.txt"
STOP_PENDING = STATE_DIR / "stop.pending"
STOP_STATUS = STATE_DIR / "stop.status"

BACKEND_PORT = 8472
FRONTEND_PORT = 3001
VENV_PYTHON = ROOT / "backend" / "venv" / "Scripts" / "python.exe"
READY_TIMEOUT = 30.0

EXIT_OK, EXIT_CONFLICT, EXIT_ERROR = 0, 2, 3

AF_INET, AF_INET6 = 2, 23

# --------------------------------------------------------------------------
# Utilidades puras (probables fuera de Windows)
# --------------------------------------------------------------------------
_ROW4 = struct.Struct("<6I")                 # MIB_TCPROW_OWNER_PID
_ROW6 = struct.Struct("<16sII16sIIII")       # MIB_TCP6ROW_OWNER_PID


def _port(raw: int) -> int:
    """El puerto viene en orden de red en los 16 bits bajos."""
    return ((raw & 0xFF) << 8) | ((raw >> 8) & 0xFF)


def parse_tcp_table(buf: bytes, family: int):
    """Devuelve [(puerto_local, pid)] de una tabla MIB_TCP*TABLE_OWNER_PID."""
    (n,) = struct.unpack_from("<I", buf, 0)
    row = _ROW4 if family == AF_INET else _ROW6
    out, off = [], 4
    for _ in range(n):
        f = row.unpack_from(buf, off)
        off += row.size
        out.append((_port(f[2]), f[5] if family == AF_INET else f[7]))
    return out


def log(msg: str) -> None:
    try:
        STATE_DIR.mkdir(exist_ok=True)
        if LOG_FILE.exists() and LOG_FILE.stat().st_size > 256 * 1024:
            os.replace(LOG_FILE, LOG_FILE.with_suffix(".log.1"))
        with open(LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(time.strftime("%Y-%m-%d %H:%M:%S ") + f"[{os.getpid()}] {msg}\n")
    except OSError:
        pass


def _atomic_json(path: Path, data: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def load_registry():
    try:
        return json.loads(REGISTRY.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def drop_registry() -> None:
    try:
        REGISTRY.unlink()
    except FileNotFoundError:
        pass


# --------------------------------------------------------------------------
# Capa Windows (ctypes)
# --------------------------------------------------------------------------
if os.name == "nt":
    import ctypes
    from ctypes import wintypes

    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    iph = ctypes.WinDLL("iphlpapi", use_last_error=True)

    class _IO_COUNTERS(ctypes.Structure):
        _fields_ = [(n, ctypes.c_ulonglong) for n in (
            "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
            "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]

    class _BASIC_LIMITS(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", ctypes.c_int64),
            ("PerJobUserTimeLimit", ctypes.c_int64),
            ("LimitFlags", wintypes.DWORD),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", wintypes.DWORD),
            ("Affinity", ctypes.c_size_t),
            ("PriorityClass", wintypes.DWORD),
            ("SchedulingClass", wintypes.DWORD),
        ]

    class _EXT_LIMITS(ctypes.Structure):
        _fields_ = [
            ("BasicLimitInformation", _BASIC_LIMITS),
            ("IoInfo", _IO_COUNTERS),
            ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    class _PID_LIST(ctypes.Structure):
        _fields_ = [
            ("NumberOfAssignedProcesses", wintypes.DWORD),
            ("NumberOfProcessIdsInList", wintypes.DWORD),
            ("ProcessIdList", ctypes.c_size_t * 4096),
        ]

    H = wintypes.HANDLE
    k32.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    k32.CreateJobObjectW.restype = H
    k32.OpenJobObjectW.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR]
    k32.OpenJobObjectW.restype = H
    k32.AssignProcessToJobObject.argtypes = [H, H]
    k32.AssignProcessToJobObject.restype = wintypes.BOOL
    k32.TerminateJobObject.argtypes = [H, wintypes.UINT]
    k32.TerminateJobObject.restype = wintypes.BOOL
    k32.SetInformationJobObject.argtypes = [H, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    k32.SetInformationJobObject.restype = wintypes.BOOL
    k32.QueryInformationJobObject.argtypes = [H, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD,
                                              ctypes.POINTER(wintypes.DWORD)]
    k32.QueryInformationJobObject.restype = wintypes.BOOL
    k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    k32.OpenProcess.restype = H
    k32.CloseHandle.argtypes = [H]
    k32.CloseHandle.restype = wintypes.BOOL
    k32.GetCurrentProcess.argtypes = []
    k32.GetCurrentProcess.restype = H
    k32.GetProcessTimes.argtypes = [H] + [ctypes.POINTER(wintypes.FILETIME)] * 4
    k32.GetProcessTimes.restype = wintypes.BOOL
    k32.QueryFullProcessImageNameW.argtypes = [H, wintypes.DWORD, wintypes.LPWSTR,
                                               ctypes.POINTER(wintypes.DWORD)]
    k32.QueryFullProcessImageNameW.restype = wintypes.BOOL
    k32.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
    k32.CreateMutexW.restype = H
    k32.WaitForSingleObject.argtypes = [H, wintypes.DWORD]
    k32.WaitForSingleObject.restype = wintypes.DWORD
    iph.GetExtendedTcpTable.argtypes = [ctypes.c_void_p, ctypes.POINTER(wintypes.DWORD),
                                        wintypes.BOOL, wintypes.ULONG, ctypes.c_int, wintypes.ULONG]
    iph.GetExtendedTcpTable.restype = wintypes.DWORD

JOB_TERMINATE, JOB_QUERY = 0x0008, 0x0004
JOB_OBJECT_LIMIT_BREAKAWAY_OK = 0x0800
JobObjectBasicProcessIdList, JobObjectExtendedLimitInformation = 3, 9
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
ERROR_ALREADY_EXISTS, ERROR_MORE_DATA, ERROR_INSUFFICIENT_BUFFER = 183, 234, 122
TCP_TABLE_OWNER_PID_LISTENER = 3


def _close(h) -> None:
    if h:
        k32.CloseHandle(h)


def create_job(name: str):
    """Crea un Job nuevo. Falla si el nombre ya existia (squatting)."""
    ctypes.set_last_error(0)
    h = k32.CreateJobObjectW(None, name)
    err = ctypes.get_last_error()
    if not h:
        raise OSError(err, "CreateJobObject fallo")
    if err == ERROR_ALREADY_EXISTS:
        _close(h)
        raise OSError(err, "El Job ya existia; se aborta por seguridad")
    return h


def open_job(name: str):
    if not name:
        return None
    return k32.OpenJobObjectW(JOB_QUERY | JOB_TERMINATE, False, name) or None


def set_breakaway_ok(h) -> bool:
    info = _EXT_LIMITS()
    info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_BREAKAWAY_OK
    return bool(k32.SetInformationJobObject(h, JobObjectExtendedLimitInformation,
                                            ctypes.byref(info), ctypes.sizeof(info)))


def assign_current_process(h) -> bool:
    return bool(k32.AssignProcessToJobObject(h, k32.GetCurrentProcess()))


def job_pids(h) -> set:
    buf = _PID_LIST()
    ok = k32.QueryInformationJobObject(h, JobObjectBasicProcessIdList, ctypes.byref(buf),
                                       ctypes.sizeof(buf), None)
    if not ok and ctypes.get_last_error() != ERROR_MORE_DATA:
        raise OSError(ctypes.get_last_error(), "QueryInformationJobObject fallo")
    return set(buf.ProcessIdList[: buf.NumberOfProcessIdsInList])


def terminate_job(h, exit_code: int = 0) -> bool:
    return bool(k32.TerminateJobObject(h, exit_code))


def wait_job_empty(h, timeout: float) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if not job_pids(h):
            return True
        time.sleep(0.2)
    return not job_pids(h)


def proc_identity(pid: int):
    """(hora_de_creacion_FILETIME, ruta_exe) o None si el proceso ya no existe."""
    h = k32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not h:
        return None
    try:
        c, e, kt, ut = (wintypes.FILETIME() for _ in range(4))
        if not k32.GetProcessTimes(h, ctypes.byref(c), ctypes.byref(e),
                                   ctypes.byref(kt), ctypes.byref(ut)):
            return None
        if e.dwHighDateTime or e.dwLowDateTime:      # ya termino
            return None
        buf = ctypes.create_unicode_buffer(32768)
        size = wintypes.DWORD(len(buf))
        exe = buf.value if k32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size)) else ""
        return (c.dwHighDateTime << 32) | c.dwLowDateTime, exe
    finally:
        _close(h)


def _tcp_listeners():
    """Todos los listeners TCP (IPv4 e IPv6): [(puerto, pid)]."""
    out = []
    for family in (AF_INET, AF_INET6):
        size = wintypes.DWORD(0)
        iph.GetExtendedTcpTable(None, ctypes.byref(size), False, family,
                                TCP_TABLE_OWNER_PID_LISTENER, 0)
        for _ in range(5):
            buf = ctypes.create_string_buffer(max(size.value, 4))
            rc = iph.GetExtendedTcpTable(buf, ctypes.byref(size), False, family,
                                         TCP_TABLE_OWNER_PID_LISTENER, 0)
            if rc == 0:
                out.extend(parse_tcp_table(buf.raw, family))
                break
            if rc != ERROR_INSUFFICIENT_BUFFER:
                raise OSError(rc, "GetExtendedTcpTable fallo")
        else:
            raise OSError(ERROR_INSUFFICIENT_BUFFER, "GetExtendedTcpTable: buffer inestable")
    return out


def port_pids(port: int) -> set:
    return {pid for p, pid in _tcp_listeners() if p == port}


def wait_ports_free(timeout: float) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if not port_pids(BACKEND_PORT) and not port_pids(FRONTEND_PORT):
            return True
        time.sleep(0.3)
    return not port_pids(BACKEND_PORT) and not port_pids(FRONTEND_PORT)


def roots_match(reg: dict, pids: set) -> int:
    """Cuantas raices registradas siguen vivas, dentro del Job y con la misma identidad."""
    n = 0
    for s in (reg.get("servers") or {}).values():
        if s.get("pid") not in pids:
            continue
        ident = proc_identity(s["pid"])
        if ident and ident[0] == s.get("ctime") and ident[1].lower() == str(s.get("exe", "")).lower():
            n += 1
    return n


# --------------------------------------------------------------------------
# start
# --------------------------------------------------------------------------
def _finish(code: int, message: str, state: str) -> int:
    try:
        STATE_DIR.mkdir(exist_ok=True)
        with open(STATUS_TXT, "w", encoding="cp1252", errors="replace") as fh:
            fh.write(state + "\n" + message + "\n")
    except OSError:
        pass
    log(f"start -> {state}: {message}")
    print(message)
    return code


def _abort(hjob, code: int, state: str, message: str) -> int:
    """Aborta un arranque ya iniciado. El lanzador esta dentro del Job: al
    terminar el Job muere con el codigo indicado, por eso el estado se escribe antes."""
    _finish(code, message, state)
    drop_registry()
    terminate_job(hjob, code)
    return code


def _acquire_start_lock():
    h = k32.CreateMutexW(None, False, "Local\\Ledger-start-lock")
    if not h:
        return None
    if k32.WaitForSingleObject(h, 60000) in (0, 0x80):
        return h
    _close(h)
    return None


def _owned_listening(port: int, pids: set) -> bool:
    ls = port_pids(port)
    return bool(ls) and ls <= pids


def _conflicts():
    out = []
    for port in (BACKEND_PORT, FRONTEND_PORT):
        for pid in sorted(port_pids(port)):
            ident = proc_identity(pid)
            out.append((port, pid, Path(ident[1]).name if ident and ident[1] else "proceso desconocido"))
    return out


def _conflict_message(conflicts) -> str:
    detalle = "; ".join(f"puerto {p}: {n} (PID {pid})" for p, pid, n in conflicts)
    return ("Ledger no se inicio porque hay procesos ajenos en sus puertos - " + detalle +
            ". No se inicio ningun servidor y no se cerrara ese proceso. "
            "Liberelos manualmente y vuelva a abrir Ledger.")


def cmd_start(_args) -> int:
    STATE_DIR.mkdir(exist_ok=True)
    try:
        STATUS_TXT.unlink()
    except FileNotFoundError:
        pass
    if os.name != "nt":
        return _finish(EXIT_ERROR, "Ledger solo puede iniciarse en Windows.", "ERROR")
    lock = _acquire_start_lock()
    if lock is None:
        return _finish(EXIT_ERROR, "Otro lanzador sigue iniciando Ledger. Reintente en unos segundos.", "ERROR")

    # 1) Instancia propia ya activa?
    reg = load_registry()
    if reg:
        h = open_job(reg.get("job_name", ""))
        if h:
            pids = job_pids(h)
            if roots_match(reg, pids) > 0:
                if all(_owned_listening(p, pids) for p in (BACKEND_PORT, FRONTEND_PORT)):
                    _close(h)
                    return _finish(EXIT_OK, "Ledger ya estaba en ejecucion.", "OK")
                log("instancia propia incompleta; se reinicia (identidad verificada)")
                terminate_job(h, 0)
                wait_job_empty(h, 10)
                wait_ports_free(8)
            else:
                log("el registro no coincide con el Job; se ignora y no se toca")
            _close(h)
        drop_registry()

    # 2) Puertos ocupados por algo que no es nuestro: informar y no hacer nada.
    conflicts = _conflicts()
    if conflicts:
        return _finish(EXIT_CONFLICT, _conflict_message(conflicts), "CONFLICT")

    # 3) Job + lanzamiento
    job_name = "Local\\Ledger-" + uuid.uuid4().hex
    try:
        hjob = create_job(job_name)
    except OSError as e:
        return _finish(EXIT_ERROR, f"No se pudo crear el Job Object ({e}).", "ERROR")
    if not set_breakaway_ok(hjob) or not assign_current_process(hjob):
        return _finish(EXIT_ERROR, "No se pudo configurar el Job Object (Windows 10 o superior requerido).", "ERROR")

    env = dict(os.environ, LEDGER_HOME=str(ROOT), LEDGER_JOB_NAME=job_name)
    specs = [
        ("backend", [str(VENV_PYTHON), "manage.py", "runserver", f"127.0.0.1:{BACKEND_PORT}"],
         ROOT / "backend", BACKEND_PORT),
        ("frontend", ["cmd.exe", "/d", "/c", "npm", "run", "dev"], ROOT / "frontend", FRONTEND_PORT),
    ]
    procs = []
    try:
        for name, cmd, cwd, port in specs:
            with open(STATE_DIR / f"{name}.log", "wb") as lf:
                p = subprocess.Popen(cmd, cwd=str(cwd), env=env, stdin=subprocess.DEVNULL,
                                     stdout=lf, stderr=subprocess.STDOUT,
                                     creationflags=subprocess.CREATE_NO_WINDOW)
            procs.append((name, p, port))
    except OSError as e:
        return _abort(hjob, EXIT_ERROR, "ERROR", f"No se pudo lanzar {specs[len(procs)][0]}: {e}")

    servers = {}
    for name, p, port in procs:
        ident = proc_identity(p.pid)
        if ident is None:
            return _abort(hjob, EXIT_ERROR, "ERROR", f"{name} termino inmediatamente. Revise .ledger\\{name}.log")
        servers[name] = {"pid": p.pid, "ctime": ident[0], "exe": ident[1], "port": port}
    _atomic_json(REGISTRY, {"version": 1, "job_name": job_name, "started": time.time(), "servers": servers})
    log(f"start: Job {job_name} raices {json.dumps({k: v['pid'] for k, v in servers.items()})}")

    # 4) Listo = cada puerto tiene listeners y TODOS pertenecen al Job.
    deadline = time.time() + READY_TIMEOUT
    while time.time() < deadline:
        pids = job_pids(hjob)
        ready = True
        for name, p, port in procs:
            ls = port_pids(port)
            foreign = ls - pids
            if foreign and (ls & pids):
                c = [(port, pid, Path((proc_identity(pid) or (0, ""))[1] or "?").name) for pid in sorted(foreign)]
                return _abort(hjob, EXIT_CONFLICT, "CONFLICT", _conflict_message(c))
            rc = p.poll()
            if rc is not None:
                if foreign:
                    c = [(port, pid, Path((proc_identity(pid) or (0, ""))[1] or "?").name) for pid in sorted(foreign)]
                    return _abort(hjob, EXIT_CONFLICT, "CONFLICT", _conflict_message(c))
                return _abort(hjob, EXIT_ERROR, "ERROR",
                              f"{name} termino con codigo {rc}. Revise .ledger\\{name}.log")
            if not ls or not ls <= pids:
                ready = False
        if ready:
            _close(lock)
            return _finish(EXIT_OK, "Ledger iniciado.", "OK")
        time.sleep(0.4)
    return _abort(hjob, EXIT_ERROR, "ERROR",
                  f"Los servidores no respondieron en {int(READY_TIMEOUT)} s. Revise .ledger\\*.log")


# --------------------------------------------------------------------------
# stop
# --------------------------------------------------------------------------
def cmd_stop(a) -> int:
    STATE_DIR.mkdir(exist_ok=True)

    def report(state: str, reason: str = "") -> None:
        if a.request_id:
            _atomic_json(STOP_STATUS, {"request_id": a.request_id, "state": state, "reason": reason})

    def refuse(reason: str) -> int:
        log(f"stop RECHAZADO: {reason}")
        report("refused", reason)
        print("Rechazado: " + reason)
        return EXIT_ERROR

    try:
        if os.name != "nt":
            return refuse("solo Windows")
        reg = load_registry()
        from_backend = a.requester_pid is not None
        if reg is None:
            if from_backend:
                return refuse("registro ausente")
            print("Nada que apagar.")
            return EXIT_OK
        if a.job and a.job != reg.get("job_name"):
            return refuse("el Job solicitado no coincide con el registro")
        h = open_job(reg.get("job_name", ""))
        if not h:
            if from_backend:
                return refuse("el Job no existe")
            log("stop: registro obsoleto eliminado")
            drop_registry()
            print("Nada que apagar (registro obsoleto eliminado).")
            return EXIT_OK
        try:
            pids = job_pids(h)
            if from_backend and a.requester_pid not in pids:
                return refuse("el backend solicitante no pertenece al Job")
            if roots_match(reg, pids) == 0 and not a.confirm_orphans:
                return refuse("ningun proceso raiz registrado coincide con su identidad")
            report("accepted")
            log(f"stop aceptado: {len(pids)} procesos en el Job")
            if a.delay > 0:
                time.sleep(a.delay)
            terminate_job(h, 0)
            empty = wait_job_empty(h, 10)
            free = wait_ports_free(10)
            drop_registry()
            log(f"stop: job vacio={empty} puertos libres={free}")
            return EXIT_OK if empty else EXIT_ERROR
        finally:
            _close(h)
    except Exception as e:  # noqa: BLE001 - el helper nunca debe morir en silencio
        log(f"stop ERROR: {e!r}")
        report("failed", "error interno")
        return EXIT_ERROR
    finally:
        try:
            STOP_PENDING.unlink()
        except FileNotFoundError:
            pass


# --------------------------------------------------------------------------
# status
# --------------------------------------------------------------------------
def cmd_status(_a) -> int:
    reg = load_registry()
    out = {"registry": reg, "job_alive": False, "job_pids": [], "roots_match": 0,
           "listeners": {str(BACKEND_PORT): sorted(port_pids(BACKEND_PORT)),
                         str(FRONTEND_PORT): sorted(port_pids(FRONTEND_PORT))}}
    if reg:
        h = open_job(reg.get("job_name", ""))
        if h:
            pids = job_pids(h)
            out.update(job_alive=True, job_pids=sorted(pids), roots_match=roots_match(reg, pids))
            _close(h)
    print(json.dumps(out, indent=2))
    return EXIT_OK


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="ledger_proc")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("start")
    sub.add_parser("status")
    s = sub.add_parser("stop")
    s.add_argument("--job")
    s.add_argument("--requester-pid", type=int)
    s.add_argument("--request-id")
    s.add_argument("--delay", type=float, default=0.0)
    s.add_argument("--confirm-orphans", action="store_true",
                   help="Solo CLI: permite apagar un Job cuyas raices ya murieron")
    a = p.parse_args(argv)
    return {"start": cmd_start, "stop": cmd_stop, "status": cmd_status}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())