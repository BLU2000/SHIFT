$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = $PSScriptRoot
$extracted = (Get-Content (Join-Path $root 'new-photo-locations.json') -Raw | ConvertFrom-Json).locations
$results = @()
function Read-GpsDegrees($bytes) {
    $parts = for ($i=0; $i -lt 3; $i++) {
        $numerator = [BitConverter]::ToUInt32($bytes, $i*8)
        $denominator = [BitConverter]::ToUInt32($bytes, $i*8+4)
        if ($denominator -eq 0) { throw 'Invalid denominator' }
        [double]$numerator / $denominator
    }
    $parts[0] + $parts[1]/60 + $parts[2]/3600
}
foreach ($file in Get-ChildItem (Join-Path $root 'images/images all/New Photos') -Filter '*.jpg') {
    $image = [System.Drawing.Image]::FromFile($file.FullName)
    try {
        $row = [ordered]@{ photo=$file.BaseName; independentGps=$false; latitude=$null; longitude=$null; matches=$null }
        if (($image.PropertyIdList -contains 1) -and ($image.PropertyIdList -contains 2) -and ($image.PropertyIdList -contains 3) -and ($image.PropertyIdList -contains 4)) {
            $latitude = Read-GpsDegrees $image.GetPropertyItem(2).Value
            $longitude = Read-GpsDegrees $image.GetPropertyItem(4).Value
            if ([Text.Encoding]::ASCII.GetString($image.GetPropertyItem(1).Value).StartsWith('S')) { $latitude = -$latitude }
            if ([Text.Encoding]::ASCII.GetString($image.GetPropertyItem(3).Value).StartsWith('W')) { $longitude = -$longitude }
            $row.independentGps=$true; $row.latitude=$latitude; $row.longitude=$longitude
            $original = $extracted.PSObject.Properties[$file.BaseName].Value
            $row.matches = $null -ne $original -and [Math]::Abs($latitude-$original.lat) -lt 0.0000001 -and [Math]::Abs($longitude-$original.lng) -lt 0.0000001
        }
        $results += [pscustomobject]$row
    } finally { $image.Dispose() }
}
$results | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $root 'coordinate-audit-independent.json') -Encoding UTF8
Write-Output ('Independent GPS: ' + @($results | Where-Object independentGps).Count)
Write-Output ('Matching: ' + @($results | Where-Object matches -eq $true).Count)
Write-Output ('Mismatches: ' + @($results | Where-Object { $_.independentGps -and !$_.matches }).Count)
