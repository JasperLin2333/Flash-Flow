
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set dummy env vars before anything else
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test';

// Mock Supabase before importing anything else
vi.mock('../supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } } }))
        },
        from: vi.fn(() => ({
            insert: vi.fn(() => Promise.resolve({ error: null }))
        }))
    }
}));

import { runQuickDiagnostic } from '../trackingService';

describe('Network Diagnostics Logic', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Mock global fetch
        global.fetch = vi.fn();
    });

    it('should calculate latency correctly when health check succeeds', async () => {
        // Mock /api/health response
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            status: 200,
        });

        // Mock Geo IP response
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                country: 'China',
                region: 'Guangdong',
                city: 'Shenzhen',
                isp: 'China Telecom',
                ip: '1.2.3.4'
            })
        });

        const result = await runQuickDiagnostic() as any;

        expect(result).toHaveProperty('latency');
        expect(typeof result.latency).toBe('number');
        expect(result.status).toBe(200);
        expect(result.ok).toBe(true);
        expect(result.country).toBe('China');
        expect(result.isp).toBe('China Telecom');
    });

    it('should handle geo-ip failure gracefully', async () => {
        // Health check OK
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            status: 200,
        });

        // Geo IP Fails
        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        const result = await runQuickDiagnostic() as any;

        expect(result.ok).toBe(true);
        expect(result.latency).toBeDefined();
        // Should not have geo fields
        expect(result.country).toBeUndefined();
    });

    it('should return error object when main health check fails', async () => {
        // Health check throws
        (global.fetch as any).mockRejectedValueOnce(new Error('Failed to fetch'));

        const result = await runQuickDiagnostic() as any;

        expect(result).toHaveProperty('error');
        expect(result.error).toContain('Failed to fetch');
    });
});
