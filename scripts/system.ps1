# Dieu khien am luong, thiet bi phat am thanh va do sang man hinh.
# Lenh qua stdin (moi lenh mot dong): get | devices | mute | vol:0.5 | bri:70 | dev:<id>
# CHU Y: chi dung ky tu ASCII.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Emit($o) {
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 5))
  [Console]::Out.Flush()
}

$audioOk = $false
$audioErr = ''
try {
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace DIAudio {
  [StructLayout(LayoutKind.Sequential)]
  public struct PROPERTYKEY { public Guid fmtid; public uint pid; }

  [StructLayout(LayoutKind.Explicit)]
  public struct PROPVARIANT {
    [FieldOffset(0)] public ushort vt;
    [FieldOffset(8)] public IntPtr p;
    [FieldOffset(16)] public long pad;
  }

  [ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IPropertyStore {
    int GetCount(out uint c);
    int GetAt(uint i, out PROPERTYKEY k);
    int GetValue(ref PROPERTYKEY k, out PROPVARIANT v);
    int SetValue(ref PROPERTYKEY k, ref PROPVARIANT v);
    int Commit();
  }

  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IMMDevice {
    int Activate(ref Guid iid, uint ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);
    int OpenPropertyStore(uint access, out IPropertyStore s);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    int GetState(out uint st);
  }

  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IMMDeviceCollection {
    int GetCount(out uint n);
    int Item(uint i, out IMMDevice d);
  }

  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int flow, uint mask, out IMMDeviceCollection c);
    int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice d);
    int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice d);
    int RegisterEndpointNotificationCallback(IntPtr p);
    int UnregisterEndpointNotificationCallback(IntPtr p);
  }

  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  public class MMDeviceEnumeratorCom { }

  [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr p);
    int UnregisterControlChangeNotify(IntPtr p);
    int GetChannelCount(out uint n);
    int SetMasterVolumeLevel(float db, ref Guid ctx);
    int SetMasterVolumeLevelScalar(float v, ref Guid ctx);
    int GetMasterVolumeLevel(out float db);
    int GetMasterVolumeLevelScalar(out float v);
    int SetChannelVolumeLevel(uint ch, float db, ref Guid ctx);
    int SetChannelVolumeLevelScalar(uint ch, float v, ref Guid ctx);
    int GetChannelVolumeLevel(uint ch, out float db);
    int GetChannelVolumeLevelScalar(uint ch, out float v);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool m, ref Guid ctx);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool m);
    int GetVolumeStepInfo(out uint step, out uint count);
    int VolumeStepUp(ref Guid ctx);
    int VolumeStepDown(ref Guid ctx);
    int QueryHardwareSupport(out uint mask);
    int GetVolumeRange(out float min, out float max, out float inc);
  }

  [ComImport, Guid("F8679F50-850A-41CF-9C72-430F290290C8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IPolicyConfig {
    int GetMixFormat([MarshalAs(UnmanagedType.LPWStr)] string n, IntPtr f);
    int GetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string n, int def, IntPtr f);
    int ResetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string n);
    int SetDeviceFormat([MarshalAs(UnmanagedType.LPWStr)] string n, IntPtr a, IntPtr b);
    int GetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string n, int def, IntPtr a, IntPtr b);
    int SetProcessingPeriod([MarshalAs(UnmanagedType.LPWStr)] string n, IntPtr a);
    int GetShareMode([MarshalAs(UnmanagedType.LPWStr)] string n, IntPtr m);
    int SetShareMode([MarshalAs(UnmanagedType.LPWStr)] string n, IntPtr m);
    int GetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string n, int fx, IntPtr k, IntPtr v);
    int SetPropertyValue([MarshalAs(UnmanagedType.LPWStr)] string n, int fx, IntPtr k, IntPtr v);
    int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string n, int role);
    int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)] string n, int vis);
  }

  [ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")]
  public class PolicyConfigCom { }

  public static class Audio {
    [DllImport("ole32.dll")] static extern int PropVariantClear(ref PROPVARIANT v);

    static IMMDeviceEnumerator En() { return (IMMDeviceEnumerator)(new MMDeviceEnumeratorCom()); }

    static IMMDevice DefaultDev() {
      IMMDevice d;
      Marshal.ThrowExceptionForHR(En().GetDefaultAudioEndpoint(0, 1, out d));
      return d;
    }

    static IAudioEndpointVolume Vol(IMMDevice d) {
      Guid iid = typeof(IAudioEndpointVolume).GUID;
      object o;
      Marshal.ThrowExceptionForHR(d.Activate(ref iid, 23, IntPtr.Zero, out o));
      return (IAudioEndpointVolume)o;
    }

    public static float GetVolume() {
      float v;
      Marshal.ThrowExceptionForHR(Vol(DefaultDev()).GetMasterVolumeLevelScalar(out v));
      return v;
    }

    public static void SetVolume(float v) {
      if (v < 0f) v = 0f;
      if (v > 1f) v = 1f;
      Guid g = Guid.Empty;
      IAudioEndpointVolume ep = Vol(DefaultDev());
      Marshal.ThrowExceptionForHR(ep.SetMasterVolumeLevelScalar(v, ref g));
      if (v > 0f) { ep.SetMute(false, ref g); }
    }

    public static bool GetMute() {
      bool m;
      Marshal.ThrowExceptionForHR(Vol(DefaultDev()).GetMute(out m));
      return m;
    }

    public static void SetMute(bool m) {
      Guid g = Guid.Empty;
      Marshal.ThrowExceptionForHR(Vol(DefaultDev()).SetMute(m, ref g));
    }

    static string Name(IMMDevice d) {
      IPropertyStore ps;
      if (d.OpenPropertyStore(0, out ps) != 0) return "";
      PROPERTYKEY k = new PROPERTYKEY();
      k.fmtid = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0");
      k.pid = 14;
      PROPVARIANT v;
      if (ps.GetValue(ref k, out v) != 0) return "";
      string s = "";
      if (v.vt == 31) s = Marshal.PtrToStringUni(v.p);
      PropVariantClear(ref v);
      return s;
    }

    // Moi dong: id TAB ten TAB (1 neu dang la thiet bi mac dinh)
    public static string[] Devices() {
      List<string> list = new List<string>();
      string defId = "";
      try { string i; DefaultDev().GetId(out i); defId = i; } catch (Exception) { }
      IMMDeviceCollection c;
      Marshal.ThrowExceptionForHR(En().EnumAudioEndpoints(0, 1, out c));
      uint n;
      c.GetCount(out n);
      for (uint i = 0; i < n; i++) {
        IMMDevice d;
        if (c.Item(i, out d) != 0) continue;
        string id;
        d.GetId(out id);
        list.Add(id + "\t" + Name(d) + "\t" + (id == defId ? "1" : "0"));
      }
      return list.ToArray();
    }

    public static void SetDefault(string id) {
      IPolicyConfig pc = (IPolicyConfig)(new PolicyConfigCom());
      for (int role = 0; role < 3; role++) {
        Marshal.ThrowExceptionForHR(pc.SetDefaultEndpoint(id, role));
      }
    }
  }
}
'@
  $audioOk = $true
} catch {
  $audioErr = $_.Exception.Message
}

function Get-Bri {
  try {
    $b = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1
    if ($b) { return [int]$b.CurrentBrightness }
  } catch {}
  return -1
}
function Set-Bri($v) {
  try {
    $m = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Select-Object -First 1
    if ($m) { [void](Invoke-CimMethod -InputObject $m -MethodName WmiSetBrightness -Arguments @{ Timeout = [uint32]1; Brightness = [byte]$v }) }
  } catch {}
}

function Emit-State {
  $o = @{ type = 'sys'; audio = $audioOk; vol = -1; mute = $false; bri = (Get-Bri) }
  if ($audioOk) {
    try { $o['vol'] = [math]::Round([double][DIAudio.Audio]::GetVolume(), 3); $o['mute'] = [bool][DIAudio.Audio]::GetMute() } catch { $o['err'] = $_.Exception.Message }
  } else { $o['err'] = $audioErr }
  Emit $o
}
function Emit-Devices {
  $list = @()
  if ($audioOk) {
    try {
      foreach ($line in [DIAudio.Audio]::Devices()) {
        $p = $line.Split("`t")
        if ($p.Length -ge 3) { $list += @{ id = $p[0]; name = $p[1]; def = ($p[2] -eq '1') } }
      }
    } catch { Emit @{ type = 'sys-error'; msg = ('devices: ' + $_.Exception.Message) } }
  }
  Emit @{ type = 'sys'; devices = $list }
}
# Tong so byte da nhan/gui cua cac card mang dang ra Internet (co default gateway).
# Chi lay card co gateway de khong dem trung qua card ao (Hyper-V vEthernet, VPN...).
function Emit-Net {
  $rx = 0.0; $tx = 0.0; $n = 0
  foreach ($ni in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    try {
      if ($ni.OperationalStatus -ne 'Up') { continue }
      $t = [string]$ni.NetworkInterfaceType
      if ($t -eq 'Loopback' -or $t -eq 'Tunnel') { continue }
      if ($ni.GetIPProperties().GatewayAddresses.Count -eq 0) { continue }
      $s = $ni.GetIPStatistics()
      $rx += [double]$s.BytesReceived; $tx += [double]$s.BytesSent; $n++
    } catch {}
  }
  Emit @{ type = 'net'; rx = $rx; tx = $tx; n = $n }
}

Emit-State
Emit-Devices

while (($line = [Console]::In.ReadLine()) -ne $null) {
  $cmd = $line.Trim()
  try {
    if ($cmd -eq 'get') { Emit-State }
    elseif ($cmd -eq 'devices') { Emit-Devices }
    elseif ($cmd -eq 'net') { Emit-Net }
    elseif ($cmd -eq 'mute') { if ($audioOk) { [DIAudio.Audio]::SetMute(-not [DIAudio.Audio]::GetMute()) }; Emit-State }
    elseif ($cmd -like 'vol:*') {
      $v = [double]::Parse($cmd.Substring(4), [System.Globalization.CultureInfo]::InvariantCulture)
      if ($audioOk) { [DIAudio.Audio]::SetVolume([single]$v) }
    }
    elseif ($cmd -like 'bri:*') { Set-Bri ([int]$cmd.Substring(4)) }
    elseif ($cmd -like 'dev:*') {
      if ($audioOk) { [DIAudio.Audio]::SetDefault($cmd.Substring(4)) }
      Start-Sleep -Milliseconds 300
      Emit-State
      Emit-Devices
    }
  } catch {
    Emit @{ type = 'sys-error'; msg = ($cmd + ': ' + $_.Exception.Message) }
  }
}
