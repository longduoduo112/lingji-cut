import { useEffect, useMemo, useState } from "react";
import { FolderOpen } from 'lucide-react';
import {
  buildExportRenderConfig,
  EXPORT_QUALITY_OPTIONS,
  EXPORT_RESOLUTION_OPTIONS,
  type ExportConfig,
  type ExportQuality,
  type ExportResolution,
} from "../lib/export-settings";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  ModalFooter,
  Select,
} from "../ui";
import styles from "./ExportSettingsModal.module.css";

interface ExportSettingsModalProps {
  visible: boolean;
  timelineWidth: number;
  timelineHeight: number;
  onClose: () => void;
  onConfirm: (payload: {
    outputPath: string;
    exportConfig: ExportConfig;
  }) => Promise<void> | void;
}

export function ExportSettingsModal({
  visible,
  timelineWidth,
  timelineHeight,
  onClose,
  onConfirm,
}: ExportSettingsModalProps) {
  const [resolution, setResolution] = useState<ExportResolution>("720p");
  const [quality, setQuality] = useState<ExportQuality>("balanced");
  const [outputPath, setOutputPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setResolution("720p");
    setQuality("balanced");
    setOutputPath("");
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
    <Dialog open={visible} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导出设置</DialogTitle>
          <DialogDescription>配置视频导出参数</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Card className={styles.pathCard}>
            <FolderOpen size={14} className={styles.pathIcon} />
            <div
              className={[styles.pathValue, outputPath ? styles.pathValueFilled : '']
                .filter(Boolean)
                .join(' ')}
            >
              {outputPath || '还未选择导出位置'}
            </div>
            <Button
              onClick={() => void handleSelectOutputPath()}
              variant="secondary"
              size="sm"
            >
              选择位置
            </Button>
          </Card>

          <div className={styles.grid}>
            <div className={styles.column}>
              <Field label="分辨率">
                <Select
                  value={resolution}
                  options={EXPORT_RESOLUTION_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  onChange={(event) => setResolution(event.target.value as ExportResolution)}
                />
              </Field>
            </div>

            <div className={styles.column}>
              <Field label="导出速度">
                <Select
                  value={quality}
                  options={EXPORT_QUALITY_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  onChange={(event) => setQuality(event.target.value as ExportQuality)}
                />
              </Field>
            </div>
          </div>

          <div className={styles.summary}>
            <Badge variant="secondary">
              {renderConfig.renderWidth} × {renderConfig.renderHeight}
            </Badge>
            <Badge variant="secondary">{renderConfig.videoBitrate}</Badge>
            <Badge variant="secondary">{renderConfig.audioBitrate}</Badge>
            <Badge variant="secondary">{renderConfig.x264Preset}</Badge>
          </div>
        </DialogBody>
        <DialogFooter>
          <ModalFooter
            onCancel={onClose}
            onConfirm={() => {
              void handleConfirm();
            }}
            confirmLabel={isSubmitting ? "准备中..." : "开始导出"}
            confirmDisabled={!outputPath || isSubmitting}
            confirmLoading={isSubmitting}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

