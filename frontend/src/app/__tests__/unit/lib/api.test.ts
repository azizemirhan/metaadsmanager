import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, setStoredToken } from '@/app/lib/api';

describe('API Client', () => {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCampaigns', () => {
    it('should fetch campaigns with default parameters', async () => {
      const mockResponse = { data: [{ id: '1', name: 'Test Campaign', status: 'ACTIVE' }], count: 1 };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.getCampaigns();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/campaigns?days=30`,
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should fetch campaigns with custom days parameter', async () => {
      const mockResponse = { data: [], count: 0 };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await api.getCampaigns(7);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/campaigns?days=7`,
        expect.any(Object)
      );
    });

    it('should throw error when response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Server error' }),
      });

      await expect(api.getCampaigns()).rejects.toThrow('Server error');
    });

    it('should include auth token in headers', async () => {
      setStoredToken('test_token_123');

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], count: 0 }),
      });

      await api.getCampaigns();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test_token_123',
          }),
        })
      );
    });
  });

  describe('authLogin', () => {
    it('should login with valid credentials', async () => {
      const mockResponse = {
        access_token: 'token_123',
        token_type: 'bearer',
        user: { id: '1', email: 'test@example.com', username: 'test', role: 'admin', is_active: true },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.authLogin('test@example.com', 'password123');

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/auth/login`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on invalid credentials', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid credentials' }),
      });

      await expect(api.authLogin('test@example.com', 'wrongpassword')).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });
});
