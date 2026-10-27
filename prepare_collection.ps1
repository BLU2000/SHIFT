$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$browserFolder = Join-Path $PSScriptRoot 'images/browser'
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
foreach ($source in Get-ChildItem -LiteralPath $browserFolder -Filter '*.bmp') {
    $target = [System.IO.Path]::ChangeExtension($source.FullName, '.jpg')
    $image = [System.Drawing.Image]::FromFile($source.FullName)
    try {
        $scale = [Math]::Min([double]1, [double]1600 / [Math]::Max($image.Width, $image.Height))
        $bitmap = New-Object System.Drawing.Bitmap ([int]($image.Width * $scale)), ([int]($image.Height * $scale))
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($image, 0, 0, $bitmap.Width, $bitmap.Height)
            $parameters = New-Object System.Drawing.Imaging.EncoderParameters 1
            $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]85)
            $bitmap.Save($target, $jpegCodec, $parameters)
            $parameters.Dispose()
        } finally { $graphics.Dispose(); $bitmap.Dispose() }
    } finally { $image.Dispose() }
    # Only delete intermediate BMPs created by convert_photos.py, inside this workspace.
    $resolved = [System.IO.Path]::GetFullPath($source.FullName)
    if (!$resolved.StartsWith([System.IO.Path]::GetFullPath($browserFolder) + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Unexpected intermediate path' }
    Remove-Item -LiteralPath $resolved
}
$locationFile = Join-Path $PSScriptRoot 'photo-locations.json'
$locations = if (Test-Path -LiteralPath $locationFile) { (Get-Content -LiteralPath $locationFile -Raw | ConvertFrom-Json).locations } else { $null }
$photos = @(Get-ChildItem -LiteralPath $browserFolder -Filter '*.jpg' | Sort-Object Name | ForEach-Object {
    $entry = @{ id = $_.BaseName; name = $_.BaseName; src = 'data:image/jpeg;base64,' + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($_.FullName)) }
    if ($null -ne $locations -and $locations.PSObject.Properties[$_.BaseName]) { $entry.location = $locations.PSObject.Properties[$_.BaseName].Value }
    $entry
})
if ($photos.Count -eq 0) { throw 'No browser images found. Run convert_photos.py first.' }
$data = @{ version = 1; dataset = 'shift-facades-v1'; photos = $photos; records = @{}; conflicts = @() } | ConvertTo-Json -Depth 8 -Compress
$template = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'index.html'))
$pattern = '(?s)(<script id="collection-data" type="application/json">).*?(</script>)'
$output = [regex]::Replace($template, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $m.Groups[1].Value + $data + $m.Groups[2].Value })
# Keep the deliverable as a single HTML file, including the open-source map controls.
foreach ($asset in @(
    @{ Marker = '<link data-map-style rel="stylesheet" href="vendor/maplibre-gl.css">'; Path = 'vendor/maplibre-gl.css'; Tag = 'style' },
    @{ Marker = '<link data-map-ui-style rel="stylesheet" href="map-picker.css">'; Path = 'map-picker.css'; Tag = 'style' },
    @{ Marker = '<script data-map-library src="vendor/maplibre-gl.js"></script>'; Path = 'vendor/maplibre-gl.js'; Tag = 'script' },
    @{ Marker = '<script data-map-picker src="map-picker.js"></script>'; Path = 'map-picker.js'; Tag = 'script' }
    @{ Marker = '<script data-save-dialog src="save-dialog.js"></script>'; Path = 'save-dialog.js'; Tag = 'script' }
    @{ Marker = '<script data-photo-upload src="photo-upload.js"></script>'; Path = 'photo-upload.js'; Tag = 'script' }
    @{ Marker = '<script data-analysis-charts src="analysis-charts.js"></script>'; Path = 'analysis-charts.js'; Tag = 'script' }
    @{ Marker = '<link data-analysis-style rel="stylesheet" href="analysis-charts.css">'; Path = 'analysis-charts.css'; Tag = 'style' }
)) {
    $content = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot $asset.Path))
    if ($asset.Tag -eq 'script') { $content = $content.Replace('</script', '<\/script') }
    $output = $output.Replace($asset.Marker, '<' + $asset.Tag + '>' + $content + '</' + $asset.Tag + '>')
}
$destination = Join-Path $PSScriptRoot 'Facade-ID.html'
[System.IO.File]::WriteAllText($destination, $output, (New-Object System.Text.UTF8Encoding $false))
Write-Output "Created $destination with $($photos.Count) embedded photographs."
