import type { LyricData } from '../types';
import { parseYRC as parseCoreYRC } from './lyrics/parserCore';

export const parseYRC = (yrcString: string, translationString: string = ''): LyricData => {
    return parseCoreYRC(yrcString, translationString);
};
