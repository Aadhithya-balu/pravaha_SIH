import React, { useState, useEffect } from 'react';
import {
  Search,
  BookOpen,
  Clock,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Filter,
  X
} from 'lucide-react';
import { fetchRegulatoryCategories } from '../api';

interface RegulatoryCategoryItem {
  id: number;
  category_code: string;
  title: string;
  institution_type: string;
  description: string;
  required_documents: Array<{
    type: string;
    name: string;
    rule: string;
    mandatory?: boolean;
  }>;
  workflow_sequence: string[];
  sla_days: number;
}

interface RegulatoryCategoriesSearchProps {
  onSelectCategory?: (category: RegulatoryCategoryItem) => void;
  currentUserRole?: string;
}

export const RegulatoryCategoriesSearch: React.FC<RegulatoryCategoriesSearchProps> = ({
  onSelectCategory,
  currentUserRole
}) => {
  const [categories, setCategories] = useState<RegulatoryCategoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCatId, setExpandedCatId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadCategories() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchRegulatoryCategories(search, selectedType);
        if (isMounted) {
          setCategories(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load regulatory options from server.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(() => {
      loadCategories();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [search, selectedType]);

  const filterChips = [
    { id: 'ALL', label: 'All Categories' },
    { id: 'Engineering', label: 'Engineering & Tech' },
    { id: 'Management', label: 'Management' },
    { id: 'Pharmacy', label: 'Pharmacy' },
    { id: 'Technical', label: 'Polytechnic / Diploma' }
  ];

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        padding: '20px 22px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}
    >
      {/* Header & Description */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <BookOpen size={16} />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
              AICTE Regulatory Approval Categories & Document Checklists
            </h3>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: 12.5, color: '#64748B' }}>
            Search configured statutory approval processes under AICTE Approval Process Handbook (APH 2024-2027).
          </p>
        </div>
      </div>

      {/* Prominent Search Bar & Category Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            color="#2563EB"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by category name, keyword, or code (e.g. Extension of Approval, New Programme, EoA)..."
            style={{
              width: '100%',
              padding: '9px 36px 9px 38px',
              borderRadius: 8,
              border: '1.5px solid #CBD5E1',
              fontSize: 13.5,
              color: '#0F172A',
              background: '#F8FAFC',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer'
              }}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B' }}>Filter by Discipline:</span>
          {filterChips.map((chip) => {
            const isSelected = selectedType === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedType(chip.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid #2563EB' : '1px solid #E2E8F0',
                  background: isSelected ? '#EFF6FF' : '#FFFFFF',
                  color: isSelected ? '#1E40AF' : '#64748B',
                  transition: 'all 0.15s ease'
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
          <div className="spin" style={{ display: 'inline-block', marginBottom: 6 }}>
            ⟳
          </div>
          <div>Loading configured regulatory categories from database...</div>
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FEE2E2',
            borderRadius: 6,
            padding: '10px 14px',
            fontSize: 12.5,
            color: '#B91C1C'
          }}
        >
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && categories.length === 0 && (
        <div
          style={{
            padding: '30px 16px',
            textAlign: 'center',
            background: '#F8FAFC',
            borderRadius: 8,
            border: '1px dashed #CBD5E1'
          }}
        >
          <Search size={26} color="#94A3B8" style={{ margin: '0 auto 8px auto', display: 'block' }} />
          <b style={{ fontSize: 13.5, color: '#334155', display: 'block' }}>
            No regulatory options matched "{search}"
          </b>
          <span style={{ fontSize: 12, color: '#64748B' }}>
            Try searching for "EoA", "New Programme", "Intake", or select "All Categories".
          </span>
        </div>
      )}

      {/* Results Grid */}
      {!loading && !error && categories.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {categories.map((cat) => {
            const isExpanded = expandedCatId === cat.id;
            return (
              <div
                key={cat.id}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  padding: '16px',
                  background: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  transition: 'border-color 0.15s ease'
                }}
              >
                <div>
                  {/* Category Top Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span
                      style={{
                        background: '#EFF6FF',
                        color: '#1D4ED8',
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        letterSpacing: '0.04em'
                      }}
                    >
                      {cat.category_code}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        color: '#475569',
                        background: '#F1F5F9',
                        padding: '2px 7px',
                        borderRadius: 4
                      }}
                    >
                      <Clock size={11} color="#64748B" />
                      <span>{cat.sla_days} Days SLA</span>
                    </span>
                  </div>

                  <b style={{ fontSize: 14, color: '#0F172A', display: 'block', marginBottom: 4, lineHeight: 1.3 }}>
                    {cat.title}
                  </b>

                  <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 8 }}>
                    Applicable to: {cat.institution_type}
                  </span>

                  <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#334155', lineHeight: 1.45 }}>
                    {cat.description}
                  </p>

                  {/* Document Checklist Preview (Collapsible) */}
                  <div style={{ marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#2563EB',
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: 0,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <span>
                        {cat.required_documents?.length || 0} Required Statutory Documents
                      </span>
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {isExpanded && cat.required_documents && (
                      <div
                        style={{
                          marginTop: 8,
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: 6,
                          padding: '8px 10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}
                      >
                        {cat.required_documents.map((doc, dIdx) => (
                          <div
                            key={dIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 6,
                              fontSize: 11,
                              color: '#334155'
                            }}
                          >
                            <FileCheck2 size={12} color="#16845B" style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>
                              <b>{doc.name}</b>
                              <span style={{ display: 'block', color: '#64748B', fontSize: 10 }}>
                                {doc.rule}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Action Button */}
                {onSelectCategory && (
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat)}
                    style={{
                      width: '100%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: '#163A63',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <span>Apply for this Category</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
