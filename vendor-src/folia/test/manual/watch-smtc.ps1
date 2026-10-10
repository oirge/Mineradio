param(
    [string]$SourceAppId = 'top.izuna.foliamajor',
    [ValidateRange(100, 60000)]
    [int]$IntervalMs = 500,
    [switch]$AllSessions,
    [switch]$Once
)

# test/manual/watch-smtc.ps1
# Polls Windows SMTC without modifying any media session. Windows PowerShell 5.1 is used because
# PowerShell 7 does not project the Windows Runtime media-control types required by this API.

$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSEdition -ne 'Desktop') {
    $windowsPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    if (-not (Test-Path -LiteralPath $windowsPowerShell)) {
        throw 'Windows PowerShell 5.1 was not found; it is required to access the SMTC WinRT API.'
    }

    $forwardedArguments = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $PSCommandPath,
        '-SourceAppId', $SourceAppId,
        '-IntervalMs', [string]$IntervalMs
    )
    if ($AllSessions) { $forwardedArguments += '-AllSessions' }
    if ($Once) { $forwardedArguments += '-Once' }

    & $windowsPowerShell @forwardedArguments
    exit $LASTEXITCODE
}

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$mediaPropertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$asTaskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.IsGenericMethodDefinition -and
        $_.GetGenericArguments().Count -eq 1 -and
        $_.GetParameters().Count -eq 1
    } |
    Select-Object -First 1

if (-not $asTaskMethod) {
    throw 'Could not locate the Windows Runtime AsTask adapter.'
}

function Wait-WinRtOperation {
    param(
        [Parameter(Mandatory = $true)]$Operation,
        [Parameter(Mandatory = $true)][Type]$ResultType
    )

    $task = $script:asTaskMethod.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    return $task.GetAwaiter().GetResult()
}

function Format-SmtcText {
    param([AllowNull()][string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return '""' }
    $singleLine = $Value.Replace("`r", ' ').Replace("`n", ' ').Replace('"', '\"')
    return '"' + $singleLine + '"'
}

function Format-SmtcSeconds {
    param($Value)

    if ($null -eq $Value) { return '-' }
    return ([double]$Value.TotalSeconds).ToString('0.000', [Globalization.CultureInfo]::InvariantCulture)
}

function Get-SmtcSnapshot {
    param(
        [Parameter(Mandatory = $true)]$Session,
        [AllowNull()][string]$CurrentSourceAppId
    )

    $sourceAppId = $Session.SourceAppUserModelId
    $playbackInfo = $Session.GetPlaybackInfo()
    $timeline = $Session.GetTimelineProperties()
    $properties = Wait-WinRtOperation -Operation $Session.TryGetMediaPropertiesAsync() -ResultType $script:mediaPropertiesType

    return [pscustomobject]@{
        SourceAppId = $sourceAppId
        IsCurrent = $sourceAppId -eq $CurrentSourceAppId
        PlaybackStatus = [string]$playbackInfo.PlaybackStatus
        Title = [string]$properties.Title
        Artist = [string]$properties.Artist
        Album = [string]$properties.AlbumTitle
        TrackNumber = [uint32]$properties.TrackNumber
        HasThumbnail = $null -ne $properties.Thumbnail
        Position = $timeline.Position
        StartTime = $timeline.StartTime
        EndTime = $timeline.EndTime
        LastUpdatedTime = $timeline.LastUpdatedTime
    }
}

function Write-SmtcSnapshot {
    param(
        [Parameter(Mandatory = $true)]$Snapshot,
        [Parameter(Mandatory = $true)][string]$Timestamp
    )

    $position = Format-SmtcSeconds $Snapshot.Position
    $endTime = Format-SmtcSeconds $Snapshot.EndTime
    $updatedAt = if ($Snapshot.LastUpdatedTime) {
        $Snapshot.LastUpdatedTime.ToLocalTime().ToString('HH:mm:ss.fff')
    } else {
        '-'
    }

    Write-Output (
        '{0} FOUND current={1} source={2} status={3} title={4} artist={5} album={6} track={7} artwork={8} position={9}/{10} timelineUpdated={11}' -f
        $Timestamp,
        $Snapshot.IsCurrent.ToString().ToLowerInvariant(),
        (Format-SmtcText $Snapshot.SourceAppId),
        $Snapshot.PlaybackStatus,
        (Format-SmtcText $Snapshot.Title),
        (Format-SmtcText $Snapshot.Artist),
        (Format-SmtcText $Snapshot.Album),
        $Snapshot.TrackNumber,
        $Snapshot.HasThumbnail.ToString().ToLowerInvariant(),
        $position,
        $endTime,
        $updatedAt
    )
}

try {
    $manager = Wait-WinRtOperation -Operation $managerType::RequestAsync() -ResultType $managerType
} catch {
    $detail = $_.Exception.InnerException.Message
    if ([string]::IsNullOrWhiteSpace($detail)) { $detail = $_.Exception.Message }
    throw "Could not connect to the Windows SMTC session manager: $detail"
}
$mode = if ($AllSessions) { 'all sessions' } else { "source '$SourceAppId'" }
Write-Output "Monitoring SMTC $mode every $IntervalMs ms. Press Ctrl+C to stop."

do {
    $timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')

    try {
        $sessions = @($manager.GetSessions())
        $currentSession = $manager.GetCurrentSession()
        $currentSourceAppId = if ($currentSession) { [string]$currentSession.SourceAppUserModelId } else { $null }
        $matchingSessions = if ($AllSessions) {
            $sessions
        } else {
            @($sessions | Where-Object { $_.SourceAppUserModelId -eq $SourceAppId })
        }

        if ($matchingSessions.Count -eq 0) {
            $available = @($sessions | ForEach-Object { $_.SourceAppUserModelId }) -join ', '
            if ([string]::IsNullOrWhiteSpace($available)) { $available = '<none>' }
            if ($AllSessions) {
                Write-Output "$timestamp NO-SESSIONS available=$(Format-SmtcText $available)"
            } else {
                Write-Output "$timestamp MISSING expected=$(Format-SmtcText $SourceAppId) available=$(Format-SmtcText $available)"
            }
        } else {
            foreach ($session in $matchingSessions) {
                try {
                    $snapshot = Get-SmtcSnapshot -Session $session -CurrentSourceAppId $currentSourceAppId
                    Write-SmtcSnapshot -Snapshot $snapshot -Timestamp $timestamp
                } catch {
                    Write-Output "$timestamp READ-FAILED source=$(Format-SmtcText $session.SourceAppUserModelId) error=$(Format-SmtcText $_.Exception.Message)"
                }
            }
        }
    } catch {
        Write-Output "$timestamp ENUMERATION-FAILED error=$(Format-SmtcText $_.Exception.Message)"
    }

    if (-not $Once) {
        Start-Sleep -Milliseconds $IntervalMs
    }
} while (-not $Once)
