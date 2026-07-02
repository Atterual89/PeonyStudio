param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$OutDir = "D:\peony_studio\PeonyStudio\work\responsive-check"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function New-CdpTab {
  param([string]$Url)
  $encoded = [System.Uri]::EscapeDataString($Url)
  Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:9223/json/new?$encoded"
}

function Receive-CdpMessage {
  param([System.Net.WebSockets.ClientWebSocket]$Socket)
  $buffer = [System.Array]::CreateInstance([byte], 1048576)
  $segment = [System.ArraySegment[byte]]::new($buffer)
  $builder = [System.Text.StringBuilder]::new()
  do {
    $result = $Socket.ReceiveAsync($segment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    if ($result.Count -gt 0) {
      [void]$builder.Append([System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count))
    }
  } while (-not $result.EndOfMessage)
  $builder.ToString() | ConvertFrom-Json
}

function Invoke-Cdp {
  param(
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [int]$Id,
    [string]$Method,
    [hashtable]$Params = @{}
  )
  $payload = @{ id = $Id; method = $Method; params = $Params } | ConvertTo-Json -Depth 20 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
  $segment = [System.ArraySegment[byte]]::new($bytes)
  $Socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  do {
    $message = Receive-CdpMessage -Socket $Socket
  } while ($message.id -ne $Id)
  if ($message.error) {
    throw ($message.error | ConvertTo-Json -Compress)
  }
  $message.result
}

function Test-Page {
  param(
    [string]$Path,
    [hashtable]$Viewport,
    [string]$ScrollName,
    [int]$ScrollY
  )
  $tab = New-CdpTab -Url "about:blank"
  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  $socket.ConnectAsync([Uri]$tab.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  $id = 1
  Invoke-Cdp -Socket $socket -Id ($id++) -Method "Page.enable" | Out-Null
  Invoke-Cdp -Socket $socket -Id ($id++) -Method "Runtime.enable" | Out-Null
  Invoke-Cdp -Socket $socket -Id ($id++) -Method "Emulation.setDeviceMetricsOverride" -Params @{
    width = $Viewport.width
    height = $Viewport.height
    deviceScaleFactor = 1
    mobile = $Viewport.mobile
  } | Out-Null
  Invoke-Cdp -Socket $socket -Id ($id++) -Method "Page.navigate" -Params @{ url = "$BaseUrl$Path" } | Out-Null
  Start-Sleep -Milliseconds 2500
  Invoke-Cdp -Socket $socket -Id ($id++) -Method "Runtime.evaluate" -Params @{ expression = "window.scrollTo(0,$ScrollY);" } | Out-Null
  Start-Sleep -Milliseconds 700
  $expr = @"
(() => {
  const text = document.body.innerText;
  const header = document.querySelector('header')?.getBoundingClientRect();
  const visibleLinks = [...document.querySelectorAll('a')].filter(a => a.offsetWidth && a.offsetHeight).length;
  const visibleButtons = [...document.querySelectorAll('button')].filter(b => b.offsetWidth && b.offsetHeight).length;
  const menuButton = [...document.querySelectorAll('button')].find(b => /Menu|menu/.test(b.innerText));
  return {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    badChars: /Â|â€¹|â€º|âˆ’/.test(text),
    visibleLinks,
    visibleButtons,
    hasMenuButton: !!menuButton,
    headerHeight: header ? header.height : null,
    firstText: text.slice(0, 280)
  };
})()
"@
  $metrics = Invoke-Cdp -Socket $socket -Id ($id++) -Method "Runtime.evaluate" -Params @{ expression = $expr; returnByValue = $true }
  $shot = Invoke-Cdp -Socket $socket -Id ($id++) -Method "Page.captureScreenshot" -Params @{ format = "png"; captureBeyondViewport = $false }
  $pageName = if ($Path -eq "/") { "home" } else { "calendar" }
  $file = Join-Path $OutDir "cdp-$pageName-$($Viewport.name)-$ScrollName.png"
  [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($shot.data))
  $socket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  [pscustomobject]@{
    page = $Path
    viewport = $Viewport.name
    scroll = $ScrollName
    screenshot = $file
    metrics = $metrics.result.value
  }
}

$viewports = @(
  @{ name = "desktop"; width = 1440; height = 1000; mobile = $false },
  @{ name = "laptop"; width = 1180; height = 900; mobile = $false },
  @{ name = "tablet"; width = 820; height = 1100; mobile = $false },
  @{ name = "mobile"; width = 390; height = 844; mobile = $true }
)

$results = @()
foreach ($vp in $viewports) {
  foreach ($path in @("/", "/calendario")) {
    $results += Test-Page -Path $path -Viewport $vp -ScrollName "top" -ScrollY 0
    $scrollY = if ($path -eq "/") { [int]($vp.height * 0.9) } else { [int]($vp.height * 0.5) }
    $results += Test-Page -Path $path -Viewport $vp -ScrollName "mid" -ScrollY $scrollY
  }
}

$results | ConvertTo-Json -Depth 12
