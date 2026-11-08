# Reads thumbnails only; original catalog images are never modified.
param(
  [string]$Manifest = 'node_modules/.cache/product-framing/images.json',
  [string]$Output = 'src/lib/productImageFrames.json'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing.Common,System.Drawing.Primitives,System.Private.Windows.GdiPlus,System.Private.Windows.Core -TypeDefinition @'
using System;
using System.Drawing;
public static class ProductImageBounds {
  public static double[] Measure(string path) {
    using (var b = new Bitmap(path)) {
      int w=b.Width,h=b.Height,x0=w,y0=h,x1=-1,y1=-1,borderInk=0,borderCount=0;
      for(int y=0;y<h;y++) for(int x=0;x<w;x++) {
        var c=b.GetPixel(x,y);
        bool ink=c.A>24 && (c.R<245 || c.G<245 || c.B<245);
        if(x<3 || y<3 || x>=w-3 || y>=h-3) {borderCount++; if(ink) borderInk++;}
        if(ink) {x0=Math.Min(x0,x);y0=Math.Min(y0,y);x1=Math.Max(x1,x);y1=Math.Max(y1,y);}
      }
      // Lifestyle photos, colored backgrounds and edge-to-edge packs retain their original framing.
      if(x1<0 || borderInk>borderCount*0.015) return null;
      int pad=Math.Max(6,(int)Math.Ceiling(Math.Max(w,h)*0.03));
      x0=Math.Max(0,x0-pad);y0=Math.Max(0,y0-pad);x1=Math.Min(w-1,x1+pad);y1=Math.Min(h-1,y1+pad);
      double cw=x1-x0+1,ch=y1-y0+1;
      if(Math.Max(cw,ch)<Math.Max(w,h)*0.35) return null;
      return new double[]{(double)x0/w,(double)y0/h,cw/w,ch/h,(double)w/h};
    }
  }
}
'@
$frames = [ordered]@{}
$failed = 0
foreach ($entry in (Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json)) {
  if (!$entry.file) { continue }
  try {
    $bounds = [ProductImageBounds]::Measure((Resolve-Path -LiteralPath $entry.file).Path)
    if ($null -ne $bounds) { $frames[$entry.url] = @($bounds | ForEach-Object { [Math]::Round($_, 6) }) }
  } catch { $failed++ }
}
$frames | ConvertTo-Json -Depth 3 -Compress | Set-Content -LiteralPath $Output -Encoding utf8NoBOM
Write-Output "Measured $($frames.Count) images; $failed unsupported thumbnails kept at original framing."
