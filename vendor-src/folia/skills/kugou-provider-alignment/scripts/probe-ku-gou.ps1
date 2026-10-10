[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [ValidateSet('GET', 'POST')]
    [string]$Method = 'GET',

    [string]$QueryJson = '{}',

    [string]$BodyJson,

    [switch]$NoTimestamp,

    [string]$OutputPath,

    [ValidateRange(1, 300)]
    [int]$TimeoutSec = 30,

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$envPath = Join-Path $repoRoot '.env.local'
$credentialsPath = Join-Path $repoRoot '.dev-credentials\kugou.json'

# Read one named environment variable from the repository's dotenv file.
function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $FilePath)) {
        throw "Missing environment file: .env.local"
    }

    foreach ($line in Get-Content -LiteralPath $FilePath) {
        if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.*)\s*$") {
            $value = $matches[1].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                return $value.Substring(1, $value.Length - 2)
            }
            return $value
        }
    }

    throw "Missing $Name in .env.local"
}

# Read the ignored credential file without exposing its contents in errors or logs.
function Read-CredentialFile {
    param([Parameter(Mandatory = $true)][string]$FilePath)

    if (-not (Test-Path -LiteralPath $FilePath)) {
        throw "Missing development credentials: .dev-credentials/kugou.json"
    }

    $text = (Get-Content -LiteralPath $FilePath -Raw).Trim()
    if (-not $text) {
        throw "Development credentials file is empty: .dev-credentials/kugou.json"
    }

    try {
        return $text | ConvertFrom-Json -AsHashtable
    } catch {
        throw "Development credentials must contain valid JSON: .dev-credentials/kugou.json"
    }
}

# Read a case-insensitive key from either a JSON hashtable or object.
function Get-MapValue {
    param(
        [AllowNull()][object]$Map,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if ($null -eq $Map) { return $null }
    if ($Map -is [System.Collections.IDictionary]) {
        foreach ($key in $Map.Keys) {
            if ([string]::Equals([string]$key, $Name, [System.StringComparison]::OrdinalIgnoreCase)) {
                return $Map[$key]
            }
        }
        return $null
    }

    $property = $Map.PSObject.Properties | Where-Object { $_.Name -ieq $Name } | Select-Object -First 1
    if ($null -ne $property) { return $property.Value }
    return $null
}

# Find the first non-empty credential value across supported JSON blocks.
function Get-FirstMapValue {
    param(
        [AllowEmptyCollection()][object[]]$Maps,
        [Parameter(Mandatory = $true)][string[]]$Names
    )

    foreach ($map in $Maps) {
        foreach ($name in $Names) {
            $value = Get-MapValue -Map $map -Name $name
            if ($null -ne $value -and [string]$value -ne '') { return $value }
        }
    }
    return $null
}

# Convert cookie strings, arrays, or name/value maps to one Cookie header value.
function ConvertTo-CookieString {
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) { return '' }
    if ($Value -is [string]) { return $Value.Trim() }
    if ($Value -is [System.Collections.IDictionary]) {
        return (($Value.Keys | ForEach-Object { "$($_)=$($Value[$_])" }) -join '; ')
    }
    if ($Value -is [System.Collections.IEnumerable]) {
        return (($Value | ForEach-Object { [string]$_ }) -join '; ')
    }
    return [string]$Value
}

# Normalize a JSON object into string-valued HTTP headers.
function ConvertTo-StringMap {
    param([AllowNull()][object]$Value)

    $result = @{}
    if ($null -eq $Value) { return $result }
    if ($Value -is [System.Collections.IDictionary]) {
        foreach ($key in $Value.Keys) {
            if ($null -ne $Value[$key]) { $result[[string]$key] = [string]$Value[$key] }
        }
    }
    return $result
}

# Normalize a JSON object into query parameters without coercing nulls.
function ConvertTo-QueryMap {
    param([AllowNull()][object]$Value)

    $result = @{}
    if ($null -eq $Value) { return $result }
    if ($Value -is [System.Collections.IDictionary]) {
        foreach ($key in $Value.Keys) {
            if ($null -ne $Value[$key]) { $result[[string]$key] = $Value[$key] }
        }
    }
    return $result
}

# Hide authentication-like values in dry-run output while preserving request shape.
function Get-RedactedValue {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [AllowNull()][object]$Value
    )

    if ($Name -match '(?i)cookie|token|authorization|password|secret|userid|user_id|dfid') {
        return '<redacted>'
    }
    return $Value
}

# Combine the configured base URL, endpoint path, and encoded query parameters.
function Get-RequestUrl {
    param(
        [Parameter(Mandatory = $true)][string]$BaseUrl,
        [Parameter(Mandatory = $true)][string]$Endpoint,
        [Parameter(Mandatory = $true)][hashtable]$Query
    )

    $baseUri = [Uri]::new("$($BaseUrl.TrimEnd('/'))/")
    $targetUri = [Uri]::new($baseUri, $Endpoint.TrimStart('/'))
    $parts = foreach ($key in $Query.Keys) {
        if ($null -ne $Query[$key]) {
            $encodedKey = [Uri]::EscapeDataString([string]$key)
            $encodedValue = [Uri]::EscapeDataString([string]$Query[$key])
            "$encodedKey=$encodedValue"
        }
    }
    if ($parts.Count -gt 0) { return "$targetUri`?$($parts -join '&')" }
    return $targetUri.AbsoluteUri
}

$baseUrl = Get-EnvValue -FilePath $envPath -Name 'VITE_KUGOU_API_BASE'
if ([string]::IsNullOrWhiteSpace($baseUrl)) { throw 'VITE_KUGOU_API_BASE is empty in .env.local' }

$credentials = Read-CredentialFile -FilePath $credentialsPath
$requestBlock = Get-MapValue -Map $credentials -Name 'request'
$sessionBlock = Get-MapValue -Map $credentials -Name 'session'
$headerBlock = Get-FirstMapValue -Maps @($credentials, $requestBlock) -Names @('headers')
$headers = ConvertTo-StringMap -Value $headerBlock
$query = ConvertTo-QueryMap -Value (Get-FirstMapValue -Maps @($credentials, $requestBlock) -Names @('params', 'query'))

$cookieValue = Get-FirstMapValue -Maps @($credentials, $sessionBlock, $requestBlock, $headerBlock) -Names @('cookie', 'cookies', 'Cookie')
$cookie = ConvertTo-CookieString -Value $cookieValue
if ($cookie -and -not ($query.ContainsKey('cookie'))) { $query['cookie'] = $cookie }
if ($cookie -and -not (($headers.Keys | Where-Object { $_ -ieq 'Cookie' }).Count -gt 0)) { $headers['Cookie'] = $cookie }

$inputQuery = $QueryJson | ConvertFrom-Json -AsHashtable
foreach ($key in $inputQuery.Keys) { $query[[string]$key] = $inputQuery[$key] }
if (-not $NoTimestamp -and -not $query.ContainsKey('timestamp')) { $query['timestamp'] = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }

$url = Get-RequestUrl -BaseUrl $baseUrl -Endpoint $Path -Query $query
$body = $null
if ($PSBoundParameters.ContainsKey('BodyJson')) {
    $body = $BodyJson
    $null = $body | ConvertFrom-Json
}

if ($DryRun) {
    $safeHeaders = @{}
    foreach ($key in $headers.Keys) { $safeHeaders[$key] = Get-RedactedValue -Name $key -Value $headers[$key] }
    $safeQuery = @{}
    foreach ($key in $query.Keys) { $safeQuery[$key] = Get-RedactedValue -Name $key -Value $query[$key] }
    [pscustomobject]@{
        method = $Method
        url = Get-RequestUrl -BaseUrl $baseUrl -Endpoint $Path -Query $safeQuery
        headers = $safeHeaders
        body = $body
    } | ConvertTo-Json -Depth 20
    exit 0
}

$requestParams = @{
    Uri = $url
    Method = $Method
    Headers = $headers
    TimeoutSec = $TimeoutSec
    SkipHttpErrorCheck = $true
}
if ($null -ne $body) {
    $requestParams['Body'] = $body
    $requestParams['ContentType'] = 'application/json'
}

# Send one documented KuGou request and preserve the raw response for inspection or fixtures.
$response = Invoke-WebRequest @requestParams
$responseText = [string]$response.Content
if ($OutputPath) {
    $outputCandidate = if ([IO.Path]::IsPathRooted($OutputPath)) {
        $OutputPath
    } else {
        Join-Path (Get-Location) $OutputPath
    }
    $resolvedOutput = [IO.Path]::GetFullPath($outputCandidate)
    $outputDirectory = Split-Path -Parent $resolvedOutput
    if (-not (Test-Path -LiteralPath $outputDirectory)) { New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null }
    [IO.File]::WriteAllText($resolvedOutput, $responseText, [Text.UTF8Encoding]::new($false))
}

if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
    throw "KuGou API returned HTTP $($response.StatusCode). Inspect the saved response body for the application error."
}

Write-Output $responseText
