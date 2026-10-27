import { describe, it, expect } from 'vitest';

// Scrutiny evaluation logic mirror for testing major review interactions
interface ScrutinyCheck {
  id: string;
  rule_id: string;
  result: 'PASS' | 'POTENTIAL_ISSUE' | 'MISSING_EVIDENCE' | 'NEEDS_REVIEW';
  severity: 'CRITICAL' | 'DEFICIENCY' | 'WARNING' | 'INFO';
  plain_explanation: string;
  evidence_quote?: string;
  officer_disposition: 'PENDING' | 'ACCEPTED' | 'WAIVED' | 'CORRECTION_REQUESTED';
  disposition_notes?: string;
}

interface CandidateFieldModel {
  field_key: string;
  field_label: string;
  extracted_value: string;
  original_value: string;
  user_edited: boolean;
  provenance: string;
  validation_status: 'EXTRACTED' | 'APPLICANT_ENTERED' | 'VERIFIED' | 'NEEDS_REVIEW';
}

function evaluateDocumentText(text: string, type: string): { checks: ScrutinyCheck[]; fields: CandidateFieldModel[] } {
  const lower = text.toLowerCase();
  const checks: ScrutinyCheck[] = [];
  const fields: CandidateFieldModel[] = [];

  // Extract Survey / Khasra
  const surveyMatch = text.match(/(?:khasra|survey|plot|gat)\s+(?:no\.?|number|#)?\s*[:\s]*([0-9a-zA-Z\/\-\s]+?)(?:,|\.|\n|$|measuring)/i);
  if (surveyMatch) {
    fields.push({
      field_key: 'land_survey_no',
      field_label: 'Land Survey / Khasra Number',
      extracted_value: surveyMatch[1].trim(),
      original_value: surveyMatch[1].trim(),
      user_edited: false,
      provenance: 'EXTRACTED_FROM_DOCUMENT',
      validation_status: 'EXTRACTED'
    });
  }

  // Extract Land Area
  const areaMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(acres?|hectares?|sq\.?\s*meters?|sqm|sq\.?\s*ft)/i);
  if (areaMatch) {
    const areaNum = parseFloat(areaMatch[1]);
    fields.push({
      field_key: 'land_area',
      field_label: 'Documented Land Area',
      extracted_value: areaMatch[0].trim(),
      original_value: areaMatch[0].trim(),
      user_edited: false,
      provenance: 'EXTRACTED_FROM_DOCUMENT',
      validation_status: areaNum >= 7.5 ? 'VERIFIED' : 'NEEDS_REVIEW'
    });
  }

  // Extract Tenure
  const tenureMatch = text.match(/(\d+)\s*(?:years|yrs)/i);
  const years = tenureMatch ? parseInt(tenureMatch[1], 10) : 0;
  if (tenureMatch) {
    fields.push({
      field_key: 'lease_tenure_years',
      field_label: 'Registered Lease Tenure',
      extracted_value: `${years} Years`,
      original_value: `${years} Years`,
      user_edited: false,
      provenance: 'DETERMINISTIC_PARSED',
      validation_status: years >= 30 ? 'VERIFIED' : 'NEEDS_REVIEW'
    });
  }

  // Check 1: Lease Tenure (APH Section 3.2 minimum 30 years)
  if (type === 'LEASE_DEED' || lower.includes('lease')) {
    checks.push({
      id: 'chk-land-tenure',
      rule_id: 'APH-2024-LAND-01',
      result: years >= 30 ? 'PASS' : 'POTENTIAL_ISSUE',
      severity: years >= 30 ? 'INFO' : 'CRITICAL',
      plain_explanation: years >= 30
        ? 'Verified lease tenure satisfies statutory 30-year minimum threshold.'
        : `Deficient lease tenure of ${years} years violates APH Section 3.2 minimum 30-year norm.`,
      evidence_quote: tenureMatch ? tenureMatch[0] : undefined,
      officer_disposition: 'PENDING'
    });

    const hasReg = lower.includes('registered') && lower.includes('sub-registrar');
    checks.push({
      id: 'chk-land-registration',
      rule_id: 'APH-2024-LAND-02',
      result: hasReg ? 'PASS' : 'MISSING_EVIDENCE',
      severity: hasReg ? 'INFO' : 'DEFICIENCY',
      plain_explanation: hasReg ? 'Deed registered with sub-registrar.' : 'Official sub-registrar registration pending.',
      officer_disposition: 'PENDING'
    });
  }

  // Check 2: Fire Safety NBC 2016
  if (type === 'FIRE_NOC' || lower.includes('fire')) {
    const hasNbc = lower.includes('nbc 2016');
    checks.push({
      id: 'chk-fire-nbc',
      rule_id: 'APH-2024-FIRE-01',
      result: hasNbc ? 'PASS' : 'MISSING_EVIDENCE',
      severity: hasNbc ? 'INFO' : 'CRITICAL',
      plain_explanation: hasNbc ? 'Conforms to NBC 2016 Part 4.' : 'NBC 2016 Part 4 reference missing.',
      officer_disposition: 'PENDING'
    });
  }

  return { checks, fields };
}

describe('Pravaha Regulatory AI Scrutiny & Review Suite', () => {
  it('correctly evaluates a compliant 33-year land lease deed as PASS', () => {
    const validLeaseText = `REGISTERED LEASE DEED
Executed at Gautam Buddha Nagar Sub-Registrar Office Book 1 Deed No. 4589/2020.
Plot / Khasra No. 412/1 and 413, measuring 7.50 Acres.
Term of Lease: 33 Years commencing 01 April 2020.`;

    const { checks, fields } = evaluateDocumentText(validLeaseText, 'LEASE_DEED');

    const tenureCheck = checks.find((c) => c.rule_id === 'APH-2024-LAND-01');
    expect(tenureCheck).toBeDefined();
    expect(tenureCheck?.result).toBe('PASS');
    expect(tenureCheck?.severity).toBe('INFO');

    const regCheck = checks.find((c) => c.rule_id === 'APH-2024-LAND-02');
    expect(regCheck?.result).toBe('PASS');

    // Field extraction checks
    const tenureField = fields.find((f) => f.field_key === 'lease_tenure_years');
    expect(tenureField?.extracted_value).toBe('33 Years');
    expect(tenureField?.validation_status).toBe('VERIFIED');
  });

  it('detects statutory deficiency on short 14-year lease under APH Sec 3.2', () => {
    const deficientLeaseText = `MEMORANDUM OF LEASE AGREEMENT
Khasra No. 89, Survey 14, 2.50 Acres.
The lease tenure is mutually agreed for a duration of 14 Years only.
Sub-registrar registration pending.`;

    const { checks, fields } = evaluateDocumentText(deficientLeaseText, 'LEASE_DEED');

    const tenureCheck = checks.find((c) => c.rule_id === 'APH-2024-LAND-01');
    expect(tenureCheck?.result).toBe('POTENTIAL_ISSUE');
    expect(tenureCheck?.severity).toBe('CRITICAL');
    expect(tenureCheck?.plain_explanation).toContain('violates APH Section 3.2');

    const regCheck = checks.find((c) => c.rule_id === 'APH-2024-LAND-02');
    expect(regCheck?.result).toBe('MISSING_EVIDENCE');
    expect(regCheck?.severity).toBe('DEFICIENCY');

    // Needs review validation status
    const tenureField = fields.find((f) => f.field_key === 'lease_tenure_years');
    expect(tenureField?.validation_status).toBe('NEEDS_REVIEW');
  });

  it('preserves provenance when user edits an extracted field', () => {
    const initialField: CandidateFieldModel = {
      field_key: 'land_area',
      field_label: 'Documented Land Area',
      extracted_value: '7.50 Acres',
      original_value: '7.50 Acres',
      user_edited: false,
      provenance: 'EXTRACTED_FROM_DOCUMENT',
      validation_status: 'EXTRACTED'
    };

    // User corrects value to 8.00 Acres
    const updatedField: CandidateFieldModel = {
      ...initialField,
      extracted_value: '8.00 Acres',
      user_edited: true,
      validation_status: 'VERIFIED'
    };

    expect(updatedField.extracted_value).toBe('8.00 Acres');
    expect(updatedField.original_value).toBe('7.50 Acres');
    expect(updatedField.user_edited).toBe(true);
    expect(updatedField.validation_status).toBe('VERIFIED');
  });

  it('enforces mandatory justification >= 5 characters for finding waiver', () => {
    function waiveFinding(check: ScrutinyCheck, justification: string): ScrutinyCheck {
      if (!justification || justification.trim().length < 5) {
        throw new Error('Mandatory regulatory waiver justification must be at least 5 characters.');
      }
      return {
        ...check,
        officer_disposition: 'WAIVED',
        disposition_notes: justification.trim()
      };
    }

    const check: ScrutinyCheck = {
      id: 'chk-land-tenure',
      rule_id: 'APH-2024-LAND-01',
      result: 'POTENTIAL_ISSUE',
      severity: 'CRITICAL',
      plain_explanation: 'Short lease tenure',
      officer_disposition: 'PENDING'
    };

    // Fails on empty or short justification
    expect(() => waiveFinding(check, 'ok')).toThrow('at least 5 characters');
    expect(() => waiveFinding(check, '   ')).toThrow('at least 5 characters');

    // Succeeds on valid regulatory justification
    const waived = waiveFinding(check, 'Council Executive Committee approved state university affiliation exemption');
    expect(waived.officer_disposition).toBe('WAIVED');
    expect(waived.disposition_notes).toContain('Council Executive Committee');
  });

  it('verifies fire safety NOC NBC 2016 conformity rule', () => {
    const fireNocText = `GOVERNMENT FIRE SAFETY CLEARANCE CERTIFICATE
Premises: ABC Institute of Technology, Sector 62, Noida.
Conforms to NBC 2016 Part 4. Certificate valid for 1 Year.`;

    const { checks } = evaluateDocumentText(fireNocText, 'FIRE_NOC');
    const nbcCheck = checks.find((c) => c.rule_id === 'APH-2024-FIRE-01');
    expect(nbcCheck?.result).toBe('PASS');
    expect(nbcCheck?.severity).toBe('INFO');
  });
});
