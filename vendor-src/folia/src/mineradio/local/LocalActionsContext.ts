import { createContext } from 'react';
import type { HostState } from '../client';
import type { LocalActionId } from './localCommandCatalog';

// src/mineradio/local/LocalActionsContext.ts
// Both playback bars invoke the same host-backed actions and panel navigation.
export const LocalActionsContext = createContext<{ state: HostState | null; run: (id: LocalActionId) => void } | null>(null);
