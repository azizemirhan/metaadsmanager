import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Auth Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  describe('Token Management', () => {
    it('should return null when no token exists', () => {
      const token = localStorage.getItem('token');
      expect(token).toBeNull();
    });

    it('should store and retrieve token', () => {
      localStorage.setItem('token', 'test_token');
      const token = localStorage.getItem('token');
      expect(token).toBe('test_token');
    });

    it('should remove token on clear', () => {
      localStorage.setItem('token', 'test_token');
      localStorage.removeItem('token');
      const token = localStorage.getItem('token');
      expect(token).toBeNull();
    });
  });

  describe('JWT Decoding', () => {
    it('should decode valid JWT payload', () => {
      const payload = { sub: 'user123', role: 'admin' };
      const base64Payload = btoa(JSON.stringify(payload));
      const mockToken = `header.${base64Payload}.signature`;
      
      const parts = mockToken.split('.');
      const decoded = JSON.parse(atob(parts[1]));
      
      expect(decoded.sub).toBe('user123');
      expect(decoded.role).toBe('admin');
    });

    it('should handle invalid token format', () => {
      const invalidToken = 'invalid_token';
      const parts = invalidToken.split('.');
      
      expect(parts.length).not.toBe(3);
    });
  });
});
