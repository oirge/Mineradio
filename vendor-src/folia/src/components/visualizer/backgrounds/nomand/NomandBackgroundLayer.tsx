import React from 'react';
import {
    FlutedGlass,
    HalftoneDots,
    ImageDithering,
    LensDistortion,
    PaperTexture,
} from '@paper-design/shaders-react';
import { DEFAULT_NOMAND_BACKGROUND_TUNING, type MonetBackgroundImage, type NomandBackgroundTuning, type Theme } from '../../../../types';
import {
    getLensDistortionOverscan,
    getPaperTextureOverscan,
    NOMAND_LENS_SHAPE,
    NOMAND_PAPER_TEXTURE_SHAPE,
    resolveDaylightInversion,
    resolveHalftoneInversion,
} from './nomandShaderAdjustments';

// src/components/visualizer/backgrounds/nomand/NomandBackgroundLayer.tsx
// Renders the selected Paper image shader with the current theme palette.

interface NomandBackgroundLayerProps {
    coverUrl?: string | null;
    monetBackgroundImage?: MonetBackgroundImage | null;
    tuning?: NomandBackgroundTuning;
    theme: Theme;
    isDaylight?: boolean;
}

const NomandBackgroundLayer: React.FC<NomandBackgroundLayerProps> = ({
    coverUrl,
    monetBackgroundImage,
    tuning: tuningOverride,
    theme,
    isDaylight,
}) => {
    const tuning = { ...DEFAULT_NOMAND_BACKGROUND_TUNING, ...tuningOverride };
    const sourceUrl = tuning.imageSource === 'uploaded-global'
        ? monetBackgroundImage?.url ?? coverUrl
        : coverUrl ?? monetBackgroundImage?.url;

    if (!sourceUrl) {
        return (
            <div
                className="absolute inset-0 z-0"
                style={{ backgroundColor: theme.backgroundColor }}
            />
        );
    }

    // Keeps each Paper shader's fixed design choices local while exposing the selected variant's tuning.
    const renderShader = () => {
        const commonProps = {
            width: '100%' as const,
            height: '100%' as const,
            image: sourceUrl,
            fit: 'cover' as const,
            minPixelRatio: 1,
            maxPixelCount: 1920 * 1080,
            style: { width: '100%', height: '100%' },
        };

        switch (tuning.effect) {
            case 'fluted-glass':
                return (
                    <FlutedGlass
                        key={`${sourceUrl}:fluted-glass`}
                        {...commonProps}
                        colorBack={theme.backgroundColor}
                        colorShadow={theme.secondaryColor}
                        colorHighlight={theme.primaryColor}
                        shadows={0.25}
                        size={tuning.flutedGlassSize}
                        distortion={tuning.flutedGlassDistortion}
                        blur={tuning.flutedGlassBlur}
                        shape="lines"
                        distortionShape="prism"
                        highlights={0.1}
                        edges={0.25}
                    />
                );
            case 'paper-texture':
                return (
                    <PaperTexture
                        key={`${sourceUrl}:paper-texture`}
                        {...commonProps}
                        {...NOMAND_PAPER_TEXTURE_SHAPE}
                        colorFront={theme.accentColor}
                        colorBack={theme.backgroundColor}
                        contrast={tuning.paperTextureContrast}
                        roughness={tuning.paperTextureRoughness}
                        fiber={tuning.paperTextureFiber}
                        scale={getPaperTextureOverscan(tuning.paperTextureRoughness, tuning.paperTextureFiber)}
                    />
                );
            case 'halftone-dots':
                return (
                    <HalftoneDots
                        key={`${sourceUrl}:halftone-dots`}
                        {...commonProps}
                        colorBack={theme.backgroundColor}
                        colorFront={theme.accentColor}
                        size={tuning.halftoneDotsSize}
                        radius={tuning.halftoneDotsRadius}
                        contrast={tuning.halftoneDotsContrast}
                        originalColors={tuning.halftoneDotsOriginalColors}
                        inverted={resolveHalftoneInversion(
                            tuning.halftoneDotsInverted,
                            tuning.halftoneDotsOriginalColors,
                            isDaylight,
                        )}
                        grid="hex"
                        type="gooey"
                        grainMixer={0.12}
                        grainOverlay={0.06}
                        grainSize={0.5}
                    />
                );
            case 'lens-distortion':
                return (
                    <LensDistortion
                        key={`${sourceUrl}:lens-distortion`}
                        {...commonProps}
                        {...NOMAND_LENS_SHAPE}
                        spread={tuning.lensDistortionSpread}
                        dispersion={tuning.lensDistortionDispersion}
                        lensBulge={tuning.lensDistortionBulge}
                        scale={getLensDistortionOverscan(tuning.lensDistortionBulge, tuning.lensDistortionSpread)}
                    />
                );
            default:
                return (
                    <ImageDithering
                        key={`${sourceUrl}:dithering`}
                        {...commonProps}
                        colorBack={theme.backgroundColor}
                        colorFront={theme.accentColor}
                        colorHighlight={theme.primaryColor}
                        originalColors={tuning.originalColors}
                        inverted={resolveDaylightInversion(tuning.inverted, tuning.originalColors, isDaylight)}
                        type={tuning.ditheringType}
                        size={tuning.size}
                        colorSteps={tuning.colorSteps}
                    />
                );
        }
    };

    return (
        <div
            className="absolute inset-0 z-0 overflow-hidden"
            style={{ backgroundColor: theme.backgroundColor, pointerEvents: 'none' }}
        >
            {renderShader()}
            {tuning.overlayEnabled && tuning.overlayOpacity > 0 && (
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundColor: theme.backgroundColor,
                        opacity: tuning.overlayOpacity,
                    }}
                />
            )}
        </div>
    );
};

export default React.memo(NomandBackgroundLayer);
