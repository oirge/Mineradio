import { describe, expect, it } from 'vitest';

// test/unit/electron/updateChannels.test.ts

const {
    compareVersions,
    getReleaseUrl,
    getUpdateDiscoveryConfig,
    getUpdateProviderConfig,
    parseUpdateMetadataVersion,
    resolveReleaseChannel,
} = require('../../../electron/updateChannels.cjs') as {
    compareVersions: (left: string, right: string) => number;
    getReleaseUrl: (channel: string | null, version: string, releasesUrl: string) => string;
    getUpdateProviderConfig: (
        releaseChannel: {
            updaterChannel: string | null;
            updateEnabled: boolean;
            rollingReleaseTag: string | null;
        },
        github: { owner: string; repo: string },
    ) => Record<string, unknown> | null;
    getUpdateDiscoveryConfig: (
        releaseChannel: {
            updaterChannel: string | null;
            updateEnabled: boolean;
            rollingReleaseTag: string | null;
        },
        github: { owner: string; repo: string },
    ) => { format: string; url: string } | null;
    parseUpdateMetadataVersion: (text: string) => string;
    resolveReleaseChannel: (version: string, declaredChannel?: string | null) => {
        id: string;
        updaterChannel: string | null;
        allowPrerelease: boolean;
        updateEnabled: boolean;
        rollingReleaseTag: string | null;
    };
};

describe('release update channels', () => {
    it('uses packaged metadata before inferring a legacy version suffix', () => {
        expect(resolveReleaseChannel('0.7.0-beta.1', 'internal')).toMatchObject({
            id: 'internal',
            updaterChannel: null,
            updateEnabled: false,
        });
    });

    it.each([
        ['0.7.0', 'realeco', 'latest', false],
        ['0.7.0-beta.123', 'limo', 'beta', true],
        ['0.7.0-alpha.123', 'cielo', 'alpha', true],
    ])('maps %s to the %s lane', (version, id, updaterChannel, allowPrerelease) => {
        expect(resolveReleaseChannel(version)).toMatchObject({ id, updaterChannel, allowPrerelease });
    });

    it('opens rolling prereleases instead of manufacturing a semver tag', () => {
        const releasesUrl = 'https://github.com/chthollyphile/folia-major/releases';

        expect(getReleaseUrl('limo', '0.7.0-beta.123', releasesUrl)).toBe(`${releasesUrl}/tag/limo`);
        expect(getReleaseUrl('cielo', '0.7.0-alpha.123', releasesUrl)).toBe(`${releasesUrl}/tag/cielo`);
        expect(getReleaseUrl('realeco', '0.7.0', releasesUrl)).toBe(`${releasesUrl}/tag/v0.7.0`);
    });

    it('reads rolling prerelease metadata directly instead of using the GitHub release feed', () => {
        const github = { owner: 'chthollyphile', repo: 'folia-major' };

        expect(getUpdateProviderConfig(resolveReleaseChannel('0.7.0-beta.123', 'limo'), github)).toEqual({
            provider: 'generic',
            url: 'https://github.com/chthollyphile/folia-major/releases/download/limo/',
            channel: 'beta',
            useMultipleRangeRequest: false,
        });
        expect(getUpdateProviderConfig(resolveReleaseChannel('0.7.0-alpha.123', 'cielo'), github)).toEqual({
            provider: 'generic',
            url: 'https://github.com/chthollyphile/folia-major/releases/download/cielo/',
            channel: 'alpha',
            useMultipleRangeRequest: false,
        });
    });

    it('restores the GitHub provider after switching back to Realeco', () => {
        expect(getUpdateProviderConfig(
            resolveReleaseChannel('0.7.0', 'realeco'),
            { owner: 'chthollyphile', repo: 'folia-major' },
        )).toEqual({
            provider: 'github',
            owner: 'chthollyphile',
            repo: 'folia-major',
            channel: 'latest',
        });
    });

    it('builds discovery endpoints for stable and rolling channels', () => {
        const github = { owner: 'chthollyphile', repo: 'folia-major' };

        expect(getUpdateDiscoveryConfig(resolveReleaseChannel('0.7.3', 'realeco'), github)).toEqual({
            format: 'yaml',
            url: 'https://github.com/chthollyphile/folia-major/releases/latest/download/latest.yml',
        });
        expect(getUpdateDiscoveryConfig(resolveReleaseChannel('0.7.4-beta.1', 'limo'), github)).toEqual({
            format: 'yaml',
            url: 'https://github.com/chthollyphile/folia-major/releases/download/limo/beta.yml',
        });
    });

    it('compares stable and timestamped prerelease versions', () => {
        expect(compareVersions('0.7.4', '0.7.3')).toBe(1);
        expect(compareVersions('0.7.4', '0.7.4-beta.1788851094')).toBe(1);
        expect(compareVersions('0.7.4-beta.1788851094', '0.7.4-beta.1788763093')).toBe(1);
        expect(compareVersions('0.7.4-alpha.2', '0.7.4-alpha.10')).toBe(-1);
        expect(compareVersions('v0.7.4', '0.7.4')).toBe(0);
    });

    it('reads the version from electron-builder channel metadata', () => {
        expect(parseUpdateMetadataVersion("version: 0.7.4-beta.1788851094\nfiles:\n  - url: Folia.exe\n"))
            .toBe('0.7.4-beta.1788851094');
    });
});
