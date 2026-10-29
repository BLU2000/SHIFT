$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$browserFolder = Join-Path $PSScriptRoot 'images/browser-new-photos'
$sourceFolder = Join-Path $PSScriptRoot 'images/images all/New Photos'
New-Item -ItemType Directory -Path $browserFolder -Force | Out-Null
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
foreach ($source in Get-ChildItem -LiteralPath $sourceFolder -Filter '*.jpg') {
    $target = Join-Path $browserFolder $source.Name
    if ((Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).LastWriteTimeUtc -ge $source.LastWriteTimeUtc) { continue }
    $image = [System.Drawing.Image]::FromFile($source.FullName)
    try {
        if ($image.PropertyIdList -contains 274) {
            $orientation = [BitConverter]::ToUInt16($image.GetPropertyItem(274).Value, 0)
            $rotation = @{ 2 = 4; 3 = 2; 4 = 6; 5 = 5; 6 = 1; 7 = 7; 8 = 3 }
            if ($rotation.ContainsKey([int]$orientation)) { $image.RotateFlip([System.Drawing.RotateFlipType]$rotation[[int]$orientation]) }
        }
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
}
$locationFile = Join-Path $PSScriptRoot 'new-photo-locations.json'
$locations = if (Test-Path -LiteralPath $locationFile) { (Get-Content -LiteralPath $locationFile -Raw | ConvertFrom-Json).locations } else { $null }
$photos = @(Get-ChildItem -LiteralPath $sourceFolder -Filter '*.jpg' | Sort-Object Name | ForEach-Object {
    $cached = Join-Path $browserFolder $_.Name
    $entry = @{ id = $_.BaseName; name = $_.BaseName; src = 'data:image/jpeg;base64,' + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($cached)) }
    if ($null -ne $locations -and $locations.PSObject.Properties[$_.BaseName]) { $entry.location = $locations.PSObject.Properties[$_.BaseName].Value }
    $entry
})
if ($photos.Count -eq 0) { throw 'No browser images found. Run convert_photos.py first.' }
$data = @{ version = 1; dataset = 'facade-id-new-photos-20261028'; photos = $photos; records = @{}; conflicts = @() } | ConvertTo-Json -Depth 8 -Compress
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
    @{ Marker = '<script data-building-types src="building-types.js"></script>'; Path = 'building-types.js'; Tag = 'script' }
    @{ Marker = '<script data-sorting-canvas src="sorting-canvas.js"></script>'; Path = 'sorting-canvas.js'; Tag = 'script' }
    @{ Marker = '<link data-sorting-style rel="stylesheet" href="sorting-canvas.css">'; Path = 'sorting-canvas.css'; Tag = 'style' }
    @{ Marker = '<script data-photo-delete src="photo-delete.js"></script>'; Path = 'photo-delete.js'; Tag = 'script' }
    @{ Marker = '<script data-analysis-charts src="analysis-charts.js"></script>'; Path = 'analysis-charts.js'; Tag = 'script' }
    @{ Marker = '<script data-analysis-filters src="analysis-filters.js"></script>'; Path = 'analysis-filters.js'; Tag = 'script' }
    @{ Marker = '<script data-relationship-graphs src="relationship-graphs.js"></script>'; Path = 'relationship-graphs.js'; Tag = 'script' }
    @{ Marker = '<script data-graph-colors src="graph-colors.js"></script>'; Path = 'graph-colors.js'; Tag = 'script' }
    @{ Marker = '<link data-graph-colors-style rel="stylesheet" href="graph-colors.css">'; Path = 'graph-colors.css'; Tag = 'style' }
    @{ Marker = '<link data-relationship-style rel="stylesheet" href="relationship-graphs.css">'; Path = 'relationship-graphs.css'; Tag = 'style' }
    @{ Marker = '<link data-analysis-filters-style rel="stylesheet" href="analysis-filters.css">'; Path = 'analysis-filters.css'; Tag = 'style' }
    @{ Marker = '<link data-analysis-style rel="stylesheet" href="analysis-charts.css">'; Path = 'analysis-charts.css'; Tag = 'style' }
)) {
    $content = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot $asset.Path))
    if ($asset.Tag -eq 'script') { $content = $content.Replace('</script', '<\/script') }
    $output = $output.Replace($asset.Marker, '<' + $asset.Tag + '>' + $content + '</' + $asset.Tag + '>')
}
$destination = Join-Path $PSScriptRoot 'Facade-ID.html'
[System.IO.File]::WriteAllText($destination, $output, (New-Object System.Text.UTF8Encoding $false))
Write-Output "Created $destination with $($photos.Count) embedded photographs."
