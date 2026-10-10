import type React from 'react';
import type { LucideIcon } from 'lucide-react';

// src/components/modal/UserGuideTipCard.tsx

type UserGuideTipCardProps = {
    icon: LucideIcon;
    iconClassName: string;
    iconTileBg: string;
    tipCardBg: string;
    textPrimary: string;
    textSecondary: string;
    title: string;
    description: string;
};

export const UserGuideTipCard: React.FC<UserGuideTipCardProps> = ({
    icon: TipIcon,
    iconClassName,
    iconTileBg,
    tipCardBg,
    textPrimary,
    textSecondary,
    title,
    description,
}) => (
    <div className={`flex gap-4 items-start p-5 rounded-2xl transition-colors ${tipCardBg}`}>
        <div className={`flex-shrink-0 p-3 rounded-xl ${iconTileBg}`}>
            <TipIcon size={22} className={iconClassName} />
        </div>
        <div>
            <h2 className={`text-xl font-extrabold mb-2 tracking-tight ${textPrimary}`}>{title}</h2>
            <p className={`text-sm leading-relaxed ${textSecondary}`}>{description}</p>
        </div>
    </div>
);
