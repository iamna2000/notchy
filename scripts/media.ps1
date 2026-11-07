# Cau noi giua app va Windows: doc nhac, dieu khien nhac, phat hien cua so dang de len vien thuoc, toan man hinh.
# Moi dong in ra la mot doi tuong JSON. Lenh nhan qua stdin, moi lenh mot dong.
# CHU Y: file nay chi dung ky tu ASCII de PowerShell 5.1 doc dung.
param([int]$ParentPid = 0)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Emit($o) {
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}
function LogErr($m) { try { [Console]::Error.WriteLine([string]$m) } catch {} }

# ---------- Ma native (user32, shell32, dwmapi) ----------
$native = $false
try {
  Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class DI {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }

  delegate bool EnumProc(IntPtr h, IntPtr l);

  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int sz);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

  // Tra ve ten lop cua cua so tren cung tai diem (x, y); "desk" neu la man hinh nen/taskbar; "" neu khong co.
  public static string CoverAt(int x, int y, uint ignorePid) {
    string res = "";
    EnumWindows(delegate (IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h) || IsIconic(h)) return true;
      int cloaked;
      if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
      uint pid;
      GetWindowThreadProcessId(h, out pid);
      if (pid == ignorePid) return true;
      int ex = GetWindowLong(h, -20);
      if ((ex & 0x80) != 0 || (ex & 0x08000000) != 0 || (ex & 0x20) != 0) return true;
      RECT r;
      if (!GetWindowRect(h, out r)) return true;
      if (x < r.Left || x >= r.Right || y < r.Top || y >= r.Bottom) return true;
      if (r.Right - r.Left < 120 || r.Bottom - r.Top < 40) return true;
      StringBuilder sb = new StringBuilder(256);
      GetClassName(h, sb, 256);
      string c = sb.ToString();
      if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") { res = "desk"; return false; }
      res = c;
      return false;
    }, IntPtr.Zero);
    return res;
  }
}
'@
  [void][DI]::SetProcessDPIAware()
  $native = $true
} catch {
  LogErr ('native: ' + $_.Exception.Message)
}

function Press-Key([byte]$vk) {
  if (-not $native) { return }
  [DI]::keybd_event($vk, 0, 0, [UIntPtr]::Zero)
  [DI]::keybd_event($vk, 0, 2, [UIntPtr]::Zero)
}
function Send-Paste {
  if (-not $native) { return }
  [DI]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
  [DI]::keybd_event(0x56, 0, 0, [UIntPtr]::Zero)
  [DI]::keybd_event(0x56, 0, 2, [UIntPtr]::Zero)
  [DI]::keybd_event(0x11, 0, 2, [UIntPtr]::Zero)
}

# ---------- Doc lenh tu stdin o mot luong rieng ----------
$q = New-Object 'System.Collections.Concurrent.ConcurrentQueue[string]'
$rs = [runspacefactory]::CreateRunspace()
$rs.Open()
$rs.SessionStateProxy.SetVariable('q', $q)
$reader = [powershell]::Create()
$reader.Runspace = $rs
[void]$reader.AddScript({
  while ($true) {
    $line = [Console]::In.ReadLine()
    if ($line -eq $null) { $q.Enqueue('__quit__'); break }
    $q.Enqueue($line)
  }
})
[void]$reader.BeginInvoke()

# ---------- Khoi tao WinRT (dieu khien media cua Windows) ----------
$mgr = $null
$initError = ''
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]

  function Await($winRtTask, $resultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
    $netTask = $asTask.Invoke($null, @($winRtTask))
    [void]$netTask.Wait(-1)
    $netTask.Result
  }

  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

  $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
} catch {
  $initError = $_.Exception.Message
}

if ($mgr -eq $null) {
  Emit @{ type = 'error'; msg = ('Khong doc duoc nhac: ' + $initError) }
}

# Doc anh bia; tra ve '' neu chua co (ung dung co the gui anh tre hon ten bai mot chut).
# PowerShell 5.1 nhan stream WinRT duoi dang System.__ComObject tran: goi thang .Size, .ContentType
# hay truyen vao AsStreamForRead / DataReader deu hong (Size rong -> truoc day luon tra ve '').
# Goi qua reflection theo dung interface thi .NET tu QueryInterface nen doc duoc.
$asStreamForRead = $null
$ctProp = $null
try {
  $asStreamForRead = [System.IO.WindowsRuntimeStreamExtensions].GetMethod('AsStreamForRead', [type[]]@([Windows.Storage.Streams.IInputStream]))
  $ctProp = [Windows.Storage.Streams.IContentTypeProvider].GetProperty('ContentType')
} catch { LogErr ('thumb init: ' + $_.Exception.Message) }

function Get-Thumb($props, $tryNo) {
  try {
    if ($asStreamForRead -eq $null -or $props.Thumbnail -eq $null) { return '' }
    $rs2 = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    if ($rs2 -eq $null) { return '' }
    $stream = $asStreamForRead.Invoke($null, @($rs2))
    $ms = New-Object System.IO.MemoryStream
    try { $stream.CopyTo($ms) } finally { $stream.Dispose() }
    $bytes = $ms.ToArray()
    if ($bytes.Length -lt 100) { return '' }
    $mime = ''
    try { $mime = [string]$ctProp.GetValue($rs2) } catch {}
    if (-not $mime) { $mime = 'image/jpeg' }
    return ('data:' + $mime + ';base64,' + [Convert]::ToBase64String($bytes))
  } catch {
    if ($tryNo -le 2) { LogErr ('thumb: ' + $_.Exception.Message) }
    return ''
  }
}

function Run-Command($cmd) {
  if ($cmd -eq 'paste') { Start-Sleep -Milliseconds 80; Send-Paste; return }
  $s = $null
  if ($mgr -ne $null) { try { $s = $mgr.GetCurrentSession() } catch {} }
  try {
    if ($s -ne $null) {
      if ($cmd -eq 'play_pause') { [void](Await ($s.TryTogglePlayPauseAsync()) ([bool])); return }
      if ($cmd -eq 'next')       { [void](Await ($s.TrySkipNextAsync()) ([bool])); return }
      if ($cmd -eq 'prev')       { [void](Await ($s.TrySkipPreviousAsync()) ([bool])); return }
      if ($cmd -eq 'shuffle') {
        $cur = $false
        try { if ($s.GetPlaybackInfo().IsShuffleActive -eq $true) { $cur = $true } } catch {}
        [void](Await ($s.TryChangeShuffleActiveAsync(-not $cur)) ([bool]))
        return
      }
      if ($cmd -like 'seek:*') {
        $sec = [double]::Parse($cmd.Substring(5), [System.Globalization.CultureInfo]::InvariantCulture)
        $startSec = 0
        try { $startSec = $s.GetTimelineProperties().StartTime.TotalSeconds } catch {}
        [void](Await ($s.TryChangePlaybackPositionAsync([int64](($sec + $startSec) * 10000000))) ([bool]))
        return
      }
    }
  } catch { LogErr ('cmd ' + $cmd + ': ' + $_.Exception.Message) }
  # Du phong: gui phim media cua ban phim
  if ($cmd -eq 'play_pause') { Press-Key 0xB3 }
  elseif ($cmd -eq 'next')   { Press-Key 0xB0 }
  elseif ($cmd -eq 'prev')   { Press-Key 0xB1 }
}

$lastKey = ''
$thumbOk = $false
$thumbTries = 0
$lastFs = $null
$lastCover = $null
$probeX = 0
$probeY = 0
$probeSet = $false
$tick = 0
$burst = 0
$quit = $false

while (-not $quit) {
  $cmd = $null
  while ($q.TryDequeue([ref]$cmd)) {
    if ($cmd -eq '__quit__') { $quit = $true; break }
    if ($cmd -like 'probe:*') {
      try {
        $parts = $cmd.Split(':')
        $probeX = [int]$parts[1]
        $probeY = [int]$parts[2]
        $probeSet = $true
        $lastCover = $null
      } catch {}
      continue
    }
    Run-Command $cmd
    $burst = 4   # phat lai trang thai vai lan lien tiep sau lenh
  }
  if ($quit) { break }

  # --- Trang thai nhac (moi ~1 giay, hoac lien tuc sau khi co lenh) ---
  if ($tick % 5 -eq 0 -or $burst -gt 0) {
    if ($burst -gt 0) { $burst-- }
    if ($mgr -ne $null) {
      try {
        $s = $mgr.GetCurrentSession()
        if ($s -eq $null) {
          $lastKey = ''
          Emit @{ type = 'media'; active = $false }
        } else {
          $props = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
          $pb = $s.GetPlaybackInfo()
          $tl = $s.GetTimelineProperties()
          $key = '' + $s.SourceAppUserModelId + '|' + $props.Title + '|' + $props.Artist
          $startSec = $tl.StartTime.TotalSeconds
          $upd = [int64]0
          try { $lu = $tl.LastUpdatedTime; if ($lu.Year -gt 2000) { $upd = [int64]$lu.ToUnixTimeMilliseconds() } } catch {}
          $rate = 1.0
          try { if ($pb.PlaybackRate -ne $null) { $rate = [double]$pb.PlaybackRate } } catch {}
          $shuf = $false
          try { if ($pb.IsShuffleActive -eq $true) { $shuf = $true } } catch {}
          $msg = @{
            type    = 'media'
            active  = $true
            key     = $key
            title   = '' + $props.Title
            artist  = '' + $props.Artist
            album   = '' + $props.AlbumTitle
            app     = '' + $s.SourceAppUserModelId
            status  = $pb.PlaybackStatus.ToString()
            pos     = [math]::Round($tl.Position.TotalSeconds - $startSec, 2)
            dur     = [math]::Round(($tl.EndTime - $tl.StartTime).TotalSeconds, 2)
            upd     = $upd
            rate    = $rate
            shuffle = $shuf
          }
          if ($key -ne $lastKey) {
            $lastKey = $key
            $thumbOk = $false
            $thumbTries = 0
            $msg['thumb'] = ''
          }
          # Anh bia thuong den tre hon ten bai (Spotify, YouTube): thu lai moi giay, toi da ~40 lan
          if (-not $thumbOk -and $thumbTries -lt 40) {
            $thumbTries++
            $t = Get-Thumb $props $thumbTries
            if ($t) { $thumbOk = $true; $msg['thumb'] = $t }
          }
          Emit $msg
        }
      } catch {
        Emit @{ type = 'error'; msg = ('Nhac: ' + $_.Exception.Message) }
      }
    }
  }

  if ($native) {
    # --- Co cua so nao dang de len vien thuoc (trinh duyet phong to, ung dung toan man hinh...) ---
    if ($probeSet) {
      try {
        $cls = [DI]::CoverAt($probeX, $probeY, [uint32]$ParentPid)
        $cov = ($cls -ne '' -and $cls -ne 'desk')
        if ($cov -ne $lastCover) {
          $lastCover = $cov
          Emit @{ type = 'cover'; value = $cov; cls = $cls }
        }
      } catch { LogErr ('cover: ' + $_.Exception.Message) }
    }
    # --- Game / ung dung toan man hinh dung Direct3D: an han ---
    if ($tick % 8 -eq 0) {
      try {
        $st = 0
        [void][DI]::SHQueryUserNotificationState([ref]$st)
        $fs = ($st -eq 3)
        if ($fs -ne $lastFs) {
          $lastFs = $fs
          Emit @{ type = 'fs'; value = $fs }
        }
      } catch {}
    }
  }

  $tick++
  if ($tick -gt 1000000) { $tick = 0 }
  Start-Sleep -Milliseconds 200
}
