import type { ImgHTMLAttributes } from 'react';

// src/mineradio/local/LocalArtwork.tsx
// Cached and newly loaded covers share one opacity transition without timers or image observers.
export default function LocalArtwork({ src, className = '', onLoad, onError, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
    return <img {...props} key={src} ref={element => {
        if (element?.complete) element.dataset.localArtwork = 'ready';
    }} src={src} className={`local-artwork ${className}`} data-local-artwork="pending"
        onLoad={event => { event.currentTarget.dataset.localArtwork = 'ready'; onLoad?.(event); }}
        onError={event => { event.currentTarget.dataset.localArtwork = 'ready'; onError?.(event); }} />;
}
