import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

// Mock dependencies to avoid side effects (db connection, file writing)
vi.mock('../../models/certificate.js', () => ({ default: {} }));
vi.mock('../../internal/audit-log.js', () => ({ default: {} }));
vi.mock('../../internal/nginx.js', () => ({ default: {} }));
vi.mock('../../lib/certbot.js', () => ({ installPlugin: vi.fn() }));

// Mock fs
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

// Import the module under test
import internalCertificate from '../../internal/certificate.js';

describe('Security Fix: Prototype Pollution', () => {
    let originalPerformTestForDomain;

    beforeEach(() => {
        vi.clearAllMocks();
        // Save original method
        originalPerformTestForDomain = internalCertificate.performTestForDomain;
        // Mock performTestForDomain
        internalCertificate.performTestForDomain = vi.fn().mockResolvedValue('success');
    });

    afterEach(() => {
        // Restore original method
        internalCertificate.performTestForDomain = originalPerformTestForDomain;
        vi.restoreAllMocks();
    });

    it('should return an object with null prototype', async () => {
        const mockAccess = {
            can: vi.fn().mockResolvedValue(true)
        };
        const payload = {
            domains: ['example.com', 'test.com']
        };

        const result = await internalCertificate.testHttpsChallenge(mockAccess, payload);

        expect(result).toBeDefined();
        expect(result['example.com']).toBe('success');
        expect(result['test.com']).toBe('success');
        
        // This is the key check: the object should have null prototype
        expect(Object.getPrototypeOf(result)).toBeNull();
        expect(result.__proto__).toBeUndefined();
    });
});