// electron/modSystem/trustedKeys.cjs
// Public keys whose signatures mark a mod as officially verified, and signed
// mods pulled after release. Both ship with the host: a new key, a revoked key
// or a revoked mod takes effect with the next app update (there is no online
// check). Keep this list identical to keys/trusted-keys.json and
// keys/revoked-mods.json in the folium-compound repository.
//
// Rotating a key: add the new key here and ship it, sign with it, and only
// then mark the old key `revoked: true` (signatures made with a revoked key
// show as invalid). A leaked key is revoked immediately.

'use strict';

const TRUSTED_SIGNING_KEYS = Object.freeze([
    Object.freeze({
        keyId: 'folium-2026-1',
        label: 'Folium official',
        publicKey: Object.freeze({ kty: 'OKP', crv: 'Ed25519', x: 'dDmFP2b-M1A-k9FBfXIBnvR6oLigIcdnzrT7f3y3qG8' }),
        revoked: false,
    }),
    // Held by the folium-compound CI: signs reviewed community mods and re-signs mods merged into main.
    Object.freeze({
        keyId: 'folium-ci-2026-1',
        label: 'Folium CI',
        publicKey: Object.freeze({ kty: 'OKP', crv: 'Ed25519', x: 'GPmeaeLIYT85HunWM2xF1z62NeqmOh4BNpe4A2Xq5QI' }),
        revoked: false,
    }),
]);

// Signed digests (see modSignature.cjs) of mods that must no longer show as verified.
const REVOKED_MOD_DIGESTS = Object.freeze([]);

module.exports = { TRUSTED_SIGNING_KEYS, REVOKED_MOD_DIGESTS };
