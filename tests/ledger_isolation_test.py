"""
Prueba REAL de aislamiento de Ledger (SOLO WINDOWS). Ejecutar con el Python del venv,
despues de que t0_job_prototype.py pase:

    backend\\venv\\Scripts\\python.exe tests\\ledger_isolation_test.py [opciones]

Requisitos: puertos 8472 y 3001 libres. Usa los servidores reales de VS Code
(8000/5174) y de Vexto POS (--vexto-port N, repetible) si estan escuchando; si no,
levanta senuelos con python.exe / node.exe en esos puertos. Nunca los apaga
(solo los senuelos propios al terminar).

Pruebas del endpoint (opcional): LEDGER_TEST_EMAIL y LEDGER_TEST_PASSWORD de un
usuario YA existente (no se crea ninguno). Sin ellas se apaga con `ledger_proc.py stop`
y las pruebas HTTP se marcan SKIPPED.
"""
import argparse, json, os, socket, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import ledger_proc as lp  # noqa: E402

PY = str(ROOT / "backend" / "venv" / "Scripts" / "python.exe")
LP = str(ROOT / "ledger_proc.py")
BACK, FRONT = lp.BACKEND_PORT, lp.FRONTEND_PORT
NO_WINDOW = 0x08000000
results, skipped = [], []


def check(name, ok):
    results.append((name, bool(ok))); print(("PASS " if ok else "FAIL ") + name)


def skip(name, why):
    skipped.append(name); print(f"SKIP {name}: {why}")


def run_lp(*a, timeout=120):
    return subprocess.run([PY, LP, *a], cwd=str(ROOT), capture_output=True, text=True, timeout=timeout)


def status_txt():
    try:
        return (ROOT / ".ledger" / "status.txt").read_text(encoding="cp1252").splitlines()
    except OSError:
        return ["MISSING"]


def lp_status():
    return json.loads(run_lp("status").stdout)


def reachable(port):
    for fam, host in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        try:
            with socket.socket(fam) as s:
                s.settimeout(1); s.connect((host, port)); return True
        except OSError:
            pass
    return False


def snapshot(port):
    return {pid: lp.proc_identity(pid) for pid in lp.port_pids(port)}


def spawn_decoy(kind, port):
    if kind == "node":
        code = f"require('http').createServer((q,r)=>r.end('ok')).listen({port})"
        return subprocess.Popen(["node", "-e", code], creationflags=NO_WINDOW)
    return subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=NO_WINDOW)


def wait_listen(port, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        if lp.port_pids(port):
            return True
        time.sleep(0.3)
    return False


def proc_table():
    ps = ("Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine "
          "| ConvertTo-Json -Compress")
    out = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, timeout=90).stdout
    d = json.loads(out)
    return d if isinstance(d, list) else [d]


def ledger_leftovers():
    """Procesos cuya linea de comandos delata a Ledger (excluye este test y su padre)."""
    pats = [str(ROOT).lower(), f"127.0.0.1:{BACK}", f"--port {FRONT}"]
    me = {os.getpid(), os.getppid()}
    return [p for p in proc_table() if p["ProcessId"] not in me and p.get("CommandLine")
            and any(x in p["CommandLine"].lower() for x in pats)]


def api(method, path, token=None, body=None, port=BACK):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", method=method,
                                 data=json.dumps(body or {}).encode() if method != "GET" else None,
                                 headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {}


def wait_until(fn, timeout):
    end = time.time() + timeout
    while time.time() < end:
        if fn():
            return True
        time.sleep(0.4)
    return fn()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vexto-port", type=int, action="append", default=[])
    ap.add_argument("--probe-vscode-backend", action="store_true",
                    help="POST shutdown al backend de VS Code (8000). SOLO si ese backend ya corre el codigo NUEVO")
    a = ap.parse_args()

    if lp.port_pids(BACK) or lp.port_pids(FRONT):
        sys.exit(f"Los puertos {BACK}/{FRONT} no estan libres: no se hace nada.")
    run_lp("stop")  # limpia un registro obsoleto propio, si lo hay

    # ---- Objetivos que deben quedar intactos (VS Code y Vexto) ----
    own_decoys, watch = [], {}
    targets = [(8000, "python"), (5174, "node")] + [(p, "python") for p in a.vexto_port]
    for port, kind in targets:
        if not lp.port_pids(port):
            own_decoys.append(spawn_decoy(kind, port))
            if not wait_listen(port):
                sys.exit(f"No se pudo levantar el senuelo en {port}")
            print(f"[setup] senuelo {kind} en {port}")
        else:
            print(f"[setup] usando servidor real ya activo en {port}")
        watch[port] = snapshot(port)

    def intact(label):
        for port, snap in watch.items():
            now = snapshot(port)
            check(f"{label}: puerto {port} mismos PID/hora de creacion y responde", now == snap and reachable(port))

    try:
        # ---- Inicio ----
        run_lp("start")
        st = status_txt()
        check("T2 start informa OK", st[0] == "OK")
        s1 = lp_status()
        check("T2 registro presente y Job vivo con raices verificadas", s1["job_alive"] and s1["roots_match"] >= 1)
        jp = set(s1["job_pids"])
        check("T2 listeners de 8472 pertenecen todos al Job", s1["listeners"][str(BACK)] and set(s1["listeners"][str(BACK)]) <= jp)
        check("T2 listeners de 3001 pertenecen todos al Job", s1["listeners"][str(FRONT)] and set(s1["listeners"][str(FRONT)]) <= jp)
        check("T3 VS Code/Vexto siguen intactos tras iniciar Ledger", all(now == watch[p] for p, now in ((p, snapshot(p)) for p in watch)))
        check("T3 8000 y 5174 coexisten con 8472 y 3001", reachable(8000) and reachable(5174) and reachable(BACK) and reachable(FRONT))

        run_lp("start")
        s2 = lp_status()
        check("T1 segundo start detecta la instancia activa (mismo Job, mismos procesos)",
              status_txt()[0] == "OK" and s2["registry"]["job_name"] == s1["registry"]["job_name"]
              and set(s2["job_pids"]) == jp)

        # ---- Autoreload ----
        before = set(lp.port_pids(BACK))
        os.utime(ROOT / "backend" / "config" / "settings.py", None)
        reloaded = wait_until(lambda: lp.port_pids(BACK) and lp.port_pids(BACK) != before, 30)
        s3 = lp_status()
        check("T6 tras autoreload el nuevo servidor Django sigue dentro del Job",
              reloaded and set(s3["listeners"][str(BACK)]) <= set(s3["job_pids"]))

        # ---- Apagado ----
        email, pwd = os.environ.get("LEDGER_TEST_EMAIL"), os.environ.get("LEDGER_TEST_PASSWORD")
        if email and pwd:
            code, tok = api("POST", "/api/auth/login/", body={"email": email, "password": pwd})
            token = tok.get("access")
            check("T9 sin token -> 401", api("POST", "/api/auth/shutdown/")[0] == 401)
            check("T9 GET -> 405", api("GET", "/api/auth/shutdown/", token)[0] == 405)
            if a.probe_vscode_backend and lp.port_pids(8000):
                c, _ = api("POST", "/api/auth/shutdown/", token, port=8000)
                check("T4 el backend de VS Code (sin entorno de Ledger) responde 409 y no apaga nada", c == 409)
                intact("T4 tras sondear VS Code")
            c, body = api("POST", "/api/auth/shutdown/", token,
                          body={"pid": list(watch[8000])[0], "name": "python.exe", "cmd": "calc"})
            check("T9/T10 200 recibido por el cliente con shutdown=accepted y cuerpo ignorado",
                  c == 200 and body.get("shutdown") == "accepted")
            c2, b2 = api("POST", "/api/auth/shutdown/", token)
            check("T4 segunda llamada: idempotente (200 pending) o servidor ya caido", c2 in (200, 0) or c2 == 200)
        else:
            skip("T9/T10 pruebas HTTP del endpoint", "defina LEDGER_TEST_EMAIL y LEDGER_TEST_PASSWORD")
            run_lp("stop", "--job", s1["registry"]["job_name"])

        check("T10 Job vacio y registro eliminado", wait_until(lambda: not (ROOT / ".ledger" / "run.json").exists(), 30))
        check("T10 puertos 8472 y 3001 liberados", wait_until(lambda: not lp.port_pids(BACK) and not lp.port_pids(FRONT), 20))
        left = ledger_leftovers()
        check("T10/T6 sin procesos propios huerfanos (linea de comandos)", not left)
        if left:
            print("  restos:", [(p["ProcessId"], p["Name"]) for p in left])
        intact("T4/T5 tras apagar Ledger")
        check("T10 apagado repetido por CLI: sin error", run_lp("stop").returncode == 0)

        # ---- Conflictos de puerto (T7) ----
        for occupied in ((BACK, FRONT), (FRONT,), (BACK,)):
            ds = [spawn_decoy("python" if p == BACK else "node", p) for p in occupied]
            try:
                check(f"T7 senuelos ajenos listos en {occupied}", all(wait_listen(p) for p in occupied))
                run_lp("start")
                st = status_txt()
                check(f"T7 {occupied}: start informa CONFLICT sin lanzar nada", st[0] == "CONFLICT"
                      and not (ROOT / ".ledger" / "run.json").exists())
                free = [p for p in (BACK, FRONT) if p not in occupied]
                check(f"T7 {occupied}: el puerto libre sigue libre (no se inicio ni un servidor)",
                      all(not lp.port_pids(p) for p in free))
                run_lp("stop")
                check(f"T7 {occupied}: `stop` no toca a los procesos ajenos", all(d.poll() is None for d in ds))
            finally:
                for d in ds:
                    d.terminate()
                time.sleep(1)

        # ---- Registro falso / Job suplantado (T5/T9) ----
        name = "Local\\Ledger-FORGED-" + os.urandom(8).hex()
        victim = spawn_decoy("python", 18999)
        try:
            wait_listen(18999)
            hj = lp.create_job(name)
            hp = lp.k32.OpenProcess(0x0101, False, victim.pid)   # SET_QUOTA | TERMINATE
            lp.k32.AssignProcessToJobObject(hj, hp)
            ident = lp.proc_identity(victim.pid)
            lp._atomic_json(lp.REGISTRY, {"version": 1, "job_name": name, "servers": {
                "backend": {"pid": victim.pid, "ctime": ident[0], "exe": "C:\\\\falso\\\\python.exe", "port": BACK}}})
            run_lp("stop", "--job", name)
            check("T9 Job suplantado con exe distinto: `stop` rechaza y el proceso sobrevive", victim.poll() is None)
            lp.drop_registry()
            lp._close(hp); lp._close(hj)
        finally:
            victim.terminate()
    finally:
        for d in own_decoys:
            d.terminate()

    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(bad)}/{len(results)} PASS, {len(skipped)} SKIP")
    for n in bad:
        print("FALLO:", n)
    return 1 if bad else 0


if __name__ == "__main__":
    if os.name != "nt":
        sys.exit("Esta prueba solo se ejecuta en Windows.")
    sys.exit(main())