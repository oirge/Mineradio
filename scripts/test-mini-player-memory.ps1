$ErrorActionPreference = 'Stop'

# 该门禁只解析 PowerShell AST 和源码关键标记，避免测试阶段启动 Electron、窗口或后台进程。
$scriptPath = (Resolve-Path -LiteralPath $PSCommandPath).Path
$scriptText = Get-Content -Raw -LiteralPath $scriptPath
$tokens = $null
$parseErrors = $null
[System.Management.Automation.Language.Parser]::ParseInput(
    $scriptText,
    [ref]$tokens,
    [ref]$parseErrors
) | Out-Null
if ($parseErrors.Count -gt 0) {
    throw ('PowerShell AST 解析失败：' + ($parseErrors | ForEach-Object { $_.Message } -join '；'))
}

$rendererPath = Join-Path (Split-Path -Parent $scriptPath) '..\public\index.html'
$mainPath = Join-Path (Split-Path -Parent $scriptPath) '..\desktop\main.js'
$rendererText = Get-Content -Raw -LiteralPath (Resolve-Path -LiteralPath $rendererPath)
$mainText = Get-Content -Raw -LiteralPath (Resolve-Path -LiteralPath $mainPath)

# 这些标记锁定窗口销毁和状态缓存释放接缝；只做静态存在性检查，不模拟运行时进程。
$requiredRendererMarkers = @(
    'function pushMiniPlayerState(',
    'function handleDesktopMiniPlayerCommand(',
    'pushMiniPlayerState(true)'
)
$requiredMainMarkers = @(
    'const miniPlayerStateCache = new MiniPlayerStateCache',
    'setResident(false)',
    'destroyMiniPlayerWindowInstance('
)
foreach ($marker in $requiredRendererMarkers) {
    if ($rendererText.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
        throw ('renderer 缺少迷你播放器内存门禁：' + $marker)
    }
}
foreach ($marker in $requiredMainMarkers) {
    if ($mainText.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
        throw ('主进程缺少迷你播放器释放门禁：' + $marker)
    }
}

# 防止脚本以后被误改回会启动 GUI 或后台进程的形式。
$forbiddenScriptMarkers = @('Start-' + 'Process', 'electron.exe', 'ShowWindowAsync', 'Get-' + 'Process')
foreach ($marker in $forbiddenScriptMarkers) {
    if ($scriptText.IndexOf($marker, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw ('内存门禁脚本禁止启动或枚举进程：' + $marker)
    }
}

[PSCustomObject]@{
    Stage = 'ast-only'
    Script = $scriptPath
    RendererMarkers = $requiredRendererMarkers.Count
    MainMarkers = $requiredMainMarkers.Count
    ProcessLaunch = $false
}
