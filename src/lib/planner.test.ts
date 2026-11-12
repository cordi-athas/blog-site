import { describe, expect, it } from 'vitest';
import { buildDays, findOpportunities, groupOpportunities, optimizePlan, stretchesFromLeave } from './planner';

describe('planner 2027', () => {
  const days = buildDays(2027, { saturdayWork: false });
  const opps = findOpportunities(days, 2027, { maxLeave: 10, maxLength: 30 });
  const groups = groupOpportunities(days, 2027, opps);

  it('Ramazan Bayramı: 1,5 gün izinle 9 gün (6–14 Mart)', () => {
    const g = groups.find((g) => g.name === 'Ramazan Bayramı')!;
    expect(g.base.length).toBe(3);
    const o = g.options.find((o) => o.length === 9)!;
    expect(o.leave).toBe(1.5);
    expect(o.start).toBe('2027-03-06');
    expect(o.end).toBe('2027-03-14');
  });

  it('29 Ekim Cuma: izinsiz 3 gün', () => {
    const g = groups.find((g) => g.name === 'Cumhuriyet Bayramı')!;
    expect(g.base.length).toBe(3);
  });

  it('plan bütçeyi aşmaz ve çakışma yoktur', () => {
    const plan = optimizePlan(opps, 14);
    expect(plan.leave).toBeLessThanOrEqual(14);
    for (let i = 1; i < plan.items.length; i++) expect(plan.items[i].start > plan.items[i - 1].end).toBe(true);
    expect(plan.totalDays).toBeGreaterThan(30);
  });

  it('seçili izinlerden blok hesaplanır', () => {
    const leave = new Set(['2027-03-08', '2027-03-12']);
    const s = stretchesFromLeave(days, leave, 2027);
    expect(s).toEqual([{ start: '2027-03-06', end: '2027-03-14', length: 9, leave: 1.5 }]);
  });
});

describe('cumartesi çalışanlar', () => {
  it('cumartesi izin günü sayılır', () => {
    const days = buildDays(2027, { saturdayWork: true });
    expect(days.find((d) => d.iso === '2027-03-06')!.cost).toBe(1);
  });
});

describe('gruplama', () => {
  it('2027 Kurban Bayramı ve 19 Mayıs tek blokta birleşir', () => {
    const days = buildDays(2027, { saturdayWork: false });
    const groups = groupOpportunities(days, 2027, findOpportunities(days, 2027, { maxLeave: 10, maxLength: 30 }));
    const g = groups.find((g) => g.name.startsWith('Kurban'))!;
    expect(g.name).toContain('Gençlik ve Spor');
    expect(groups.some((x) => x.name.startsWith('Atatürk'))).toBe(false);
  });
  it('plan izin günlerini seçili yıl dışına taşımaz', () => {
    const days = buildDays(2027, { saturdayWork: false });
    const opps = findOpportunities(days, 2027, { maxLeave: 14, maxLength: 30 });
    const plan = optimizePlan(opps, 14, 2027);
    for (const o of plan.items) for (const d of o.leaveDays) expect(d.startsWith('2027')).toBe(true);
  });
});
