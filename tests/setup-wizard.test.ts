import { describe, it, expect } from 'vitest';
import { validateStep, buildPayload, STEPS, type WizardAnswers } from '../components/SetupWizard';

const full: WizardAnswers = {
  businessName: 'Test Jewellers', city: 'Cape Town', website: 'example.com', pains: ['Appointment no-shows'], goal: '',
  phoneSystem: 'Mobile phone', calendarTool: '', callsPerWeek: '40', missedShare: '10–25%', budget: 'Not sure yet',
  timeline: 'Just looking', name: 'Test Person', email: 'Test@Example.com', phone: '',
};

describe('setup wizard', () => {
  it('has five steps', () => expect(STEPS.length).toBe(5));
  it('blocks each step until required answers are in', () => {
    const empty = { ...full, businessName: '', pains: [], phoneSystem: '', budget: '', email: 'nope' };
    expect(validateStep(0, empty)).toBeTruthy();
    expect(validateStep(1, empty)).toBeTruthy();
    expect(validateStep(2, empty)).toBeTruthy();
    expect(validateStep(3, empty)).toBeTruthy();
    expect(validateStep(4, empty)).toBeTruthy();
    for (let i = 0; i < 5; i++) expect(validateStep(i, full)).toBeNull();
  });
  it('keeps the lead-intake fields the n8n workflow reads', () => {
    const p = buildPayload(full);
    expect(p).toMatchObject({ email: 'test@example.com', company_name: 'Test Jewellers', city: 'Cape Town', current_url: 'example.com' });
    expect(p.wizard.calls_per_week).toBe(40);
  });
});
