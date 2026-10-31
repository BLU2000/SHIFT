Add-Type -AssemblyName System.IO.Compression.FileSystem
$source = 'C:\Users\Toolbox\Documents\05_venturelab\dud-vorlage_Canvas Ordner\dud-vorlage_Canvas.idml'
$target = Join-Path $PSScriptRoot 'translated\dud-vorlage_Canvas_EN.idml'
$map = @{
 'Fußzeile'='Footer'
 'Höchstens fünf Punkte'='Up to five points'
 'Spalte rechts'='Right column'
 'Spalte links'='Left column'
 'Titel'='Title'
 'Thema'='Topic'
 'Bildunterschrift'='Caption'
 'Bild · 388 × 296 pt'='Image · 388 × 296 pt'
 'Nachher'='After'
 'Vorher'='Before'
 'Ein bis drei Sätze'='One to three sentences'
 'Bild · 576 × 352 pt'='Image · 576 × 352 pt'
 'Thema · Halbsatz, höchstens acht Zeilen'='Topic · short phrase, up to eight lines'
 'Untertitel'='Subtitle'
 'Kapitel'='Chapter'
 'Quelle'='Source'
 'Legende · 208 × 70 pt'='Legend · 208 × 70 pt'
 'Karte oder Grafik · 576 × 352 pt'='Map or graphic · 576 × 352 pt'
 'Bild · 388 × 336 pt'='Image · 388 × 336 pt'
 'Text, höchstens fünf Punkte'='Text, up to five points'
 'Anlass · Datum'='Occasion · Date'
}
$inputZip = [IO.Compression.ZipFile]::OpenRead($source)
$outputZip = [IO.Compression.ZipFile]::Open($target, [IO.Compression.ZipArchiveMode]::Create)
$script:count = 0
try {
 foreach ($entry in $inputZip.Entries) {
  $stream = $entry.Open()
  $memory = [IO.MemoryStream]::new()
  $stream.CopyTo($memory)
  $stream.Dispose()
  $bytes = $memory.ToArray()
  $memory.Dispose()
  if ($entry.FullName -like 'Stories/*.xml') {
   $xml = [Text.Encoding]::UTF8.GetString($bytes)
   $xml = [regex]::Replace($xml, '<Content>(.*?)</Content>', {
    param($match)
    $text = [Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
    if ($map.ContainsKey($text)) {
     $script:count++
     return '<Content>' + [Security.SecurityElement]::Escape($map[$text]) + '</Content>'
    }
    return $match.Value
   }, [Text.RegularExpressions.RegexOptions]::Singleline)
   $bytes = [Text.Encoding]::UTF8.GetBytes($xml)
  }
  $newEntry = $outputZip.CreateEntry($entry.FullName, [IO.Compression.CompressionLevel]::NoCompression)
  $newEntry.LastWriteTime = $entry.LastWriteTime
  $outStream = $newEntry.Open()
  $outStream.Write($bytes, 0, $bytes.Length)
  $outStream.Dispose()
 }
} finally {
 $inputZip.Dispose()
 $outputZip.Dispose()
}
# Verify all differences are exclusively translated Content elements.
$a = [IO.Compression.ZipFile]::OpenRead($source)
$b = [IO.Compression.ZipFile]::OpenRead($target)
try {
 foreach ($entry in $a.Entries) {
  $other = $b.GetEntry($entry.FullName)
  $r1 = [IO.StreamReader]::new($entry.Open())
  $r2 = [IO.StreamReader]::new($other.Open())
  $s1 = $r1.ReadToEnd(); $s2 = $r2.ReadToEnd()
  $r1.Dispose(); $r2.Dispose()
  if ($entry.FullName -like 'Stories/*.xml') {
   $s1 = [regex]::Replace($s1, '<Content>.*?</Content>', '<Content/>', 'Singleline')
   $s2 = [regex]::Replace($s2, '<Content>.*?</Content>', '<Content/>', 'Singleline')
  }
  if ($s1 -cne $s2) { throw "Unexpected change in $($entry.FullName)" }
 }
} finally { $a.Dispose(); $b.Dispose() }
Write-Output "Translated $script:count text elements. Verified no changes outside text contents. Output: $target"
