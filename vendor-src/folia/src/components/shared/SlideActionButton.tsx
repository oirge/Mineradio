import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { mobileMotionTokens } from '../../utils/mobileMotion';

// src/components/shared/SlideActionButton.tsx
// The player-style round action button with a second action on a leftward slide: tap the button for
// the primary action, or drag it along its track to reach the one waiting at the far end.
//
// Lifted out of GridListSearchButton so the poster wall could carry the same control. Only the
// mechanics live here — the gesture, the track and the drag feedback. Where the button sits, what
// its two ends do and how the destination is chosen stay with each caller, because those are the
// parts that genuinely differ between a grid and the wall.

/** How far the button must travel before the slide fires, and how far it can be dragged at all. */
const TRIGGER_DISTANCE = 36;
const MAX_DRAG = 44;

export interface SlideActionButtonProps {
    icon: LucideIcon;
    /** Tooltip for the button itself, naming what a tap does. */
    title: string;
    onActivate: () => void;
    slideIcon: LucideIcon;
    /** Tooltip at the far end of the track, naming where the slide goes. */
    slideTitle: string;
    onSlide: () => void;
    isDaylight: boolean;
    accentColor: string;
    disabled?: boolean;
}

export const SlideActionButton: React.FC<SlideActionButtonProps> = ({
    icon: Icon,
    title,
    onActivate,
    slideIcon: SlideIcon,
    slideTitle,
    onSlide,
    isDaylight,
    accentColor,
    disabled = false,
}) => {
    const { mobile, reducedMotion } = useMobileMotion();
    const calm = mobile && reducedMotion;
    const [showGuideLine, setShowGuideLine] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const gestureRef = useRef<{ startX: number; startY: number; triggered: boolean } | null>(null);
    const suppressClickRef = useRef(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const trackEndIconRef = useRef<HTMLDivElement>(null);
    const trackFillRef = useRef<HTMLDivElement>(null);
    const animations = useRef<Animation[]>([]);
    const stopAnimations = () => {
        animations.current.forEach(animation => animation.cancel());
        animations.current = [];
    };
    const feedbackAnimation = (element: HTMLElement | null, frames: Keyframe[]) => {
        if (!element || calm) return;
        const animation = element.animate(frames, {
            duration: mobile ? mobileMotionTokens.component : 250,
            easing: mobile ? `cubic-bezier(${mobileMotionTokens.ease.join(',')})` : 'cubic-bezier(0.16, 1, 0.3, 1)',
        });
        animations.current.push(animation);
        const release = () => { animations.current = animations.current.filter(active => active !== animation); };
        animation.addEventListener('finish', release, { once: true });
        animation.addEventListener('cancel', release, { once: true });
    };
    useEffect(() => () => { stopAnimations(); gestureRef.current = null; }, []);
    useEffect(() => { if (calm) stopAnimations(); }, [calm]);
    const supportsHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const motionClass = showGuideLine || isDragging
        ? 'translate-x-0 opacity-100'
        : supportsHover
            ? 'translate-x-1/2 opacity-60 group-hover:translate-x-0 group-hover:opacity-100 md:translate-x-0 md:opacity-100 md:hover:scale-105'
            : 'translate-x-1/2 opacity-60';

    const setDestinationFeedback = (progress: number) => {
        const icon = trackEndIconRef.current;
        if (!icon) return;
        icon.style.opacity = String(0.35 + progress * 0.65);
        icon.style.transform = calm ? '' : `scale(${1 + progress * (mobile ? 0.04 : 0.15)}) rotate(${progress * (mobile ? 18 : 45)}deg)`;
        icon.style.color = progress >= 1 ? accentColor : '';
    };

    const resetDestinationFeedback = () => {
        const icon = trackEndIconRef.current;
        if (!icon) return;
        icon.style.transition = calm ? 'none' : mobile
            ? `opacity ${mobileMotionTokens.micro}ms ease-out, transform ${mobileMotionTokens.micro}ms ease-out, color ${mobileMotionTokens.micro}ms ease-out`
            : 'opacity 150ms ease-out, transform 150ms ease-out, color 150ms ease-out';
        icon.style.opacity = '0.35';
        icon.style.transform = 'scale(1) rotate(0deg)';
        icon.style.color = '';
    };

    const setDragFeedback = (deltaX: number) => {
        const button = buttonRef.current;
        if (!button) return;
        const dragX = Math.max(-MAX_DRAG, Math.min(0, deltaX));
        const progress = Math.min(1, Math.abs(dragX) / TRIGGER_DISTANCE);
        button.style.transition = 'none';
        button.style.transform = `translateX(${dragX}px)`;
        button.style.filter = calm ? '' : `brightness(${1 + progress * (mobile ? 0.08 : 0.18)})`;
        const primaryIcon = button.querySelector('svg');
        if (primaryIcon) {
            primaryIcon.style.transform = calm ? '' : `rotate(${progress * (mobile ? -18 : -180)}deg)`;
            primaryIcon.style.scale = String(calm ? 1 : 1 - progress * (mobile ? 0.04 : 0.1));
        }
        if (progress >= 1) {
            button.style.backgroundColor = accentColor;
            button.style.color = '#ffffff';
            button.style.boxShadow = `0 0 16px ${accentColor}66, 0 18px 42px rgba(0, 0, 0, ${0.24 + progress * 0.16})`;
        } else {
            button.style.backgroundColor = '';
            button.style.color = '';
            button.style.boxShadow = `0 18px 42px rgba(0, 0, 0, ${0.24 + progress * 0.16})`;
        }
        const fill = trackFillRef.current;
        if (fill) {
            fill.style.transition = 'none';
            if (mobile) {
                fill.style.width = '96px';
                fill.style.transform = `scaleX(${(48 + Math.abs(dragX)) / 96})`;
            } else fill.style.width = `${48 + Math.abs(dragX)}px`;
            fill.style.backgroundColor = progress >= 1 ? accentColor : '';
            fill.style.opacity = progress >= 1 ? '0.35' : '';
        }
        if (trackEndIconRef.current) trackEndIconRef.current.style.transition = 'none';
        setDestinationFeedback(progress);
    };

    const resetDragFeedback = (mode: 'release' | 'trigger' = 'release', deltaX = 0) => {
        setIsDragging(false);
        const button = buttonRef.current;
        if (!button) return;
        const dragX = Math.max(-MAX_DRAG, Math.min(0, deltaX));
        const fill = trackFillRef.current;
        const destination = trackEndIconRef.current;
        if (mode === 'trigger') {
            stopAnimations();
            feedbackAnimation(button, mobile ? [
                { transform: `translateX(${dragX}px) scale(1)`, opacity: 1 },
                { transform: `translateX(${dragX - mobileMotionTokens.distance}px) scale(${mobileMotionTokens.scale})`, opacity: 0 },
            ] : [
                { transform: `translateX(${dragX}px) scale(1)`, opacity: '1', filter: 'brightness(1.18)' },
                { transform: 'translateX(-80px) scale(0.8)', opacity: '0' },
            ]);
            feedbackAnimation(destination, mobile ? [
                { transform: 'scale(1.04) rotate(18deg)', opacity: 1 },
                { transform: 'translateX(-8px) scale(1) rotate(18deg)', opacity: 0 },
            ] : [
                { transform: 'scale(1.15) rotate(45deg)', opacity: '1' },
                { transform: 'translateX(-40px) scale(0.9) rotate(45deg)', opacity: '0' },
            ]);
            feedbackAnimation(fill, mobile ? [
                { transform: `scaleX(${(48 + Math.abs(dragX)) / 96})`, opacity: 0.35 },
                { transform: 'scaleX(1)', opacity: 0 },
            ] : [
                { width: `${48 + Math.abs(dragX)}px`, opacity: '0.35' },
                { width: '96px', opacity: '0' },
            ]);
        }
        resetDestinationFeedback();
        button.style.transition = calm ? 'none' : mode === 'release' ? mobile
            ? `transform ${mobileMotionTokens.component}ms cubic-bezier(${mobileMotionTokens.ease.join(',')}), opacity ${mobileMotionTokens.component}ms ease-out, background-color ${mobileMotionTokens.micro}ms ease-out, color ${mobileMotionTokens.micro}ms ease-out`
            : 'transform 160ms ease-out, filter 160ms ease-out, box-shadow 160ms ease-out, background-color 160ms ease-out, color 160ms ease-out' : '';
        button.style.transform = '';
        button.style.filter = '';
        button.style.boxShadow = '';
        button.style.backgroundColor = '';
        button.style.color = '';
        const primaryIcon = button.querySelector('svg');
        if (primaryIcon) {
            primaryIcon.style.transition = '';
            primaryIcon.style.transform = '';
            primaryIcon.style.scale = '';
        }
        if (fill) {
            fill.style.transition = '';
            fill.style.width = mobile ? '96px' : '48px';
            fill.style.transform = mobile ? 'scaleX(.5)' : '';
            fill.style.backgroundColor = '';
            fill.style.opacity = '';
        }
    };

    const clearGesture = () => {
        gestureRef.current = null;
        resetDragFeedback();
    };
    useEffect(() => {
        const blur = () => { stopAnimations(); clearGesture(); suppressClickRef.current = false; setShowGuideLine(false); };
        window.addEventListener('blur', blur);
        return () => window.removeEventListener('blur', blur);
    }, [mobile, calm]);
    useEffect(() => { if (disabled && gestureRef.current) { stopAnimations(); clearGesture(); } }, [disabled]);

    return (
        <div
            className={`relative w-12 h-12 transform ${mobile ? '' : 'transition-all duration-300'} ${motionClass}`}
            style={mobile ? { transition: calm ? 'none' : `transform ${mobileMotionTokens.component}ms cubic-bezier(${mobileMotionTokens.ease.join(',')}), opacity ${mobileMotionTokens.component}ms ease-out` } : undefined}
        >
            <div
                style={{ width: '96px', transition: calm ? 'none' : `opacity ${mobile ? mobileMotionTokens.component : 200}ms ease-out` }}
                className={`absolute right-0 top-0 h-12 rounded-full border pointer-events-none z-0 ${showGuideLine || isDragging ? 'opacity-100' : 'opacity-0'} ${isDaylight ? 'border-black/10 bg-black/5' : 'border-white/10 bg-white/5'}`}
            >
                <motion.div
                    className="absolute left-3.5 top-[17px] w-3.5 h-3.5 pointer-events-none flex items-center justify-center"
                    animate={showGuideLine && !calm ? { x: [0, -4, 0], opacity: [0.45, 0.85, 0.45] } : { x: 0, opacity: 0.45 }}
                    transition={showGuideLine && !calm ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : { duration: calm ? 0 : undefined }}
                >
                    <div ref={trackEndIconRef} style={{ color: isDaylight ? '#000000' : '#ffffff' }} className="w-full h-full flex items-center justify-center" title={slideTitle}>
                        <SlideIcon size={14} />
                    </div>
                </motion.div>
                <div ref={trackFillRef} style={{ width: mobile ? '96px' : '48px', transform: mobile ? 'scaleX(.5)' : undefined, transformOrigin: '100% 50%' }} className={`absolute right-0 top-0 bottom-0 rounded-full pointer-events-none ${isDaylight ? 'bg-black/10' : 'bg-white/10'}`} />
            </div>
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                onPointerDown={(event) => {
                    if (disabled || event.button !== 0) return;
                    stopAnimations();
                    gestureRef.current = { startX: event.clientX, startY: event.clientY, triggered: false };
                    suppressClickRef.current = false;
                    setShowGuideLine(false);
                    setIsDragging(true);
                    setDragFeedback(0);
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                }}
                onPointerMove={(event) => {
                    const gesture = gestureRef.current;
                    if (!gesture || gesture.triggered) return;
                    const deltaX = event.clientX - gesture.startX;
                    const deltaY = event.clientY - gesture.startY;
                    setDragFeedback(deltaX);
                    if (deltaX <= -TRIGGER_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
                        gesture.triggered = true;
                        suppressClickRef.current = true;
                        event.preventDefault();
                        resetDragFeedback('trigger', deltaX);
                        onSlide();
                    }
                }}
                onPointerUp={clearGesture}
                onPointerCancel={clearGesture}
                onLostPointerCapture={clearGesture}
                onMouseEnter={() => { if (supportsHover) setShowGuideLine(true); }}
                onMouseLeave={() => { if (supportsHover) setShowGuideLine(false); }}
                onClick={(event) => {
                    if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                    onActivate();
                }}
                style={{ touchAction: 'none' }}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg backdrop-blur-md transform border-none absolute right-0 top-0 z-10 disabled:opacity-40 disabled:cursor-default ${isDaylight ? 'bg-white/70 text-zinc-900' : 'bg-black/40 text-white'}`}
                title={title}
                aria-label={title}
            >
                <Icon size={20} />
            </button>
        </div>
    );
};
