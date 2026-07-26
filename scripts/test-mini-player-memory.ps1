$ErrorActionPreference = 'Stop'

$electronPath = (Resolve-Path -LiteralPath 'node_modules\electron\dist\electron.exe').Path
$profilePath = Join-Path $env:TEMP ('Mineradio-Codex-Memory-' + [Guid]::NewGuid().ToString('N'))
$stdoutPath = Join-Path $profilePath 'stdout.log'
$stderrPath = Join-Path $profilePath 'stderr.log'
$rootProcess = $null

New-Item -ItemType Directory -Path $profilePath | Out-Null

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
/// <summary>提供测试脚本所需的 Windows 窗口状态切换入口。</summary>
public static class MineradioNativeWindow {
    /// <summary>切换指定原生窗口的显示状态。</summary>
    /// <param name="hWnd">目标窗口句柄。</param>
    /// <param name="nCmdShow">Windows ShowWindow 状态码。</param>
    /// <returns>请求是否成功提交给窗口管理器。</returns>
    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
'@

<#
.SYNOPSIS
收集指定 Electron 主进程及其全部后代进程编号。

.PARAMETER RootId
Electron 主进程编号。

.OUTPUTS
当前仍属于该进程树的进程编号数组；只读取系统进程表。
#>
function Get-MineradioProcessTreeIds([int]$RootId) {
    $processTable = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
    $processIds = [System.Collections.Generic.HashSet[int]]::new()
    [void]$processIds.Add($RootId)
    # Win32 进程表只提供直接父进程，需要逐层扩展才能覆盖 Electron 的渲染器和 GPU 后代。
    do {
        $changed = $false
        foreach ($entry in $processTable) {
            if ($processIds.Contains([int]$entry.ParentProcessId) -and $processIds.Add([int]$entry.ProcessId)) {
                $changed = $true
            }
        }
    } while ($changed)
    return @($processIds)
}

<#
.SYNOPSIS
生成 Electron 进程树的数量和内存快照。

.PARAMETER Label
当前窗口生命周期阶段名称。

.PARAMETER RootId
Electron 主进程编号。

.OUTPUTS
包含阶段、进程数、工作集和私有内存的对象；只读取进程指标。
#>
function Get-MineradioMemorySnapshot([string]$Label, [int]$RootId) {
    $processes = foreach ($processId in (Get-MineradioProcessTreeIds $RootId)) {
        Get-Process -Id $processId -ErrorAction SilentlyContinue
    }
    $processes = @($processes)
    $workingSet = ($processes | Measure-Object -Property WorkingSet64 -Sum).Sum
    $privateMemory = ($processes | Measure-Object -Property PrivateMemorySize64 -Sum).Sum
    return [PSCustomObject]@{
        Stage = $Label
        ProcessCount = $processes.Count
        WorkingSetMiB = [Math]::Round($workingSet / 1MB, 1)
        PrivateMiB = [Math]::Round($privateMemory / 1MB, 1)
    }
}

<#
.SYNOPSIS
等待 Electron 创建可操作的主窗口句柄。

.PARAMETER Process
由 Start-Process 返回的 Electron 主进程对象。

.OUTPUTS
主窗口句柄；等待超过 20 秒时显式失败。
#>
function Wait-MineradioMainWindowHandle([System.Diagnostics.Process]$Process) {
    $deadline = [DateTime]::UtcNow.AddSeconds(20)
    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 500
        $Process.Refresh()
        if ($Process.MainWindowHandle -ne [IntPtr]::Zero) {
            return $Process.MainWindowHandle
        }
    }
    throw 'Electron 主窗口句柄在 20 秒内未出现。'
}

try {
    $startParameters = @{
        FilePath = $electronPath
        ArgumentList = @("--user-data-dir=$profilePath", '.')
        WorkingDirectory = (Get-Location).Path
        WindowStyle = 'Hidden'
        RedirectStandardOutput = $stdoutPath
        RedirectStandardError = $stderrPath
        PassThru = $true
    }
    $rootProcess = Start-Process @startParameters

    $mainWindowHandle = Wait-MineradioMainWindowHandle $rootProcess
    Start-Sleep -Seconds 8
    $visibleSnapshot = Get-MineradioMemorySnapshot 'visible-before-mini' $rootProcess.Id

    [void][MineradioNativeWindow]::ShowWindowAsync($mainWindowHandle, 6)
    Start-Sleep -Seconds 5
    $minimizedSnapshot = Get-MineradioMemorySnapshot 'minimized-mini-visible' $rootProcess.Id

    [void][MineradioNativeWindow]::ShowWindowAsync($mainWindowHandle, 9)
    $releaseDeadline = [DateTime]::UtcNow.AddSeconds(12)
    do {
        Start-Sleep -Milliseconds 500
        $restoredSnapshot = Get-MineradioMemorySnapshot 'restored-mini-released' $rootProcess.Id
    } while ($restoredSnapshot.ProcessCount -gt $visibleSnapshot.ProcessCount -and [DateTime]::UtcNow -lt $releaseDeadline)

    [void][MineradioNativeWindow]::ShowWindowAsync($mainWindowHandle, 6)
    Start-Sleep -Seconds 5
    $recreatedSnapshot = Get-MineradioMemorySnapshot 'minimized-mini-recreated' $rootProcess.Id

    [void][MineradioNativeWindow]::ShowWindowAsync($mainWindowHandle, 9)
    $secondReleaseDeadline = [DateTime]::UtcNow.AddSeconds(12)
    do {
        Start-Sleep -Milliseconds 500
        $releasedAgainSnapshot = Get-MineradioMemorySnapshot 'restored-mini-released-again' $rootProcess.Id
    } while ($releasedAgainSnapshot.ProcessCount -gt $visibleSnapshot.ProcessCount -and [DateTime]::UtcNow -lt $secondReleaseDeadline)

    @($visibleSnapshot, $minimizedSnapshot, $restoredSnapshot, $recreatedSnapshot, $releasedAgainSnapshot) | Format-Table -AutoSize

    if ($minimizedSnapshot.ProcessCount -le $visibleSnapshot.ProcessCount) {
        throw '最小化后没有观察到迷你播放器渲染进程，测试场景未建立。'
    }
    if ($restoredSnapshot.ProcessCount -gt $visibleSnapshot.ProcessCount) {
        throw "主窗口恢复后仍保留 $($restoredSnapshot.ProcessCount - $visibleSnapshot.ProcessCount) 个额外 Electron 进程。"
    }
    if ($recreatedSnapshot.ProcessCount -le $restoredSnapshot.ProcessCount) {
        throw '第二次最小化后没有重新创建迷你播放器渲染进程。'
    }
    if ($releasedAgainSnapshot.ProcessCount -gt $visibleSnapshot.ProcessCount) {
        throw "第二次恢复后仍保留 $($releasedAgainSnapshot.ProcessCount - $visibleSnapshot.ProcessCount) 个额外 Electron 进程。"
    }
} finally {
    if ($rootProcess) {
        $processIds = Get-MineradioProcessTreeIds $rootProcess.Id | Sort-Object -Descending
        foreach ($processId in $processIds) {
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Milliseconds 500
    $fullProfilePath = [IO.Path]::GetFullPath($profilePath)
    $allowedPrefix = [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\Mineradio-Codex-Memory-'
    if ($fullProfilePath.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $fullProfilePath)) {
        Remove-Item -LiteralPath $fullProfilePath -Recurse -Force
    }
}
