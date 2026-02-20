/**
 * MetricCard component testleri
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MetricCard, MetricCardCompact } from '../app/components/MetricCard';

describe('MetricCard', () => {
  it('label ve value render eder', () => {
    render(<MetricCard label="CTR" value="1.5%" />);
    expect(screen.getByText('CTR')).toBeDefined();
    expect(screen.getByText('1.5%')).toBeDefined();
  });

  it('sub text render eder', () => {
    render(<MetricCard label="Harcama" value="₺1.500" sub="Son 30 gün" />);
    expect(screen.getByText('Son 30 gün')).toBeDefined();
  });

  it('trend up gösterir', () => {
    render(
      <MetricCard label="CTR" value="2.0%" trend="up" trendLabel="+0.5%" />
    );
    expect(screen.getByText(/\+0\.5%/)).toBeDefined();
    expect(screen.getByText(/↑/)).toBeDefined();
  });

  it('trend down gösterir', () => {
    render(
      <MetricCard label="CPC" value="₺5" trend="down" trendLabel="-10%" />
    );
    expect(screen.getByText(/↓/)).toBeDefined();
  });

  it('icon render eder', () => {
    render(<MetricCard label="ROAS" value="3.2x" icon="📈" />);
    expect(screen.getByText('📈')).toBeDefined();
  });

  it('sub olmadan render eder', () => {
    const { container } = render(<MetricCard label="Test" value="100" />);
    expect(container).toBeDefined();
  });

  it('trend olmadan trendLabel render etmez', () => {
    render(<MetricCard label="Test" value="100" trendLabel="+5%" />);
    // trend prop olmadan trendLabel görünmemeli
    expect(screen.queryByText('+5%')).toBeNull();
  });
});

describe('MetricCardCompact', () => {
  it('label ve value render eder', () => {
    render(<MetricCardCompact label="Gösterim" value="50.000" />);
    expect(screen.getByText('Gösterim')).toBeDefined();
    expect(screen.getByText('50.000')).toBeDefined();
  });

  it('trend up render eder', () => {
    render(
      <MetricCardCompact label="Tıklama" value="750" trend="up" trendValue="+12%" />
    );
    expect(screen.getByText(/↑/)).toBeDefined();
    expect(screen.getByText(/\+12%/)).toBeDefined();
  });

  it('trend down render eder', () => {
    render(
      <MetricCardCompact label="CTR" value="1.2%" trend="down" trendValue="-0.3%" />
    );
    expect(screen.getByText(/↓/)).toBeDefined();
  });

  it('trend olmadan render eder', () => {
    const { container } = render(
      <MetricCardCompact label="Test" value="42" />
    );
    expect(container).toBeDefined();
  });
});
