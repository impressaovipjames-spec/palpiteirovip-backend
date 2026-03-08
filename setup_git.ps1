$GitUrl = "https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/PortableGit-2.44.0-64-bit.7z.exe"
$GitExe = "e:\VIPNEXUSIA\PortableGit.exe"
$GitDir = "e:\VIPNEXUSIA\PortableGit"

if (-Not (Test-Path $GitDir\bin\git.exe)) {
    Write-Host "Baixando Git Portatil..."
    Invoke-WebRequest -Uri $GitUrl -OutFile $GitExe
    Write-Host "Extraindo Git Portatil (aguarde uns instantes)..."
    Start-Process -FilePath $GitExe -ArgumentList "-y", "-o""$GitDir""" -Wait -NoNewWindow
    Remove-Item $GitExe -ErrorAction SilentlyContinue
}

$env:Path = "$GitDir\cmd;$GitDir\bin;" + $env:Path
Write-Host "Git configurado temporariamente! Versao:"
git --version

Write-Host "Adicionando arquivos..."
git add .
git commit -m "feat(backend): Implementando provedores temporarios (Sprint 28)"

Write-Host "Iniciando Push! Uma janela do navegador pode abrir para voce confirmar o login do GitHub."
git push origin HEAD:main
