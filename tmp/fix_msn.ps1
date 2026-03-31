$b64 = (Get-Content tmp\msn_b64.txt -Raw).Trim()
$path = 'utils\sounds.ts'
$content = Get-Content $path -Raw
# Robust regex för att hitta msn-raden oavsett om det är .wav eller .mp3 just nu
$newContent = $content -replace "id: 'msn', name: 'MSN Messenger \(Klassisk\)', url: '.*'", "id: 'msn', name: 'MSN Messenger (Klassisk)', url: 'data:audio/mpeg;base64,$b64'"
Set-Content $path $newContent -Encoding UTF8
