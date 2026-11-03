"""
T0 - Prototipo tecnico de Job Objects (SOLO WINDOWS). Ejecutar PRIMERO:

    backend\\venv\\Scripts\\python.exe tests\\t0_job_prototype.py

Demuestra, con procesos reales y sin tocar Ledger ni nada tuyo:
  1. El Job (con nombre) sigue accesible despues de que el lanzador termina.
  2. Hijos y nietos quedan dentro del Job; un proceso externo NO.
  3. Un proceso creado con CREATE_BREAKAWAY_FROM_JOB desde dentro escapa del Job.
  4. TerminateJobObject desde OTRO proceso mata hijos+nietos y no toca al
     proceso que escapo ni al senuelo externo.
"""
import json, os, signal, subprocess, sys, tempfile, time, uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import ledger_proc as lp  # noqa: E402

NO_WINDOW, BREAKAWAY = 0x08000000, 0x01000000
SLEEP = [sys.executable, "-c", "import time; time.sleep(180)"]
CHILD_CODE = r'''
import json, os, subprocess, sys, time
SL = [sys.executable, "-c", "import time; time.sleep(180)"]
g = subprocess.Popen(SL, creationflags=0x08000000)
b = subprocess.Popen(SL, creationflags=0x08000000 | 0x01000000)
open(sys.argv[1], "w").write(json.dumps({"child": os.getpid(), "grandchild": g.pid, "breakaway": b.pid}))
time.sleep(180)
'''


def stage1(job_name, outfile):
    h = lp.create_job(job_name)
    assert lp.set_breakaway_ok(h) and lp.assign_current_process(h)
    subprocess.Popen([sys.executable, "-c", CHILD_CODE, outfile], creationflags=NO_WINDOW)
    for _ in range(100):
        if os.path.exists(outfile) and os.path.getsize(outfile):
            return 0          # el lanzador termina aqui, sin handle residente
        time.sleep(0.1)
    return 1


def alive(pid):
    return lp.proc_identity(pid) is not None


def main():
    results = []

    def check(name, ok):
        results.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name)

    job = "Local\\Ledger-T0-" + uuid.uuid4().hex
    out = os.path.join(tempfile.gettempdir(), "ledger_t0_" + uuid.uuid4().hex + ".json")
    decoy = subprocess.Popen(SLEEP, creationflags=NO_WINDOW)
    try:
        rc = subprocess.run([sys.executable, __file__, "stage1", job, out], timeout=60).returncode
        check("lanzador (stage1) termino con 0", rc == 0)
        pids = json.load(open(out))
        h = lp.open_job(job)
        check("T0.1 el Job sigue abierto por nombre tras terminar el lanzador", h)
        members = lp.job_pids(h)
        check("T0.2 hijo dentro del Job", pids["child"] in members)
        check("T0.2 nieto dentro del Job", pids["grandchild"] in members)
        check("T0.2 senuelo externo NO esta en el Job", decoy.pid not in members)
        check("T0.3 proceso con breakaway NO esta en el Job", pids["breakaway"] not in members)
        check("T0.3 este proceso (verificador) NO esta en el Job", os.getpid() not in members)
        lp.terminate_job(h, 0)
        check("T0.4 el Job queda vacio tras TerminateJobObject", lp.wait_job_empty(h, 10))
        time.sleep(0.5)
        check("T0.4 hijo muerto", not alive(pids["child"]))
        check("T0.4 nieto muerto", not alive(pids["grandchild"]))
        check("T0.4 proceso con breakaway sigue vivo", alive(pids["breakaway"]))
        check("T0.4 senuelo externo sigue vivo", decoy.poll() is None)
        lp._close(h)
        try:
            os.kill(pids["breakaway"], signal.SIGTERM)
        except OSError:
            pass
    finally:
        decoy.terminate()
        try:
            os.unlink(out)
        except OSError:
            pass
    print("\nT0 RESULT:", "ALL PASS" if all(results) else "FAILED", f"({len(results)} checks)")
    return 0 if all(results) else 1


if __name__ == "__main__":
    if os.name != "nt":
        sys.exit("T0 solo se ejecuta en Windows.")
    if len(sys.argv) >= 4 and sys.argv[1] == "stage1":
        sys.exit(stage1(sys.argv[2], sys.argv[3]))
    sys.exit(main())