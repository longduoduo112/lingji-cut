import { useEffect, useMemo, useState } from 'react';
import {
  buildExportRenderConfig,
  EXPORT_QUALITY_OPTIONS,
  EXPORT_RESOLUTION_OPTIONS,
  type ExportConfig,
  type ExportQuality,
  type ExportResolution,
} from '../lib/export-settings';

interface ExportSettingsModalProps {
  visible: boolean;
  timelineWidth: number;
  timelineHeight: number;
  onClose: () => void;
  onConfirm: (payload: { outputPath: string; exportConfig: ExportConfig }) => Promise<void> | void;
}

export function ExportSettingsModal({
  visible,
  timelineWidth,
  timelineHeight,
  onClose,
  onConfirm,
}: ExportSettingsModalProps) {
  const [resolution, setResolution] = useState<ExportResolution>('720p');
  const [quality, setQuality] = useState<ExportQuality>('balanced');
  const [outputPath, setOutputPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setResolution('720p');
    setQuality('balanced');
    setOutputPath('');
    setIsSubmitting(false);
  }, [visible]);

  const renderConfig = useMemo(
    () =>
      buildExportRenderConfig({
        timelineWidth,
        timelineHeight,
        resolution,
        quality,
      }),
    [quality, resolution, timelineHeight, timelineWidth],
  );

  if (!visible) {
    return null;
  }

  const handleSelectOutputPath = async () => {
    const savePath = await window.electronAPI.selectOutputPath();
    if (!savePath) {
      return;
    }

    setOutputPath(savePath);
  };

  const handleConfirm = async () => {
    if (!outputPath || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onConfirm({
        outputPath,
        exportConfig: {
          resolution,
          quality,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.68)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 110,
        padding: 20,
      }}
    >
      <div
        style={{
          width: 640,
          maxWidth: '100%',
          borderRadius: 26,
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#0b1220',
          padding: 28,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: '0.16em', color: '#91a2bc' }}>EXPORT</div>
        <h3 style={{ margin: '10px 0 8px', fontSize: 28 }}>导出设置</h3>
        <p style={{ margin: 0, color: '#8da0bb', fontSize: 14, lineHeight: 1.7 }}>
          首轮导出建议先选择较低分辨率和更快档位，快速检查节奏、字幕和画面排布。
        </p>

        <div
          style={{
            marginTop: 22,
            padding: 16,
            borderRadius: 18,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: '0.12em', color: '#91a2bc' }}>输出路径</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <div
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: outputPath ? '#f5f7fb' : '#70839f',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {outputPath || '还未选择导出位置'}
            </div>
            <button
              onClick={handleSelectOutputPath}
              style={secondaryButtonStyle}
            >
              选择位置
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
          <div>
            <div style={sectionTitleStyle}>分辨率</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {EXPORT_RESOLUTION_OPTIONS.map((option) => {
                const dimensions = buildExportRenderConfig({
                  timelineWidth,
                  timelineHeight,
                  resolution: option.value,
                  quality,
                });
                const isActive = resolution === option.value;

                return (
                  <button
                    key={option.value}
                    onClick={() => setResolution(option.value)}
                    style={{
                      ...optionButtonStyle,
                      borderColor: isActive ? 'rgba(123,213,255,0.4)' : 'rgba(255,255,255,0.08)',
                      background: isActive ? 'rgba(123,213,255,0.12)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ color: '#f5f7fb', fontWeight: 700 }}>{option.label}</span>
                      <span style={{ color: '#7bd5ff', fontSize: 12 }}>
                        {dimensions.renderWidth} × {dimensions.renderHeight}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, color: '#8da0bb', fontSize: 12, lineHeight: 1.6 }}>
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={sectionTitleStyle}>导出速度</div>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              {EXPORT_QUALITY_OPTIONS.map((option) => {
                const isActive = quality === option.value;

                return (
                  <button
                    key={option.value}
                    onClick={() => setQuality(option.value)}
                    style={{
                      ...optionButtonStyle,
                      borderColor: isActive ? 'rgba(255,181,71,0.4)' : 'rgba(255,255,255,0.08)',
                      background: isActive ? 'rgba(255,181,71,0.1)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ color: '#f5f7fb', fontWeight: 700 }}>{option.label}</span>
                      <span style={{ color: '#ffb547', fontSize: 12 }}>
                        {buildExportRenderConfig({
                          timelineWidth,
                          timelineHeight,
                          resolution,
                          quality: option.value,
                        }).videoBitrate}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, color: '#8da0bb', fontSize: 12, lineHeight: 1.6 }}>
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 18,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div style={sectionTitleStyle}>本次导出摘要</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            <Tag>{renderConfig.renderWidth} × {renderConfig.renderHeight}</Tag>
            <Tag>{renderConfig.videoBitrate}</Tag>
            <Tag>{renderConfig.audioBitrate}</Tag>
            <Tag>{renderConfig.x264Preset}</Tag>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button onClick={onClose} style={secondaryButtonStyle}>
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!outputPath || isSubmitting}
            style={{
              ...primaryButtonStyle,
              opacity: !outputPath || isSubmitting ? 0.55 : 1,
              cursor: !outputPath || isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? '准备中...' : '开始导出'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: '6px 10px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.06)',
        color: '#d9e2ef',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

const sectionTitleStyle = {
  fontSize: 12,
  letterSpacing: '0.12em',
  color: '#91a2bc',
} as const;

const optionButtonStyle = {
  width: '100%',
  textAlign: 'left' as const,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
  cursor: 'pointer',
} as const;

const secondaryButtonStyle = {
  height: 44,
  padding: '0 18px',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: '#f5f7fb',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

const primaryButtonStyle = {
  height: 44,
  padding: '0 20px',
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(90deg, #ffb547 0%, #ff8f5f 100%)',
  color: '#241200',
  fontSize: 14,
  fontWeight: 800,
} as const;
