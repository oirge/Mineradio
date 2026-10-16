import { useTranslation } from 'react-i18next';

// src/mineradio/local/LocalCatalogRetry.tsx
export default function LocalCatalogRetry({ error, retry }: { error: string; retry: () => void }) {
    const { t } = useTranslation('localPlayer');
    return error ? <div className="local-catalog-retry" role="status">
        <span>{t('catalogIncomplete')}</span><button onClick={retry}>{t('retrySurface')}</button>
    </div> : null;
}
