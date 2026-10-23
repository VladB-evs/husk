import { describe, expect, it } from 'vitest';
import { expectedHash, findUpdate, isNewer, parseVersion } from './updater';

const BASE = 'https://github.com/VladB-evs/husk/releases/download/v1.2.0';
const release = (extra: Record<string, unknown> = {}) => ({
  tag_name: 'v1.2.0',
  body: 'Notes',
  assets: [
    { name: 'HUSK-arm64.zip', browser_download_url: `${BASE}/HUSK-arm64.zip` },
    { name: 'HUSK-x64.zip', browser_download_url: `${BASE}/HUSK-x64.zip` },
    { name: 'SHA256SUMS', browser_download_url: `${BASE}/SHA256SUMS` },
  ],
  ...extra,
});

describe('versions', () => {
  it('reads x.y.z with or without a leading v', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('1.2.3-beta')).toBeNull();
  });

  it('compares numbers, not text', () => {
    expect(isNewer('1.0.10', '1.0.9')).toBe(true);
    expect(isNewer('1.1.0', '1.0.99')).toBe(true);
    expect(isNewer('2.0.0', '1.9.9')).toBe(true);
    expect(isNewer('1.0.2', '1.0.2')).toBe(false);
    expect(isNewer('1.0.1', '1.0.2')).toBe(false);
    expect(isNewer('nonsense', '1.0.2')).toBe(false);
  });
});

describe('findUpdate', () => {
  it('returns the files for this processor when the release is newer', () => {
    expect(findUpdate(release(), '1.0.2', 'arm64')).toEqual({
      version: '1.2.0',
      notes: 'Notes',
      zipUrl: `${BASE}/HUSK-arm64.zip`,
      sumsUrl: `${BASE}/SHA256SUMS`,
    });
    expect(findUpdate(release(), '1.0.2', 'x64')?.zipUrl).toBe(`${BASE}/HUSK-x64.zip`);
  });

  it('returns null when there is nothing newer, or the release is not final', () => {
    expect(findUpdate(release(), '1.2.0', 'arm64')).toBeNull();
    expect(findUpdate(release({ draft: true }), '1.0.2', 'arm64')).toBeNull();
    expect(findUpdate(release({ prerelease: true }), '1.0.2', 'arm64')).toBeNull();
  });

  it('returns null when a file is missing or comes from another place', () => {
    expect(findUpdate(release({ assets: [] }), '1.0.2', 'arm64')).toBeNull();
    const foreign = release({
      assets: [
        { name: 'HUSK-arm64.zip', browser_download_url: 'https://example.com/HUSK-arm64.zip' },
        { name: 'SHA256SUMS', browser_download_url: `${BASE}/SHA256SUMS` },
      ],
    });
    expect(findUpdate(foreign, '1.0.2', 'arm64')).toBeNull();
  });
});

describe('expectedHash', () => {
  const a = 'a'.repeat(64);
  const b = 'b'.repeat(64);
  const sums = `${a}  HUSK-arm64.zip\n${b}  HUSK-x64.zip\n`;

  it('finds the checksum of one file', () => {
    expect(expectedHash(sums, 'HUSK-arm64.zip')).toBe(a);
    expect(expectedHash(sums, 'HUSK-x64.zip')).toBe(b);
  });

  it('returns null for a file that is not listed', () => {
    expect(expectedHash(sums, 'HUSK-arm64.dmg')).toBeNull();
  });
});
