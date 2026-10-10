import { detectChorusLines } from '@/utils/chorusDetector';
import { parseLRC } from '@/utils/lrcParser';
import { parseYRC } from '@/utils/yrcParser';

const lrcData = `[00:04.00]Line 1
[00:06.00]Line 2
[00:10.00]Line 3
`;

console.log('--- LRC Test ---');
const parsedLRC = parseLRC(lrcData);
parsedLRC.lines.forEach((line: any) => {
    console.log(`[${line.startTime.toFixed(2)} - ${line.endTime.toFixed(2)}] ${line.fullText}`);
    if (line.fullText === '......') {
        line.words.forEach((word: any) => console.log(`  dot: [${word.startTime.toFixed(2)} - ${word.endTime.toFixed(2)}] ${word.text}`));
    }
});

const yrcData = `[100,2000](100,1000,0)Line (1100,1000,0)1
[10000,2000](10000,1000,0)Line (11000,1000,0)3
`;

console.log('\n--- YRC Test ---');
const parsedYRC = parseYRC(yrcData);
parsedYRC.lines.forEach((line: any) => {
    console.log(`[${line.startTime.toFixed(2)} - ${line.endTime.toFixed(2)}] ${line.fullText}`);
    if (line.fullText === '......') {
        line.words.forEach((word: any) => console.log(`  dot: [${word.startTime.toFixed(2)} - ${word.endTime.toFixed(2)}] ${word.text}`));
    }
});

console.log('\n--- Chorus Detection Test ---');
const chorus = detectChorusLines(lrcData);
console.log('Chorus detected:', Array.from(chorus));
