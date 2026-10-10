import type { LyricData } from '../types';
import { parseLRC as parseCoreLRC } from './lyrics/parserCore';

export const parseLRC = (lrcString: string, translationString: string = ''): LyricData => {
    return parseCoreLRC(lrcString, translationString);
};
