// Mock API handlers for tests
// In a real setup with MSW, these would be used with setupServer

export const mockAuthHandlers = {
  login: {
    success: {
      access_token: 'mock_token_123',
      token_type: 'bearer',
      user: {
        id: '1',
        email: 'test@example.com',
        username: 'testuser',
        role: 'admin',
      },
    },
    error: {
      detail: 'Geçersiz e-posta veya şifre',
    },
  },
  me: {
    success: {
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
      role: 'admin',
    },
  },
};

export const mockCampaignHandlers = {
  list: {
    success: [
      {
        id: 'camp_1',
        name: 'Test Kampanyası 1',
        status: 'ACTIVE',
        spend: 1500.50,
        impressions: 50000,
        clicks: 1000,
        ctr: 2.0,
        cpc: 1.50,
        roas: 3.5,
      },
      {
        id: 'camp_2',
        name: 'Test Kampanyası 2',
        status: 'PAUSED',
        spend: 500.00,
        impressions: 20000,
        clicks: 300,
        ctr: 1.5,
        cpc: 1.67,
        roas: 2.0,
      },
    ],
  },
};

export const mockSettingsHandlers = {
  get: {
    success: {
      META_AD_ACCOUNT_ID: 'act_123456789',
      AI_PROVIDER: 'gemini',
      AI_MODEL_GEMINI: 'gemini-2.0-flash',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '587',
    },
  },
  update: {
    success: {
      message: 'Ayarlar kaydedildi',
    },
  },
};
