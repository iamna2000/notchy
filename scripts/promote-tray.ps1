# Windows 11: danh dau icon khay cua app la "luon hien" (IsPromoted=1) de khong bi giau trong mui ten ^
# CHU Y: chi dung ky tu ASCII.
param([string]$Exe)
$root = 'HKCU:\Control Panel\NotifyIconSettings'
if (-not (Test-Path $root)) { Write-Output 'no NotifyIconSettings key (Windows 10 or older)'; exit 0 }
$n = 0
foreach ($k in Get-ChildItem $root) {
  try {
    $p = Get-ItemProperty -Path $k.PSPath
    if ($p.ExecutablePath -and ($p.ExecutablePath -ieq $Exe)) {
      Set-ItemProperty -Path $k.PSPath -Name IsPromoted -Value 1 -Type DWord
      $n++
    }
  } catch {}
}
Write-Output ('promoted ' + $n + ' entries for ' + $Exe)
