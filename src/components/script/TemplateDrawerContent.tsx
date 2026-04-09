import { Check } from 'lucide-react';
import { getAllTemplates } from '../../lib/script-templates';

export function TemplateDrawerContent({
  selectedTemplate,
  onSelectTemplate,
}: {
  selectedTemplate: string;
  onSelectTemplate: (templateId: string) => void;
}) {
  const templates = getAllTemplates();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {templates.map((template) => {
        const selected = template.id === selectedTemplate;

        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelectTemplate(template.id)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 10,
              border: selected
                ? '1px solid var(--color-selection-blue)'
                : '1px solid var(--color-border-subtle)',
              background: selected
                ? 'color-mix(in srgb, var(--color-selection-blue) 12%, transparent)'
                : 'var(--color-panel-bg)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: selected ? 'var(--color-selection-blue)' : 'transparent',
              }}
            >
              <Check size={16} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {template.name}
                {!template.isBuiltin ? (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 10,
                      color: 'var(--color-brand-warm)',
                    }}
                  >
                    自定义
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {template.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
