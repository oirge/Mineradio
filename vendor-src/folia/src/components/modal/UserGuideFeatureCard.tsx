import type React from 'react';
import type { LucideIcon } from 'lucide-react';

// src/components/modal/UserGuideFeatureCard.tsx

type UserGuideFeatureCardProps = {
    icon: LucideIcon;
    iconClassName: string;
    iconTileBg: string;
    cardBg: string;
    textPrimary: string;
    textSecondary: string;
    title: string;
    description: string;
};

export const UserGuideFeatureCard: React.FC<UserGuideFeatureCardProps> = ({
    icon: Icon,
    iconClassName,
    iconTileBg,
    cardBg,
    textPrimary,
    textSecondary,
    title,
    description,
}) => (
    <div className={`p-4 rounded-xl transition-colors ${cardBg}`}>
        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${iconTileBg}`}>
            <Icon size={18} className={iconClassName} />
        </div>
        <div className={`font-bold text-sm mb-1 ${textPrimary}`}>{title}</div>
        <div className={`text-xs ${textSecondary} leading-relaxed`}>{description}</div>
    </div>
);
