// src/pages/ScriptWorkbench.tsx
import { useCallback } from 'react';
import { useScriptStore } from '../store/script';
import { StepIndicator } from '../components/script/StepIndicator';
import { StepInitialize } from '../components/script/StepInitialize';
import { StepReviewOriginal } from '../components/script/StepReviewOriginal';
import { StepGenerate } from '../components/script/StepGenerate';
import { StepAIReview } from '../components/script/StepAIReview';
import { StepConfirm } from '../components/script/StepConfirm';
import { MdEditor } from '../ui/components/md-editor';
import { debouncedSaveFile } from '../lib/script-persistence';
import styles from './ScriptWorkbench.module.css';

interface ScriptWorkbenchProps {
  onBack: () => void;
}

export function ScriptWorkbench({ onBack }: ScriptWorkbenchProps) {
  const {
    currentStep,
    originalText,
    scriptText,
    projectDir,
    setOriginalText,
    setScriptText,
  } = useScriptStore();

  const isEditingOriginal = currentStep <= 2;
  const editorValue = isEditingOriginal ? originalText : scriptText;

  const handleEditorChange = useCallback(
    (value: string) => {
      if (isEditingOriginal) {
        setOriginalText(value);
        if (projectDir) debouncedSaveFile(projectDir, 'original.md', value);
      } else {
        setScriptText(value);
        if (projectDir) debouncedSaveFile(projectDir, 'script.md', value);
      }
    },
    [isEditingOriginal, projectDir, setOriginalText, setScriptText],
  );

  const renderSidePanel = () => {
    switch (currentStep) {
      case 1: return <StepInitialize />;
      case 2: return <StepReviewOriginal />;
      case 3: return <StepGenerate />;
      case 4: return <StepAIReview />;
      case 5: return <StepConfirm />;
    }
  };

  return (
    <div className={styles.page}>
      <StepIndicator currentStep={currentStep} />

      <div className={styles.mainContent}>
        <div className={styles.editorPanel}>
          <div className={styles.editorHeader}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#EBEBF599',
                cursor: 'pointer',
                fontSize: 13,
                padding: '4px 8px',
                borderRadius: 6,
              }}
            >
              ← 返回
            </button>
            <span className={styles.editorTitle}>
              {isEditingOriginal ? '原稿编辑器' : '口播稿编辑器'}
            </span>
            <div className={styles.editorSpacer} />
          </div>

          <div className={styles.editorContainer}>
            {currentStep === 1 && !originalText ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#EBEBF54D',
                  fontSize: 14,
                }}
              >
                在右侧面板上传报告文件并选择工作目录
              </div>
            ) : (
              <MdEditor
                value={editorValue}
                onChange={handleEditorChange}
                placeholder={isEditingOriginal ? '报告原文内容…' : '口播稿内容…'}
              />
            )}
          </div>
        </div>

        <div className={styles.panelDivider} />

        <div className={styles.sidePanel}>{renderSidePanel()}</div>
      </div>
    </div>
  );
}
