import { describe, expect, it } from 'vitest'
import { detectDrm, isLicenseRequestUrl } from '../src/main/drm'

describe('DRM detection', () => {
  it('plain and AES-128 HLS are not DRM', () => {
    expect(detectDrm('#EXTM3U\n#EXTINF:10,\na.ts').drm).toBe(false)
    expect(detectDrm('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="https://k/key"\n#EXTINF:10,\na.ts').drm).toBe(false)
  })
  it('Widevine / FairPlay HLS is DRM', () => {
    expect(
      detectDrm('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,URI="data:text/plain;base64,AAA",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"').drm
    ).toBe(true)
    expect(detectDrm('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://abc",KEYFORMAT="com.apple.streamingkeydelivery"').drm).toBe(true)
  })
  it('DASH ContentProtection is DRM', () => {
    expect(detectDrm('<MPD><Period><AdaptationSet><ContentProtection schemeIdUri="urn:uuid:edef8ba9"/></AdaptationSet></Period></MPD>').drm).toBe(true)
    expect(detectDrm('<MPD><Period><AdaptationSet></AdaptationSet></Period></MPD>').drm).toBe(false)
  })
  it('recognises licence server URLs', () => {
    expect(isLicenseRequestUrl('https://lic.example.com/widevine/getlicense')).toBe(true)
    expect(isLicenseRequestUrl('https://cdn.example.com/video/master.m3u8')).toBe(false)
  })
})
