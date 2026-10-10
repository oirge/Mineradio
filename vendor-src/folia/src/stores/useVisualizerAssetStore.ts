// src/stores/useVisualizerAssetStore.ts
// User-supplied visualizer assets: the cappella emoji/avatar packs and the monet background /
// portrait images, plus the loading flags their restore paths set.
//
// Split out of useSettingsUiStore because these are not settings: they are asynchronously
// restored binary assets with their own in-flight state, and mixing them into the settings
// snapshot meant every consumer of any setting re-rendered when an image finished loading.

import { create } from 'zustand';
import { buildStoredCappellaAvatar, clearCustomCappellaAvatar, isSupportedCappellaAvatarFile, saveCustomCappellaAvatar } from '../services/cappellaAvatarPack';
import { buildStoredCappellaEmojiPack, clearCustomCappellaEmojiPack, isSupportedCappellaEmojiFile, saveCustomCappellaEmojiPack } from '../services/cappellaEmojiPack';
import { buildStoredMonetBackgroundImage, clearMonetBackgroundImage, isSupportedMonetBackgroundFile, saveMonetBackgroundImage } from '../services/monetBackgroundImage';
import { buildStoredMonetPortraitImage, clearMonetPortraitImage, isSupportedMonetPortraitFile, saveMonetPortraitImage } from '../services/monetPortraitImage';
import { type CappellaAvatarImage, type CappellaEmojiImage, type MonetBackgroundImage, type MonetPortraitImage, type StoredCappellaAvatarImage, type StoredCappellaEmojiImage, type StoredMonetBackgroundImage, type StoredMonetPortraitImage } from '../types';
import i18n from '../i18n/config';
import { setStatusMessage } from './useStatusMessageStore';

export type VisualizerAssetState = {
    storedCappellaEmojiPack: StoredCappellaEmojiImage[];
    cappellaCustomEmojiImages: CappellaEmojiImage[];
    isLoadingCappellaCustomEmojiPack: boolean;
    storedCappellaAvatarPack: StoredCappellaAvatarImage[];
    cappellaCustomAvatarImages: CappellaAvatarImage[];
    isLoadingCappellaCustomAvatarPack: boolean;
    storedMonetBackgroundImage: StoredMonetBackgroundImage | null;
    monetBackgroundImage: MonetBackgroundImage | null;
    isLoadingMonetBackgroundImage: boolean;
    storedMonetPortraitImage: StoredMonetPortraitImage | null;
    monetPortraitImage: MonetPortraitImage | null;
    isLoadingMonetPortraitImage: boolean;
    setStoredCappellaEmojiPack: (pack: StoredCappellaEmojiImage[]) => void;
    setCappellaCustomEmojiImages: (images: CappellaEmojiImage[]) => void;
    setIsLoadingCappellaCustomEmojiPack: (loading: boolean) => void;
    setStoredCappellaAvatarPack: (pack: StoredCappellaAvatarImage[]) => void;
    setCappellaCustomAvatarImages: (images: CappellaAvatarImage[]) => void;
    setIsLoadingCappellaCustomAvatarPack: (loading: boolean) => void;
    setStoredMonetBackgroundImage: (image: StoredMonetBackgroundImage | null) => void;
    setMonetBackgroundImage: (image: MonetBackgroundImage | null) => void;
    setIsLoadingMonetBackgroundImage: (loading: boolean) => void;
    setStoredMonetPortraitImage: (image: StoredMonetPortraitImage | null) => void;
    setMonetPortraitImage: (image: MonetPortraitImage | null) => void;
    setIsLoadingMonetPortraitImage: (loading: boolean) => void;
};

export const useVisualizerAssetStore = create<VisualizerAssetState>((set, get) => ({
    storedCappellaEmojiPack: [],
    cappellaCustomEmojiImages: [],
    isLoadingCappellaCustomEmojiPack: true,
    storedCappellaAvatarPack: [],
    cappellaCustomAvatarImages: [],
    isLoadingCappellaCustomAvatarPack: true,
    storedMonetBackgroundImage: null,
    monetBackgroundImage: null,
    isLoadingMonetBackgroundImage: true,
    storedMonetPortraitImage: null,
    monetPortraitImage: null,
    isLoadingMonetPortraitImage: true,
    setStoredCappellaEmojiPack: (pack) => set({ storedCappellaEmojiPack: pack }),
    setCappellaCustomEmojiImages: (images) => set({ cappellaCustomEmojiImages: images }),
    setIsLoadingCappellaCustomEmojiPack: (loading) => set({ isLoadingCappellaCustomEmojiPack: loading }),
    setStoredCappellaAvatarPack: (pack) => set({ storedCappellaAvatarPack: pack }),
    setCappellaCustomAvatarImages: (images) => set({ cappellaCustomAvatarImages: images }),
    setIsLoadingCappellaCustomAvatarPack: (loading) => set({ isLoadingCappellaCustomAvatarPack: loading }),
    setStoredMonetBackgroundImage: (image) => set({ storedMonetBackgroundImage: image }),
    setMonetBackgroundImage: (image) => set({ monetBackgroundImage: image }),
    setIsLoadingMonetBackgroundImage: (loading) => set({ isLoadingMonetBackgroundImage: loading }),
    setStoredMonetPortraitImage: (image) => set({ storedMonetPortraitImage: image }),
    setMonetPortraitImage: (image) => set({ monetPortraitImage: image }),
    setIsLoadingMonetPortraitImage: (loading) => set({ isLoadingMonetPortraitImage: loading }),
}));

/** The asset half of the former settings snapshot, for the settings surfaces that edit them. */
export const selectVisualizerAssetSnapshot = (state: VisualizerAssetState) => ({
    cappellaCustomAvatarImages: state.cappellaCustomAvatarImages,
    cappellaCustomEmojiImages: state.cappellaCustomEmojiImages,
    isLoadingCappellaCustomAvatarPack: state.isLoadingCappellaCustomAvatarPack,
    isLoadingCappellaCustomEmojiPack: state.isLoadingCappellaCustomEmojiPack,
    isLoadingMonetBackgroundImage: state.isLoadingMonetBackgroundImage,
    isLoadingMonetPortraitImage: state.isLoadingMonetPortraitImage,
    monetBackgroundImage: state.monetBackgroundImage,
    monetPortraitImage: state.monetPortraitImage,
    setCappellaCustomAvatarImages: state.setCappellaCustomAvatarImages,
    setCappellaCustomEmojiImages: state.setCappellaCustomEmojiImages,
    setIsLoadingCappellaCustomAvatarPack: state.setIsLoadingCappellaCustomAvatarPack,
    setIsLoadingCappellaCustomEmojiPack: state.setIsLoadingCappellaCustomEmojiPack,
    setIsLoadingMonetBackgroundImage: state.setIsLoadingMonetBackgroundImage,
    setIsLoadingMonetPortraitImage: state.setIsLoadingMonetPortraitImage,
    setMonetBackgroundImage: state.setMonetBackgroundImage,
    setMonetPortraitImage: state.setMonetPortraitImage,
    setStoredCappellaAvatarPack: state.setStoredCappellaAvatarPack,
    setStoredCappellaEmojiPack: state.setStoredCappellaEmojiPack,
    setStoredMonetBackgroundImage: state.setStoredMonetBackgroundImage,
    setStoredMonetPortraitImage: state.setStoredMonetPortraitImage,
    storedCappellaAvatarPack: state.storedCappellaAvatarPack,
    storedCappellaEmojiPack: state.storedCappellaEmojiPack,
    storedMonetBackgroundImage: state.storedMonetBackgroundImage,
    storedMonetPortraitImage: state.storedMonetPortraitImage,
});
