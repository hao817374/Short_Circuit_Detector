import { DebugPoint } from '../types';

export const WINDOW_SIZE = 32;
export const TRIM_COUNT = 6;
export const WINDOW_CENTER_OFFSET = Math.floor(WINDOW_SIZE / 2);

const sharedSortBuffer = new Float64Array(WINDOW_SIZE);

export const getWindowAvg = (frame: DebugPoint[], startIndex: number, offset: number) => {
    let count = 0;
    for (let i = 0; i < WINDOW_SIZE; i++) {
        const idx = (startIndex + i) % frame.length;
        if (frame[idx]) {
            sharedSortBuffer[count++] = frame[idx].value + offset;
        }
    }
    if (count < WINDOW_SIZE) return 0;
    sharedSortBuffer.sort();
    let sum = 0;
    const end = WINDOW_SIZE - TRIM_COUNT;
    for (let i = TRIM_COUNT; i < end; i++) {
        sum += sharedSortBuffer[i];
    }
    return sum / (WINDOW_SIZE - TRIM_COUNT * 2);
};
