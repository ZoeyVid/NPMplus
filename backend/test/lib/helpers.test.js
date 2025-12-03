import { describe, it, expect } from 'vitest';
import { parseDatePeriod } from '../../lib/helpers.js';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear.js';

dayjs.extend(quarterOfYear);

describe('parseDatePeriod', () => {
    it('should parse days correctly', () => {
        const expression = '30d';
        const result = parseDatePeriod(expression);
        const expected = dayjs().add(30, 'd');

        // Allow slight difference in execution time
        expect(Math.abs(result.diff(expected))).toBeLessThan(100);
    });

    it('should parse years correctly', () => {
        const result = parseDatePeriod('1y');
        expect(result.year()).toBe(dayjs().add(1, 'y').year());
    });

    it('should parse quarters correctly', () => {
        const result = parseDatePeriod('1Q');
        const expected = dayjs().add(1, 'Q');
        expect(Math.abs(result.diff(expected))).toBeLessThan(100);
    });

    it('should return null for invalid format', () => {
        expect(parseDatePeriod('invalid')).toBe(null);
    });
});
