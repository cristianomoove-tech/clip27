$scriptDir = "c:\Users\DELL\Desktop\clip27"
$vbsPath = "$scriptDir\iniciar_motor_silencioso.vbs"
$startupFolder = [System.Environment]::GetFolderPath('Startup')
$shortcutPath = "$startupFolder\Clip27_Motor_Nativo.lnk"

# 1. Cria atalho no Startup do Windows para iniciar sempre que ligar o PC
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsPath`""
$shortcut.WorkingDirectory = $scriptDir
$shortcut.Description = "Clip27 Motor FFmpeg Nativo"
$shortcut.Save()

Write-Host "Atalho no Startup criado: $(Test-Path $shortcutPath)"

# 2. Registra o protocolo clip27:// para clique no navegador
$regPath = "HKCU:\Software\Classes\clip27"
if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}
Set-ItemProperty -Path $regPath -Name "(Default)" -Value "URL:Clip27 Protocol"
Set-ItemProperty -Path $regPath -Name "URL Protocol" -Value ""
$cmdPath = "$regPath\shell\open\command"
if (-not (Test-Path $cmdPath)) {
    New-Item -Path $cmdPath -Force | Out-Null
}
Set-ItemProperty -Path $cmdPath -Name "(Default)" -Value "wscript.exe `"$vbsPath`" `"%1`""

Write-Host "Protocolo clip27:// registrado!"

# 3. Inicia o motor nativo imediatamente em segundo plano
Start-Process "wscript.exe" -ArgumentList "`"$vbsPath`""
Write-Host "Motor iniciado via WScript!"

