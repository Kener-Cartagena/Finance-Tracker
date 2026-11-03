Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)

' ===== Config =====
' Los puertos del backend (8472) y frontend (3001) se definen en ledger_proc.py.
' PUERTO_FRONT debe coincidir con FRONTEND_PORT de ledger_proc.py.
PUERTO_FRONT = 3001
URL = "http://localhost:" & PUERTO_FRONT

Function BuscarOpera()
    Dim rutas, r, cmd
    localEnv = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%")
    pf       = sh.ExpandEnvironmentStrings("%ProgramFiles%")
    pf86     = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%")
    
    rutas = Array( _
        localEnv & "\Programs\Opera\launcher.exe", _
        localEnv & "\Programs\Opera GX\launcher.exe", _
        localEnv & "\Programs\Opera\opera.exe", _
        pf & "\Opera\launcher.exe", _
        pf86 & "\Opera\launcher.exe")
        
    For Each r In rutas
        If fso.FileExists(r) Then 
            BuscarOpera = r 
            Exit Function
        End If
    Next

    On Error Resume Next
    cmd = sh.RegRead("HKCU\SOFTWARE\Clients\StartMenuInternet\OperaStable\shell\open\command\")
    If cmd = "" Then cmd = sh.RegRead("HKLM\SOFTWARE\Clients\StartMenuInternet\OperaStable\shell\open\command\")
    If cmd = "" Then cmd = sh.RegRead("HKCU\SOFTWARE\Clients\StartMenuInternet\Opera GX\shell\open\command\")
    On Error GoTo 0

    If cmd <> "" Then
        If InStr(cmd, """") > 0 Then cmd = Split(cmd, """")(1)
        If fso.FileExists(cmd) Then BuscarOpera = cmd : Exit Function
    End If

    BuscarOpera = ""
End Function

' --- 1. PRIMERO: LANZAR ANIMACIÓN (SPLASH) ---
Dim splashProc
splashPath = root & "\splash.html"
icoPath    = root & "\favicon.ico"

If fso.FileExists(splashPath) Then
    ' Ejecutamos MSHTA pasando la ruta absoluta para que registre el proceso con el icono en la barra de tareas
    Set splashProc = sh.Exec("mshta.exe """ & splashPath & """")
    WScript.Sleep 1200
End If

' --- 2. DETECTAR NAVEGADOR ---
operaApp = BuscarOpera()

' --- 3. SEGUNDO: ARRANCAR SERVIDORES (Job Object + comprobacion de puertos) ---
' ledger_proc.py start: detecta si Ledger ya corre, informa conflictos de puerto
' (sin tocar procesos ajenos), lanza backend 127.0.0.1:8472 y frontend :3001 dentro
' de un Job Object y espera a que ambos escuchen. Escribe .ledger\status.txt.
pyExe     = root & "\backend\venv\Scripts\python.exe"
helperPy  = root & "\ledger_proc.py"
statusTxt = root & "\.ledger\status.txt"

estado  = "ERROR"
mensaje = "No se encontro " & pyExe & " o " & helperPy
If fso.FileExists(pyExe) And fso.FileExists(helperPy) Then
    If fso.FileExists(statusTxt) Then fso.DeleteFile statusTxt, True
    sh.Run """" & pyExe & """ """ & helperPy & """ start", 0, True
    If fso.FileExists(statusTxt) Then
        Set fStatus = fso.OpenTextFile(statusTxt, 1)
        If Not fStatus.AtEndOfStream Then estado = Trim(fStatus.ReadLine)
        mensaje = ""
        Do Until fStatus.AtEndOfStream
            mensaje = mensaje & fStatus.ReadLine & vbCrLf
        Loop
        fStatus.Close
    Else
        mensaje = "El lanzador termino sin informar su estado. Revise .ledger\ledger.log"
    End If
End If

If estado <> "OK" Then
    On Error Resume Next
    If IsObject(splashProc) Then splashProc.Terminate
    On Error GoTo 0
    MsgBox mensaje, vbExclamation, "Ledger"
    WScript.Quit 1
End If

' --- 4. TERCERO: los servidores ya estan listos (start espera a que escuchen) ---

' Garantizar un mínimo de tiempo visible del logo si los servidores ya estaban encendidos
WScript.Sleep 500

' --- 5. CUARTO: CERRAR SPLASH Y ABRIR EN OPERA ---
On Error Resume Next
If IsObject(splashProc) Then splashProc.Terminate
On Error GoTo 0

If operaApp <> "" Then
    sh.Run """" & operaApp & """ """ & URL & """", 1, False
Else
    sh.Run "cmd /c start " & URL, 0, False
End If