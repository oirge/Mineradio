import { OnlineProviderError } from '../../types/onlineMusic';
import type { BodianOperation, BodianParams, BodianResult } from 'bodian-music-api';

// src/services/onlineMusic/bodianTransport.ts

export type { BodianOperation, BodianParams } from 'bodian-music-api';
export type BodianBridgeResult = BodianResult;

export const getBodianTransportAvailability = () => (
    typeof window !== 'undefined' && typeof window.electron?.bodianRequest === 'function'
        ? { configured: true } as const
        : { configured: false, reason: 'runtime-unavailable' } as const
);

export async function requestBodian<T = unknown>(operation: BodianOperation, params: BodianParams = {}): Promise<T> {
    if (!getBodianTransportAvailability().configured) {
        throw new OnlineProviderError('unavailable', 'Bodian requires the desktop app', 'bodian');
    }
    let result: BodianBridgeResult;
    // Omni consumers request 150/1000-row batches; Bodian serves at most 100 and returns its own cursor.
    const boundedParams = Number.isSafeInteger(params.limit) && Number(params.limit) > 100
        ? { ...params, limit: 100 } : params;
    try { result = await window.electron!.bodianRequest(operation, boundedParams); }
    catch { throw new OnlineProviderError('network', 'Bodian desktop request failed', 'bodian'); }
    if (!result.ok) throw new OnlineProviderError(result.error.code, result.error.message, 'bodian');
    return result.data as T;
}
