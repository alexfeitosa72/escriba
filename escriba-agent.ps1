param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 8765
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$appDirectory = $PSScriptRoot
$baseAddress = "http://127.0.0.1:$Port/"
$tokenBytes = New-Object byte[] 32
$randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $randomGenerator.GetBytes($tokenBytes) } finally { $randomGenerator.Dispose() }
$sessionToken = [Convert]::ToBase64String($tokenBytes)
$allowedProcesses = @("msedge", "chrome", "firefox")

Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public static class EscribaNative
{
    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT
    {
        public uint type;
        public InputUnion union;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)] public KEYBDINPUT keyboard;
        [FieldOffset(0)] public MOUSEINPUT mouse;
        [FieldOffset(0)] public HARDWAREINPUT hardware;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT
    {
        public ushort virtualKey;
        public ushort scanCode;
        public uint flags;
        public uint time;
        public UIntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint flags;
        public uint time;
        public UIntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct HARDWAREINPUT
    {
        public uint message;
        public ushort parameterLow;
        public ushort parameterHigh;
    }

    private const uint InputKeyboard = 1;
    private const uint KeyUp = 0x0002;
    private const uint Unicode = 0x0004;
    private const ushort VkShift = 0x10;
    private const ushort VkControl = 0x11;
    private const ushort VkMenu = 0x12;
    private const ushort VkReturn = 0x0D;
    private const ushort VkTab = 0x09;
    private const ushort VkBack = 0x08;
    private const ushort VkHome = 0x24;
    private const uint KeyExtended = 0x0001;
    private const int VkEscape = 0x1B;

    [ThreadStatic]
    private static int lastError;

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint inputCount, INPUT[] inputs, int size);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr window, StringBuilder text, int maxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll")]
    private static extern IntPtr GetKeyboardLayout(uint threadId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern short VkKeyScanEx(char character, IntPtr keyboardLayout);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int virtualKey);

    public static bool EscapePressed()
    {
        return (GetAsyncKeyState(VkEscape) & 0x8000) != 0;
    }

    public static int GetLastError()
    {
        return lastError;
    }

    public static int GetInputStructureSize()
    {
        return Marshal.SizeOf(typeof(INPUT));
    }

    public static string GetWindowTitle(IntPtr window)
    {
        StringBuilder title = new StringBuilder(512);
        GetWindowText(window, title, title.Capacity);
        return title.ToString();
    }

    public static string GetProcessName(IntPtr window)
    {
        uint processId;
        GetWindowThreadProcessId(window, out processId);
        if (processId == 0) return String.Empty;
        try { return Process.GetProcessById((int)processId).ProcessName.ToLowerInvariant(); }
        catch { return String.Empty; }
    }

    public static bool SendCharacter(char character, IntPtr targetWindow)
    {
        if (character == '\r') return true;
        if (character == '\n') return SendVirtualKey(VkReturn);
        if (character == '\t') return SendVirtualKey(VkTab);

        uint processId;
        uint threadId = GetWindowThreadProcessId(targetWindow, out processId);
        IntPtr layout = GetKeyboardLayout(threadId);
        short mapping = VkKeyScanEx(character, layout);

        if (mapping == -1) return SendUnicode(character);

        ushort virtualKey = (ushort)(mapping & 0xFF);
        int modifiers = (mapping >> 8) & 0xFF;
        bool shift = (modifiers & 1) != 0;
        bool control = (modifiers & 2) != 0;
        bool alt = (modifiers & 4) != 0;

        if (control && !SendKey(VkControl, false)) return false;
        if (alt && !SendKey(VkMenu, false)) return false;
        if (shift && !SendKey(VkShift, false)) return false;

        bool result = SendKey(virtualKey, false) && SendKey(virtualKey, true);

        if (shift) result = SendKey(VkShift, true) && result;
        if (alt) result = SendKey(VkMenu, true) && result;
        if (control) result = SendKey(VkControl, true) && result;
        return result;
    }

    // Seleciona do cursor ao início da linha (Shift+Home). Home é tecla estendida.
    // O primeiro caractere digitado em seguida substitui a seleção, removendo o recuo automático do editor.
    public static bool SelectToLineStart()
    {
        return SendKey(VkShift, false, false)
            && SendKey(VkHome, false, true)
            && SendKey(VkHome, true, true)
            && SendKey(VkShift, true, false);
    }

    public static bool SendBackspace()
    {
        return SendVirtualKey(VkBack);
    }

    private static bool SendVirtualKey(ushort virtualKey)
    {
        return SendKey(virtualKey, false) && SendKey(virtualKey, true);
    }

    private static bool SendKey(ushort virtualKey, bool keyUp)
    {
        return SendKey(virtualKey, keyUp, false);
    }

    private static bool SendKey(ushort virtualKey, bool keyUp, bool extended)
    {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = InputKeyboard;
        inputs[0].union.keyboard.virtualKey = virtualKey;
        inputs[0].union.keyboard.flags = (keyUp ? KeyUp : 0) | (extended ? KeyExtended : 0);
        uint sent = SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
        lastError = sent == 1 ? 0 : Marshal.GetLastWin32Error();
        return sent == 1;
    }

    private static bool SendUnicode(char character)
    {
        INPUT[] inputs = new INPUT[2];
        inputs[0].type = InputKeyboard;
        inputs[0].union.keyboard.scanCode = character;
        inputs[0].union.keyboard.flags = Unicode;
        inputs[1].type = InputKeyboard;
        inputs[1].union.keyboard.scanCode = character;
        inputs[1].union.keyboard.flags = Unicode | KeyUp;
        uint sent = SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
        lastError = sent == 2 ? 0 : Marshal.GetLastWin32Error();
        return sent == 2;
    }
}
'@

$state = [hashtable]::Synchronized(@{
    Status = "idle"
    Message = "Agente disponível"
    Position = 0
    Total = 0
    CancelRequested = $false
    PauseRequested = $false
    ResumeRequested = $false
    TargetTitle = ""
    TargetProcess = ""
})

$expectedInputSize = if ([IntPtr]::Size -eq 8) { 40 } else { 28 }
$actualInputSize = [EscribaNative]::GetInputStructureSize()
if ($actualInputSize -ne $expectedInputSize) {
    throw "Estrutura Win32 INPUT inválida. Esperado: $expectedInputSize bytes; obtido: $actualInputSize bytes."
}

$workerPowerShell = $null
$workerHandle = $null

function Write-JsonResponse {
    param(
        [Parameter(Mandatory)]$Context,
        [Parameter(Mandatory)]$Value,
        [int]$StatusCode = 200
    )

    $json = $Value | ConvertTo-Json -Compress -Depth 6
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $Context.Response.StatusCode = $StatusCode
    $Context.Response.ContentType = "application/json; charset=utf-8"
    $Context.Response.ContentLength64 = $bytes.Length
    $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Context.Response.Close()
}

function Write-TextResponse {
    param(
        [Parameter(Mandatory)]$Context,
        [Parameter(Mandatory)][byte[]]$Bytes,
        [Parameter(Mandatory)][string]$ContentType,
        [int]$StatusCode = 200
    )

    $Context.Response.StatusCode = $StatusCode
    $Context.Response.ContentType = $ContentType
    $Context.Response.ContentLength64 = $Bytes.Length
    $Context.Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    $Context.Response.Close()
}

function Test-AuthorizedRequest {
    param([Parameter(Mandatory)]$Request)

    $origin = $Request.Headers["Origin"]
    if ($origin -and $origin -ne $baseAddress.TrimEnd('/')) { return $false }
    return $Request.Headers["X-Escriba-Token"] -eq $sessionToken
}

function Get-StateSnapshot {
    return [ordered]@{
        status = $state.Status
        message = $state.Message
        position = [int]$state.Position
        total = [int]$state.Total
        targetTitle = $state.TargetTitle
        targetProcess = $state.TargetProcess
    }
}

function Stop-FinishedWorker {
    if ($null -ne $workerHandle -and $workerHandle.IsCompleted) {
        try { $null = $workerPowerShell.EndInvoke($workerHandle) } catch { }
        $workerPowerShell.Dispose()
        $script:workerPowerShell = $null
        $script:workerHandle = $null
    }
}

function Start-TypingWorker {
    param([Parameter(Mandatory)]$Payload)

    if ($state.Status -in @("countdown", "typing", "paused")) {
        throw "Já existe uma digitação em andamento."
    }

    $text = [string]$Payload.text
    if ([string]::IsNullOrEmpty($text)) { throw "O bloco está vazio." }
    if ($text.Length -gt 200000) { throw "O bloco excede o limite de 200.000 caracteres." }

    $keyDelay = [Math]::Max(5, [Math]::Min(250, [int]$Payload.keyDelay))
    $lineDelay = [Math]::Max(0, [Math]::Min(1000, [int]$Payload.lineDelay))
    $countdown = [Math]::Max(3, [Math]::Min(15, [int]$Payload.countdown))
    $clearAutoIndent = [bool]$Payload.clearAutoIndent

    $state.Status = "countdown"
    $state.Message = "Aguardando seleção da janela remota"
    $state.Position = 0
    $state.Total = $text.Length
    $state.CancelRequested = $false
    $state.PauseRequested = $false
    $state.ResumeRequested = $false
    $state.TargetTitle = ""
    $state.TargetProcess = ""

    $workerScript = {
        param($shared, $content, $delay, $afterLine, $seconds, $permittedProcesses, $clearAutoIndent)

        function Test-Cancelled {
            if ($shared.CancelRequested -or [EscribaNative]::EscapePressed()) {
                $shared.Status = "cancelled"
                $shared.Message = "Digitação cancelada"
                return $true
            }
            return $false
        }

        try {
            while ([EscribaNative]::EscapePressed()) { Start-Sleep -Milliseconds 50 }

            for ($remaining = $seconds; $remaining -gt 0; $remaining--) {
                if (Test-Cancelled) { return }
                $shared.Message = "Selecione o editor remoto. Início em $remaining s"
                Start-Sleep -Seconds 1
            }

            if (Test-Cancelled) { return }
            $targetWindow = [EscribaNative]::GetForegroundWindow()
            $targetTitle = [EscribaNative]::GetWindowTitle($targetWindow)
            $targetProcess = [EscribaNative]::GetProcessName($targetWindow)

            if ($targetWindow -eq [IntPtr]::Zero -or [string]::IsNullOrWhiteSpace($targetTitle)) {
                throw "Nenhuma janela de destino válida foi encontrada."
            }
            if ($permittedProcesses -notcontains $targetProcess) {
                throw "A janela ativa não pertence a um navegador autorizado."
            }
            if ($targetTitle -match "(?i)escriba") {
                throw "O próprio Escriba não pode ser usado como destino remoto."
            }

            $shared.TargetTitle = $targetTitle
            $shared.TargetProcess = $targetProcess
            $shared.Status = "typing"
            $shared.Message = "Digitando na janela autorizada"

            for ($index = 0; $index -lt $content.Length; $index++) {
                if (Test-Cancelled) { return }

                $currentWindow = [EscribaNative]::GetForegroundWindow()
                $currentTitle = [EscribaNative]::GetWindowTitle($currentWindow)
                if ($currentWindow -ne $targetWindow -or $currentTitle -ne $targetTitle -or $shared.PauseRequested) {
                    $shared.Status = "paused"
                    $shared.Message = "Pausado. Retorne à janela original e selecione Retomar"
                    $shared.PauseRequested = $false
                    $shared.ResumeRequested = $false

                    while (-not $shared.ResumeRequested) {
                        if (Test-Cancelled) { return }
                        Start-Sleep -Milliseconds 80
                    }

                    $shared.ResumeRequested = $false
                    $shared.Status = "countdown"
                    for ($resumeCountdown = 3; $resumeCountdown -gt 0; $resumeCountdown--) {
                        if (Test-Cancelled) { return }
                        $shared.Message = "Retorne à janela original. Continuação em $resumeCountdown s"
                        Start-Sleep -Seconds 1
                    }

                    $currentWindow = [EscribaNative]::GetForegroundWindow()
                    $currentTitle = [EscribaNative]::GetWindowTitle($currentWindow)
                    if ($currentWindow -ne $targetWindow -or $currentTitle -ne $targetTitle) {
                        throw "A janela original não estava ativa ao retomar."
                    }
                    $shared.Status = "typing"
                    $shared.Message = "Digitação retomada"
                }

                $character = [char]$content[$index]
                if (-not [EscribaNative]::SendCharacter($character, $targetWindow)) {
                    $nativeError = [EscribaNative]::GetLastError()
                    throw "O Windows recusou o envio de uma tecla. Código Win32: $nativeError."
                }

                if ($character -eq "`n" -and $clearAutoIndent -and $index + 1 -lt $content.Length) {
                    # Editores com auto-indentação (Ace/Zeppelin) acumulam o recuo digitado sobre o recuo automático.
                    # Shift+Home seleciona o recuo automático; o próximo caractere o substitui.
                    $null = [EscribaNative]::SelectToLineStart()
                    $upcoming = $content[$index + 1]
                    if ("'`"([{``".Contains([string]$upcoming)) {
                        # Pares automáticos (aspas, parênteses) envolveriam a seleção; um espaço a consome antes.
                        $null = [EscribaNative]::SendCharacter([char]' ', $targetWindow)
                        $null = [EscribaNative]::SendBackspace()
                    }
                }

                $shared.Position = $index + 1
                $wait = $delay
                if ($character -eq "`n") { $wait += $afterLine }
                if ($wait -gt 0) { Start-Sleep -Milliseconds $wait }
            }

            $shared.Status = "completed"
            $shared.Message = "Bloco concluído"
        }
        catch {
            $shared.Status = "error"
            $shared.Message = $_.Exception.Message
        }
    }

    $script:workerPowerShell = [PowerShell]::Create()
    $null = $workerPowerShell.AddScript($workerScript.ToString()).AddArgument($state).AddArgument($text).AddArgument($keyDelay).AddArgument($lineDelay).AddArgument($countdown).AddArgument($allowedProcesses).AddArgument($clearAutoIndent)
    $script:workerHandle = $workerPowerShell.BeginInvoke()
}

$contentTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css" = "text/css; charset=utf-8"
    ".js" = "application/javascript; charset=utf-8"
    ".md" = "text/markdown; charset=utf-8"
}

$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add($baseAddress)

try {
    $listener.Start()
    Write-Host "Escriba 0.3.0 iniciado em $baseAddress"
    Write-Host "Mantenha esta janela aberta. Use Ctrl+C para encerrar o agente."
    Start-Process $baseAddress

    while ($listener.IsListening) {
        Stop-FinishedWorker
        $context = $listener.GetContext()
        $request = $context.Request
        $path = $request.Url.AbsolutePath

        try {
            if ($path -eq "/agent-config.js" -and $request.HttpMethod -eq "GET") {
                $config = "window.EscribaAgentConfig = Object.freeze({ available: true, token: '$sessionToken' });"
                Write-TextResponse -Context $context -Bytes ([Text.Encoding]::UTF8.GetBytes($config)) -ContentType "application/javascript; charset=utf-8"
                continue
            }

            if ($path.StartsWith("/api/")) {
                if (-not (Test-AuthorizedRequest -Request $request)) {
                    Write-JsonResponse -Context $context -StatusCode 403 -Value @{ error = "Solicitação não autorizada." }
                    continue
                }

                if ($path -eq "/api/status" -and $request.HttpMethod -eq "GET") {
                    Write-JsonResponse -Context $context -Value (Get-StateSnapshot)
                    continue
                }

                if ($path -eq "/api/start" -and $request.HttpMethod -eq "POST") {
                    if ($request.ContentLength64 -gt 1048576) { throw "A solicitação excede 1 MiB." }
                    # O corpo produzido pelo navegador é UTF-8. Não depender da codificação inferida pelo HttpListener.
                    $reader = [IO.StreamReader]::new($request.InputStream, [Text.Encoding]::UTF8, $true)
                    try { $payload = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
                    Start-TypingWorker -Payload $payload
                    Write-JsonResponse -Context $context -StatusCode 202 -Value (Get-StateSnapshot)
                    continue
                }

                if ($path -eq "/api/pause" -and $request.HttpMethod -eq "POST") {
                    if ($state.Status -eq "typing") { $state.PauseRequested = $true }
                    Write-JsonResponse -Context $context -Value (Get-StateSnapshot)
                    continue
                }

                if ($path -eq "/api/resume" -and $request.HttpMethod -eq "POST") {
                    if ($state.Status -eq "paused") { $state.ResumeRequested = $true }
                    Write-JsonResponse -Context $context -Value (Get-StateSnapshot)
                    continue
                }

                if ($path -eq "/api/cancel" -and $request.HttpMethod -eq "POST") {
                    $state.CancelRequested = $true
                    Write-JsonResponse -Context $context -Value (Get-StateSnapshot)
                    continue
                }

                Write-JsonResponse -Context $context -StatusCode 404 -Value @{ error = "Rota não encontrada." }
                continue
            }

            $relativePath = if ($path -eq "/") { "index.html" } else { $path.TrimStart('/') }
            $candidatePath = [IO.Path]::GetFullPath((Join-Path $appDirectory $relativePath))
            $rootPath = [IO.Path]::GetFullPath($appDirectory + [IO.Path]::DirectorySeparatorChar)

            if (-not $candidatePath.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($candidatePath)) {
                Write-JsonResponse -Context $context -StatusCode 404 -Value @{ error = "Arquivo não encontrado." }
                continue
            }

            $extension = [IO.Path]::GetExtension($candidatePath).ToLowerInvariant()
            $contentType = if ($contentTypes.ContainsKey($extension)) { $contentTypes[$extension] } else { "application/octet-stream" }
            $bytes = [IO.File]::ReadAllBytes($candidatePath)
            $context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
            $context.Response.Headers["Cache-Control"] = "no-store"
            $context.Response.Headers["X-Content-Type-Options"] = "nosniff"
            Write-TextResponse -Context $context -Bytes $bytes -ContentType $contentType
        }
        catch {
            if ($context.Response.OutputStream.CanWrite) {
                Write-JsonResponse -Context $context -StatusCode 400 -Value @{ error = $_.Exception.Message }
            }
        }
    }
}
finally {
    $state.CancelRequested = $true
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
    if ($null -ne $workerPowerShell) { $workerPowerShell.Dispose() }
}
