param(
    [string]$RuntimePath,
    [string]$PythonCommand = 'py',
    [switch]$SkipModelDownload
)

$ErrorActionPreference = 'Stop'
if (-not $RuntimePath) {
    $localAppData = $env:LOCALAPPDATA
    if (-not $localAppData) {
        $localAppData = [Environment]::GetFolderPath('LocalApplicationData')
    }
    if (-not $localAppData) { throw 'LocalAppData location is unavailable.' }
    $RuntimePath = Join-Path (Join-Path $localAppData 'Mineradio-oirge') 'lyric-runtime'
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    throw 'FFmpeg command-line executable is required on PATH for audio decoding.'
}
$runtime = [System.IO.Path]::GetFullPath($RuntimePath)
$venv = Join-Path $runtime 'venv'
$python = Join-Path $venv 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    New-Item -ItemType Directory -Path $runtime -Force | Out-Null
    & $PythonCommand -3.13 -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.13 virtual environment creation failed.' }
}
& $python -m pip install 'torch==2.8.0' 'torchaudio==2.8.0' --index-url https://download.pytorch.org/whl/cpu
if ($LASTEXITCODE -ne 0) { throw 'CPU PyTorch installation failed.' }
& $python -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Alignment dependencies installation failed.' }
if (-not $SkipModelDownload) {
    & $python (Join-Path $PSScriptRoot 'align.py') --download-model --runtime $runtime
    if ($LASTEXITCODE -ne 0) { throw 'Forced alignment model download failed.' }
}
Write-Output $python
