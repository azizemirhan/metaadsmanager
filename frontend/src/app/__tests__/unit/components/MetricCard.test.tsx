import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '@/app/components/MetricCard';

describe('MetricCard', () => {
  it('renders label correctly', () => {
    render(<MetricCard label="Toplam Harcama" value="1.500,50" />);
    expect(screen.getByText('Toplam Harcama')).toBeInTheDocument();
  });

  it('renders value correctly', () => {
    render(<MetricCard label="Test" value="1500.5" />);
    expect(screen.getByText('1500.5')).toBeInTheDocument();
  });

  it('renders value with prefix in label', () => {
    render(<MetricCard label="Harcama" value="₺1.500,50" />);
    expect(screen.getByText('₺1.500,50')).toBeInTheDocument();
  });

  it('renders positive trend with trendLabel', () => {
    render(
      <MetricCard label="Test" value="100" trend="up" trendLabel="+5,2%" />
    );
    expect(screen.getByText(/\+5,2%/)).toBeInTheDocument();
  });

  it('renders negative trend with trendLabel', () => {
    render(
      <MetricCard label="Test" value="100" trend="down" trendLabel="-3,5%" />
    );
    expect(screen.getByText(/-3,5%/)).toBeInTheDocument();
  });

  it('renders sub text when provided', () => {
    render(<MetricCard label="Test" value="100" sub="Önceki dönem: 90" />);
    expect(screen.getByText('Önceki dönem: 90')).toBeInTheDocument();
  });

  it('renders without trend when not provided', () => {
    render(<MetricCard label="Test" value="100" />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('renders zero value correctly', () => {
    render(<MetricCard label="Test" value="0" />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders large number as string', () => {
    render(<MetricCard label="Test" value="1.000.000" />);
    expect(screen.getByText('1.000.000')).toBeInTheDocument();
  });
});
