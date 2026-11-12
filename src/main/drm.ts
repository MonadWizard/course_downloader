/**
 * DRM detection. Course Downloader never circumvents DRM: protected streams are
 * reported so the job can be marked "skipped (DRM-protected)".
 *
 * Plain HLS AES-128 (key served to any authorised player, handled natively by
 * ffmpeg / yt-dlp) is standard HLS encryption and is NOT treated as DRM.
 */

const DRM_KEYFORMATS = [
  'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed', // Widevine
  'com.apple.streamingkeydelivery', // FairPlay
  'com.microsoft.playready',
  'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95' // PlayReady
]

export interface DrmCheck {
  drm: boolean
  system?: string
}

export function detectHlsDrm(manifest: string): DrmCheck {
  const lines = manifest.split(/\r?\n/).filter((l) => /^#EXT-X-(SESSION-)?KEY:/i.test(l))
  for (const line of lines) {
    const method = /METHOD=([A-Z0-9-]+)/i.exec(line)?.[1]?.toUpperCase()
    const keyformat = /KEYFORMAT="([^"]+)"/i.exec(line)?.[1]?.toLowerCase() ?? ''
    const uri = /URI="([^"]+)"/i.exec(line)?.[1] ?? ''
    if (method === 'NONE') continue
    if (DRM_KEYFORMATS.some((k) => keyformat.includes(k.toLowerCase()))) return { drm: true, system: keyformat }
    if (uri.startsWith('skd://')) return { drm: true, system: 'fairplay' }
    if (uri.startsWith('data:text/plain;base64') && keyformat) return { drm: true, system: keyformat }
    if (method === 'SAMPLE-AES' || method === 'SAMPLE-AES-CTR') return { drm: true, system: method }
  }
  return { drm: false }
}

export function detectDashDrm(mpd: string): DrmCheck {
  const m = /<ContentProtection[^>]*schemeIdUri="([^"]+)"/i.exec(mpd)
  if (!m) return { drm: false }
  // mp4protection alone just signals CENC; any ContentProtection on a DASH
  // manifest means a CDM licence is required.
  return { drm: true, system: m[1] }
}

export function detectDrm(manifest: string): DrmCheck {
  return /<MPD[\s>]/i.test(manifest) ? detectDashDrm(manifest) : detectHlsDrm(manifest)
}

/** URLs typical for licence servers – seeing one while sniffing means DRM. */
export function isLicenseRequestUrl(url: string): boolean {
  return /widevine|playready|fairplay|\/license(?:[/?]|$)|drmtoday|licenseproxy|\/wv\/|\/acquirelicense/i.test(url)
}
