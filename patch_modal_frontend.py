path = r'frontend/src/components/ApplicationDetailModal.tsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Patch the checklist section
start_target = "                  {/* Statutory Requirements Checklist Table */}\n                  {scrutinyRuns.length > 0 && ((typeof scrutinyRuns[0].rule_results === 'string' ? JSON.parse(scrutinyRuns[0].rule_results || '{}') : scrutinyRuns[0].rule_results)?.requirements_checklist) && scrutinyRuns[0].rule_results.requirements_checklist.length > 0 && ("
end_target = "                  {/* Findings List */}"

idx_start = text.find("{/* Statutory Requirements Checklist Table */}")
idx_end = text.find("{/* Findings List */}")

assert idx_start != -1 and idx_end != -1, "Could not find checklist block in ApplicationDetailModal.tsx"

replacement_checklist = """{/* Statutory Requirements Checklist Table */}
                  {(() => {
                    const results = scrutinyRuns.length > 0
                      ? (typeof scrutinyRuns[0].rule_results === 'string'
                          ? (() => { try { return JSON.parse(scrutinyRuns[0].rule_results || '{}'); } catch { return {}; } })()
                          : scrutinyRuns[0].rule_results)
                      : null;
                    const checklist = results?.requirements_checklist;
                    if (!checklist || checklist.length === 0) return null;

                    return (
                      <div style={{ marginBottom: 14 }}>
                        <h4 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                          Statutory Document & Rule Verification Checklist (APH 2024-2027)
                        </h4>
                        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <thead style={{ background: '#F8FAFC', color: '#475569', textAlign: 'left', fontWeight: 600 }}>
                              <tr>
                                <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>Requirement</th>
                                <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>Status</th>
                                <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>Matched Document</th>
                                <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>Assessment Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {checklist.map((item: any, idx: number) => {
                                const isSatisfied = item.status === 'SATISFIED' || item.status === 'PASS';
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', background: isSatisfied ? '#FFFFFF' : '#FEF2F2' }}>
                                    <td style={{ padding: '8px 10px' }}>
                                      <span style={{ fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>{item.name}</span>
                                      <code style={{ fontSize: 9.5, color: '#64748B' }}>{item.rule_id}</code>
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                      <span
                                        style={{
                                          fontSize: 9.5,
                                          fontWeight: 800,
                                          padding: '2px 6px',
                                          borderRadius: 4,
                                          background: isSatisfied ? '#DCFCE7' : '#FEE2E2',
                                          color: isSatisfied ? '#166534' : '#991B1B'
                                        }}
                                      >
                                        {item.status}
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                                      {item.document_type || item.evidence_document || '—'}
                                    </td>
                                    <td style={{ padding: '8px 10px', color: '#475569' }}>
                                      {item.remarks || item.notes || '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  """

text = text[:idx_start] + replacement_checklist + text[idx_end:]

# 2. Add EVC scheduling button when !evcVisit
old_no_evc = """                  {!evcVisit ? (
                    <div style={{ padding: '36px', textAlign: 'center', background: '#F8FAFC', borderRadius: 'var(--radius-md)' }}>
                      <Building2 size={32} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                      <b style={{ fontSize: 13, display: 'block', color: 'var(--text-primary)' }}>No EVC Inspection Scheduled</b>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        EVC inspection is initiated when an application progresses to the EVC_PENDING stage.
                      </span>
                    </div>"""

new_no_evc = """                  {!evcVisit ? (
                    <div style={{ padding: '36px', textAlign: 'center', background: '#F8FAFC', borderRadius: 'var(--radius-md)' }}>
                      <Building2 size={32} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                      <b style={{ fontSize: 13, display: 'block', color: 'var(--text-primary)' }}>No EVC Inspection Scheduled</b>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 14 }}>
                        EVC inspection is initiated when an application progresses to the EVC_PENDING stage.
                      </span>
                      {isOfficerOrAdmin && (details.current_stage === 'EVC_PENDING' || details.current_stage === 'SCRUTINY' || details.current_stage === 'RE_SCRUTINY') && (
                        <button
                          className="btn-primary"
                          style={{ margin: '0 auto', fontSize: 11, padding: '7px 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          disabled={isActionLoading}
                          onClick={() => handleTransition('SCHEDULE_EVC', 'EVC Inspection Committee Constituted')}
                        >
                          <Calendar size={13} />
                          <span>Schedule EVC Inspection Panel</span>
                        </button>
                      )}
                    </div>"""

assert old_no_evc.replace('\r\n', '\n') in text.replace('\r\n', '\n'), "Could not find old_no_evc"

# apply replace with proper newline matching
if old_no_evc in text:
    text = text.replace(old_no_evc, new_no_evc)
else:
    text = text.replace(old_no_evc.replace('\r\n', '\n'), new_no_evc.replace('\r\n', '\n'))

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated ApplicationDetailModal.tsx successfully!")

