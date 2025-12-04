# Fix Claude shell context
$env:SHELL = "C:\GitBash\bash.exe"
$env:PATH  = "C:\GitBash;" + $env:PATH
Set-Location "D:\GitHub\SPMv1.0"
& "C:\Users\manur\AppData\Roaming\npm\claude.cmd" /init
