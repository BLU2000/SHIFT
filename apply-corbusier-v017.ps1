# Screen approximations, not paint specifications.
# Palette references: https://www.lescouleurs.ch/ and
# https://www.photoshoplus.fr/couleurs/couleurs-lecorbusier/
$path=Join-Path $PSScriptRoot 'Facade-ID_BU_v017.html'
$html=[IO.File]::ReadAllText($path)
$palette="['#3957a5','#ac443a','#406e58','#b8a136','#3e6e90','#744438','#dba3af','#d46c40','#7fa25a','#7aa7cb','#74393b','#dbb07f','#679dae','#94394d','#928a7e','#91afa1','#cd9886','#8fabc9','#68443c','#313d6b']"
$html=[regex]::Replace($html,'const graphCategoryPalette=\[[^\]]+\];',"const graphCategoryPalette=$palette;")
$html=[regex]::Replace($html,'function graphCategoryColor\(index\)\{[\s\S]*?\n\}', 'function graphCategoryColor(index){return graphCategoryPalette[((index%graphCategoryPalette.length)+graphCategoryPalette.length)%graphCategoryPalette.length];}')
$html=$html.Replace('const start=[220,234,255],end=[0,47,167]','const start=[217,225,221],end=[57,87,165]')
$html=[regex]::Replace($html,'<(style|script)\b[^>]*>[\s\S]*?</\1>',[Text.RegularExpressions.MatchEvaluator]{
 param($m)
 if($m.Value.StartsWith('<script id="collection-data"')){return $m.Value}
 return [regex]::Replace($m.Value,'#002fa7','#3957a5',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
})
foreach($asset in @('priority-tags-v017.js','priority-tags-v017.css')){
 $assetPath=Join-Path $PSScriptRoot $asset
 $text=[regex]::Replace([IO.File]::ReadAllText($assetPath),'#002fa7','#3957a5',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
 [IO.File]::WriteAllText($assetPath,$text,[Text.UTF8Encoding]::new($false))
}
$css=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'priority-tags-v017.css'))
$js=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'priority-tags-v017.js'))
$html=[regex]::Replace($html,'<script id="priority-tags-v017">[\s\S]*?</script>',[Text.RegularExpressions.MatchEvaluator]{param($m) '<script id="priority-tags-v017">'+$js+'</script>'})
$html=[regex]::Replace($html,'<style id="priority-tags-v017-style">[\s\S]*?</style>',[Text.RegularExpressions.MatchEvaluator]{param($m) '<style id="priority-tags-v017-style">'+$css+'</style>'})
[IO.File]::WriteAllText($path,$html,[Text.UTF8Encoding]::new($false))
Write-Output 'Applied Le Corbusier screen palette to HTML 17.'
