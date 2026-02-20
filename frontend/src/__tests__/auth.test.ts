/**
 * Auth yardımcı fonksiyonları testleri (frontend)
 * localStorage token yönetimi ve API helper'ları test eder.
 */

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// ─── Token yönetimi yardımcıları ──────────────────────────────────────────────
const TOKEN_KEY = 'metaads_token';

function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function isLoggedIn(): boolean {
  return !!getToken();
}

// ─── Testler ──────────────────────────────────────────────────────────────────

describe('Token Yönetimi', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('token kaydedilir ve okunur', () => {
    saveToken('abc.def.ghi');
    expect(getToken()).toBe('abc.def.ghi');
  });

  it('token silinir', () => {
    saveToken('abc.def.ghi');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('token yokken isLoggedIn false döner', () => {
    expect(isLoggedIn()).toBe(false);
  });

  it('token varken isLoggedIn true döner', () => {
    saveToken('valid.token.here');
    expect(isLoggedIn()).toBe(true);
  });

  it('farklı tokenlar üst üste yazılır', () => {
    saveToken('first.token');
    saveToken('second.token');
    expect(getToken()).toBe('second.token');
  });
});

// ─── Metrik formatlama yardımcıları ──────────────────────────────────────────

function formatCurrency(value: number, currency = 'TRY'): string {
  if (currency === 'TRY') return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `%${value.toFixed(2)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('tr-TR');
}

function formatROAS(value: number): string {
  return `${value.toFixed(2)}x`;
}

describe('Metrik Formatlama', () => {
  it('TRY para birimi formatlar', () => {
    expect(formatCurrency(1500)).toContain('₺');
    expect(formatCurrency(1500)).toContain('1.500');
  });

  it('USD para birimi formatlar', () => {
    expect(formatCurrency(99.99, 'USD')).toBe('$99.99');
  });

  it('yüzde formatlar', () => {
    expect(formatPercent(1.5)).toBe('%1.50');
    expect(formatPercent(0)).toBe('%0.00');
  });

  it('büyük sayıları formatlar', () => {
    const result = formatNumber(1000000);
    expect(result).toBeDefined();
  });

  it('ROAS formatlar', () => {
    expect(formatROAS(3.25)).toBe('3.25x');
    expect(formatROAS(1)).toBe('1.00x');
  });
});

// ─── Alert kural doğrulama ──────────────────────────────────────────────────

interface AlertRuleForm {
  name: string;
  metric: string;
  condition: string;
  threshold: number;
}

function validateAlertRule(form: AlertRuleForm): string[] {
  const errors: string[] = [];
  if (!form.name || form.name.trim().length === 0) errors.push('Kural adı zorunlu');
  if (!['ctr', 'roas', 'spend', 'cpc', 'cpm', 'impressions', 'clicks', 'frequency'].includes(form.metric)) {
    errors.push('Geçersiz metrik');
  }
  if (!['lt', 'gt', 'change_pct'].includes(form.condition)) {
    errors.push('Geçersiz koşul');
  }
  if (form.threshold <= 0) errors.push('Eşik değeri 0\'dan büyük olmalı');
  return errors;
}

describe('Alert Kural Doğrulama', () => {
  it('geçerli kural hata döndürmez', () => {
    const errors = validateAlertRule({
      name: 'CTR Uyarı',
      metric: 'ctr',
      condition: 'lt',
      threshold: 1.5,
    });
    expect(errors).toHaveLength(0);
  });

  it('boş ad hata döndürür', () => {
    const errors = validateAlertRule({
      name: '',
      metric: 'ctr',
      condition: 'lt',
      threshold: 1.5,
    });
    expect(errors).toContain('Kural adı zorunlu');
  });

  it('geçersiz metrik hata döndürür', () => {
    const errors = validateAlertRule({
      name: 'Test',
      metric: 'invalid',
      condition: 'lt',
      threshold: 1.0,
    });
    expect(errors).toContain('Geçersiz metrik');
  });

  it('negatif eşik hata döndürür', () => {
    const errors = validateAlertRule({
      name: 'Test',
      metric: 'spend',
      condition: 'gt',
      threshold: -100,
    });
    expect(errors).toContain('Eşik değeri 0\'dan büyük olmalı');
  });

  it('tüm geçerli metrikler kabul edilir', () => {
    const validMetrics = ['ctr', 'roas', 'spend', 'cpc', 'cpm', 'impressions', 'clicks', 'frequency'];
    validMetrics.forEach(metric => {
      const errors = validateAlertRule({
        name: 'Test',
        metric,
        condition: 'gt',
        threshold: 1.0,
      });
      expect(errors).not.toContain('Geçersiz metrik');
    });
  });
});
