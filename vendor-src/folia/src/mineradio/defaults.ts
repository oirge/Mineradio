import { isMineradioEmbedded } from './client';

// src/mineradio/defaults.ts
// The existing Mineradio library is the entry surface on the first Folia visit.
if (isMineradioEmbedded()) {
    try {
        if (localStorage.getItem('last_home_view_tab') === null) localStorage.setItem('last_home_view_tab', 'local');
        if (localStorage.getItem('last_app_view') === null) localStorage.setItem('last_app_view', 'home');
    } catch { /* Continue when browser storage is unavailable. */ }
}
