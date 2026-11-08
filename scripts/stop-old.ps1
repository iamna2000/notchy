# Tat ban Notchy dang chay (neu co) de ban moi duoc nap. Chi dong cac electron.exe cua thu muc dynamic-island.
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.CommandLine -like '*dynamic-island*' } | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
