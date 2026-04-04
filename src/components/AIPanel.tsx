import { type CSSProperties, type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  createPersistedAIState,
  parsePersistedAIState,
  removeCardsInResult,
  setAllCardsEnabledInResult,
  selectCoverCandidate,
  toggleCardEnabledInResult,
  updateCardInResult,
} from '../lib/ai-persistence';
import { getAISettingsIssue } from '../lib/ai-settings';
import { useAIStore, loadAISettings, saveAISettings } from '../store/ai';
import { getProjectDir, useTimelineStore } from '../store/timeline';
import {
  buildAICardTimelineDraft,
  type AIAnalysisResult,
  type AISettings,
  type CoverCandidate,
} from '../types/ai';
import { AICardList, type AICardPlacement } from './AICardList';
import { AppIcon, type AppIconName } from './AppIcon';
import { AICoverPanel } from './AICoverPanel';
import { AISettingsModal } from './AISettingsModal';
import { LoadingSpinner } from './LoadingSpinner';
import { Badge, Button, Field, IconButton, Textarea } from '../ui/primitives';
import { ActionBar, PanelHeader, TabBar } from '../ui/patterns';
import styles from './AIPanel.module.css';

interface AIPanelProps {
  compact: boolean;
  railHeight?: number;
  inspectedCardId?: string | null;
  onClearInspector?: () => void;
  onOpenCardInspector?: (cardId: string) => void;
}

const TAB_META: Record<'cards' | 'cover', { label: string; shortLabel: string; icon: AppIconName }> = {
  cards: { label: '内容卡片', shortLabel: '卡片', icon: 'layout-template' },
  cover: { label: '封面', shortLabel: '封面', icon: 'image' },
};

interface HoverHintProps {
  label: string;
  children: ReactNode;
}

function HoverHint({ label, children }: HoverHintProps) {
  return (
    <span className={styles.hoverHint}>
      {children}
      <span role="tooltip" className={styles.hoverHintBubble}>{label}</span>
    </span>
  );
}

export function AIPanel({
  compact,
  railHeight,
  inspectedCardId = null,
  onClearInspector,
  onOpenCardInspector,
}: AIPanelProps) {
  const {
    srtEntries,
    timeline,
    addAICardsToTimeline,
    removeAICardOverlaysBySourceIds,
    setGlobalBackground,
  } = useTimelineStore();
  const {
    analysisResult,
    isAnalyzing,
    analysisError,
    coverCandidates,
    isGeneratingCovers,
    activeTab,
    setAnalysisResult,
    setAnalyzing,
    setAnalysisError,
    setCoverCandidates,
    selectCover,
    setGeneratingCovers,
    setActiveTab,
  } = useAIStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRegeneratingCoverPrompt, setIsRegeneratingCoverPrompt] = useState(false);
  const [globalPromptDraft, setGlobalPromptDraft] = useState('');
  const enabledCount = analysisResult?.cards.filter((card) => card.enabled).length ?? 0;
  const enabledCardIds =
    analysisResult?.cards.filter((card) => card.enabled).map((card) => card.id) ?? [];
  const selectedCount = enabledCardIds.length;
  const selectedCoverCandidate =
    coverCandidates.find((candidate) => candidate.selected) ?? coverCandidates[0] ?? null;
  const cardPlacements = (timeline.overlays ?? []).reduce<Record<string, AICardPlacement>>(
    (placements, overlay) => {
      if (overlay.overlayType !== 'ai-card') {
        return placements;
      }

      const sourceCardId = overlay.aiCardData?.sourceCardId;
      if (!sourceCardId || placements[sourceCardId]) {
        return placements;
      }

      const track = timeline.tracks?.find((item) => item.id === overlay.trackId);
      placements[sourceCardId] = {
        trackId: overlay.trackId,
        trackLabel: track?.label ?? overlay.trackId,
      };
      return placements;
    },
    {},
  );
  const panelPadding = compact ? 10 : 14;
  const panelGap = compact ? 8 : 10;
  const primaryButtonHeight = compact ? 34 : 38;

  useEffect(() => {
    setGlobalPromptDraft(analysisResult?.globalPrompt ?? '');
  }, [analysisResult?.globalPrompt]);

  const persistAIState = useCallback(
    async (result: AIAnalysisResult | null, candidates: CoverCandidate[]) => {
      const fallbackState = createPersistedAIState(result, candidates);
      const projectDir = getProjectDir();
      if (!projectDir) {
        return fallbackState;
      }

      const savedState = await window.electronAPI.saveAIAnalysis(
        projectDir,
        JSON.stringify(fallbackState, null, 2),
      );

      try {
        return parsePersistedAIState(JSON.parse(savedState)) ?? fallbackState;
      } catch {
        return fallbackState;
      }
    },
    [],
  );

  const handleToggleEnabled = useCallback(
    (cardId: string) => {
      const nextResult = toggleCardEnabledInResult(analysisResult, cardId);
      if (!nextResult) {
        return;
      }

      setAnalysisResult(nextResult);
      void persistAIState(nextResult, coverCandidates).then((persistedState) => {
        if (persistedState.analysisResult) {
          setAnalysisResult(persistedState.analysisResult);
        }
        setCoverCandidates(persistedState.coverCandidates);
      });
    },
    [analysisResult, coverCandidates, persistAIState, setAnalysisResult, setCoverCandidates],
  );

  const handleSelectCover = useCallback(
    (candidateId: string) => {
      const nextCandidates = selectCoverCandidate(coverCandidates, candidateId);
      selectCover(candidateId);
      void persistAIState(analysisResult, nextCandidates).then((persistedState) => {
        if (persistedState.analysisResult) {
          setAnalysisResult(persistedState.analysisResult);
        }
        setCoverCandidates(persistedState.coverCandidates);
      });
    },
    [analysisResult, coverCandidates, persistAIState, selectCover, setAnalysisResult, setCoverCandidates],
  );

  const handlePersistedCovers = useCallback(
    async (candidates: CoverCandidate[]) => {
      const persistedState = await persistAIState(analysisResult, candidates);
      if (persistedState.analysisResult) {
        setAnalysisResult(persistedState.analysisResult);
      }
      setCoverCandidates(persistedState.coverCandidates);
    },
    [analysisResult, persistAIState, setAnalysisResult, setCoverCandidates],
  );

  const handleAddCoverToTimeline = useCallback(
    (candidateId: string) => {
      const candidate = coverCandidates.find((item) => item.id === candidateId);
      if (!candidate?.imageUrl) {
        return;
      }

      setGlobalBackground(candidate.imageUrl);
    },
    [coverCandidates, setGlobalBackground],
  );

  const handleAnalyze = useCallback(async () => {
    const settings = loadAISettings();
    const settingsIssue = getAISettingsIssue(settings);
    if (settingsIssue) {
      setAnalysisError(settingsIssue);
      setIsSettingsOpen(true);
      return;
    }

    if (!timeline.podcast.srtPath) {
      setAnalysisError('请先导入 SRT 字幕文件');
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    console.info('[ai-analysis] 开始分析字幕', {
      entryCount: srtEntries.length,
      projectDir: getProjectDir(),
      model: settings.llmModel,
    });

    try {
      const result = (await window.electronAPI.analyzeSrt({
        entries: srtEntries,
        settings,
        globalPrompt: globalPromptDraft.trim() || undefined,
      })) as AIAnalysisResult;
      const nextCandidates: CoverCandidate[] = [];
      const persistedState = await persistAIState(result, nextCandidates);
      setAnalysisResult(persistedState.analysisResult ?? result);
      setCoverCandidates(persistedState.coverCandidates);
    } catch (error) {
      console.error('[ai-analysis] 分析失败', error);
      setAnalysisError(error instanceof Error ? error.message : '分析失败');
    } finally {
      setAnalyzing(false);
    }
  }, [
    persistAIState,
    setAnalysisError,
    setAnalysisResult,
    setAnalyzing,
    setCoverCandidates,
    srtEntries,
    globalPromptDraft,
    timeline.podcast.srtPath,
  ]);

  const handleApplyToTimeline = useCallback(() => {
    if (!analysisResult) {
      return;
    }

    addAICardsToTimeline(
      analysisResult.cards
        .filter((card) => card.enabled)
        .map(buildAICardTimelineDraft),
    );
  }, [addAICardsToTimeline, analysisResult]);

  const handleGenerateCovers = useCallback(
    async (prompts: string[]) => {
      const settings = loadAISettings();
      if (!settings?.jimengSessionId) {
        setAnalysisError('请先在 AI 配置中填写即梦 Session ID');
        setIsSettingsOpen(true);
        return;
      }

      const projectDir = getProjectDir();
      if (!projectDir) {
        return;
      }

      setGeneratingCovers(true);
      try {
        const candidates = await window.electronAPI.generateCoverImages({
          prompts,
          settings,
          projectDir,
        });
        await handlePersistedCovers(candidates);
      } catch (error) {
        console.error('封面生成失败:', error);
      } finally {
        setGeneratingCovers(false);
      }
    },
    [handlePersistedCovers, setGeneratingCovers],
  );

  const handleRegenerateCoverPrompt = useCallback(async () => {
    if (!analysisResult) {
      return;
    }

    const settings = loadAISettings();
    const settingsIssue = getAISettingsIssue(settings);
    if (settingsIssue) {
      setAnalysisError(settingsIssue);
      setIsSettingsOpen(true);
      return;
    }

    if (srtEntries.length === 0) {
      setAnalysisError('当前没有可用于生成封面提示词的字幕内容');
      return;
    }

    setIsRegeneratingCoverPrompt(true);
    setAnalysisError(null);

    try {
      const prompts = await window.electronAPI.regenerateCoverPrompt({
        entries: srtEntries,
        settings,
        globalPrompt: analysisResult.globalPrompt,
        currentPrompt: analysisResult.coverPrompts[0],
      });
      const nextResult = {
        ...analysisResult,
        coverPrompts: prompts,
      };
      setAnalysisResult(nextResult);
      const persistedState = await persistAIState(nextResult, []);
      setAnalysisResult(persistedState.analysisResult ?? nextResult);
      setCoverCandidates([]);
    } catch (error) {
      console.error('封面提示词重生成失败:', error);
      setAnalysisError(error instanceof Error ? error.message : '封面提示词重生成失败');
    } finally {
      setIsRegeneratingCoverPrompt(false);
    }
  }, [
    analysisResult,
    persistAIState,
    setAnalysisError,
    setAnalysisResult,
    setCoverCandidates,
    srtEntries,
  ]);

  const handleGlobalPromptBlur = useCallback(() => {
    const normalizedPrompt = globalPromptDraft.trim();
    const currentPrompt = analysisResult?.globalPrompt ?? '';
    if (normalizedPrompt === currentPrompt) {
      return;
    }

    if (!analysisResult) {
      return;
    }

    const nextResult = {
      ...analysisResult,
      globalPrompt: normalizedPrompt || undefined,
    };
    setAnalysisResult(nextResult);
    void persistAIState(nextResult, coverCandidates).then((persistedState) => {
      if (persistedState.analysisResult) {
        setAnalysisResult(persistedState.analysisResult);
      }
      setCoverCandidates(persistedState.coverCandidates);
    });
  }, [analysisResult, coverCandidates, globalPromptDraft, persistAIState, setAnalysisResult, setCoverCandidates]);
  const handleSelectAllCards = useCallback(() => {
    if (!analysisResult?.cards.length) {
      return;
    }

    const shouldEnableAll = analysisResult.cards.some((card) => !card.enabled);
    const nextResult = setAllCardsEnabledInResult(analysisResult, shouldEnableAll);
    if (!nextResult) {
      return;
    }

    setAnalysisResult(nextResult);
    void persistAIState(nextResult, coverCandidates).then((persistedState) => {
      if (persistedState.analysisResult) {
        setAnalysisResult(persistedState.analysisResult);
      }
      setCoverCandidates(persistedState.coverCandidates);
    });
  }, [analysisResult, coverCandidates, persistAIState, setAnalysisResult, setCoverCandidates]);
  const handleDeleteCards = useCallback(
    (cardIds: string[]) => {
      const nextResult = removeCardsInResult(analysisResult, cardIds);
      if (!nextResult) {
        return;
      }

      setAnalysisResult(nextResult);
      if (inspectedCardId && cardIds.includes(inspectedCardId)) {
        onClearInspector?.();
      }
      removeAICardOverlaysBySourceIds(cardIds);
      void persistAIState(nextResult, coverCandidates).then((persistedState) => {
        if (persistedState.analysisResult) {
          setAnalysisResult(persistedState.analysisResult);
        }
        setCoverCandidates(persistedState.coverCandidates);
      });
    },
    [
      analysisResult,
      coverCandidates,
      inspectedCardId,
      onClearInspector,
      persistAIState,
      removeAICardOverlaysBySourceIds,
      setAnalysisResult,
      setCoverCandidates,
    ],
  );
  const panelSettings = loadAISettings();
  const aiSettingsIssue = getAISettingsIssue(panelSettings);
  const hasSrtEntries = srtEntries.length > 0;
  const analyzeButtonDisabled = !hasSrtEntries || isAnalyzing;
  const hasGeneratedCards = (analysisResult?.cards.length ?? 0) > 0;
  const isCardListEmpty = Boolean(analysisResult && !hasGeneratedCards);
  const showCardGenerationState = !analysisResult || !hasGeneratedCards;
  const allCardsSelected = hasGeneratedCards && enabledCount === (analysisResult?.cards.length ?? 0);
  const analysisHeadline = analysisResult ? '正在重新分析内容卡片' : '正在拆解字幕与生成卡片';
  const analysisDescription = analysisResult
    ? '正在根据最新字幕和提示词重新组织结构，完成后会自动刷新当前卡片列表。'
    : '正在解析字幕、提炼重点并生成可编辑卡片，这通常需要几十秒。';
  const analysisOverlayTitle = analysisResult
    ? 'AI 正在重新生成当前内容卡片'
    : 'AI 正在生成首批内容卡片';
  const analysisOverlayText = analysisResult
    ? '当前卡片区会暂时锁定，分析完成后将自动替换成新的卡片结果。'
    : '请稍候，AI 会先解析字幕，再提炼重点并生成可编辑卡片。';
  const generationStateBadgeLabel = isAnalyzing
    ? 'AI 正在工作'
    : isCardListEmpty
    ? '卡片已清空'
    : '准备生成内容卡片';
  const generationStateText = isAnalyzing
    ? `已载入 ${srtEntries.length} 条字幕，正在为你拆解结构与重点`
    : srtEntries.length === 0
    ? '请先导入 SRT 字幕文件'
    : isCardListEmpty
    ? `内容卡片已全部删除，当前仍有 ${srtEntries.length} 条字幕可重新分析生成`
    : `已加载 ${srtEntries.length} 条字幕，点击分析`;
  const analyzeButtonLabel = isAnalyzing
    ? '分析中...'
    : aiSettingsIssue
    ? '先配置 AI'
    : isCardListEmpty
    ? '重新生成卡片'
    : '分析内容';
  const panelVars = createPanelVars({
    panelPadding,
    panelGap,
    primaryButtonHeight,
    headerIconSize: compact ? 20 : 22,
  });

  return (
    <aside className={styles.root} style={panelVars}>
      <PanelHeader
        title="AI 助手"
        leading={
          <HoverHint label="AI 分析与生成助手">
            <span
              className={styles.headerIcon}
              title="AI 分析与生成助手"
              aria-label="AI 分析与生成助手"
            >
              <AppIcon name="sparkles" size={14} />
            </span>
          </HoverHint>
        }
        meta={
          hasGeneratedCards && !compact ? (
            <Badge variant="brand">已选 {enabledCount}/{analysisResult.cards.length}</Badge>
          ) : null
        }
        actions={
          <>
            {analysisResult ? (
              <HoverHint label={isAnalyzing ? 'AI 正在重新分析内容卡片' : '根据当前字幕和提示词重新生成内容卡片'}>
                <IconButton
                  onClick={() => void handleAnalyze()}
                  disabled={isAnalyzing}
                  variant="subtle"
                  size={compact ? 'sm' : 'md'}
                  title={isAnalyzing ? '分析中' : '重新分析'}
                  aria-label={isAnalyzing ? '分析中' : '重新分析'}
                >
                  {isAnalyzing ? <LoadingSpinner size={14} color="#c7d2fe" /> : <AppIcon name="refresh-cw" size={14} />}
                </IconButton>
              </HoverHint>
            ) : null}
            <HoverHint label="打开 AI 全局设置">
              <IconButton
                onClick={() => setIsSettingsOpen(true)}
                variant="subtle"
                size={compact ? 'sm' : 'md'}
                title="打开 AI 全局设置"
                aria-label="打开 AI 全局设置"
              >
                <AppIcon name="settings-2" size={14} />
              </IconButton>
            </HoverHint>
          </>
        }
      />

      <TabBar
        items={(['cards', 'cover'] as const).map((tab) => ({
          value: tab,
          label: (
            <span className={styles.tabContent}>
              <AppIcon name={TAB_META[tab].icon} size={14} />
              {compact ? TAB_META[tab].shortLabel : TAB_META[tab].label}
            </span>
          ),
        }))}
        value={activeTab}
        onChange={setActiveTab}
      />

      <div className={styles.body}>
        {activeTab === 'cards' ? (
          <>
            <div
              className={joinClassNames(
                styles.promptSection,
                isAnalyzing ? styles.promptSectionBusy : '',
              )}
            >
              <Field label="整体创作提示词">
                <Textarea
                  value={globalPromptDraft}
                  onChange={(event) => setGlobalPromptDraft(event.target.value)}
                  onBlur={handleGlobalPromptBlur}
                  placeholder="例如：整体做成财经研报感，少字强结论，版式更像商业媒体封面"
                  rows={3}
                  className={styles.promptTextarea}
                />
              </Field>
            </div>

            {showCardGenerationState ? (
              <div
                className={joinClassNames(
                  styles.emptyState,
                  isAnalyzing ? styles.emptyStateBusy : '',
                )}
                aria-busy={isAnalyzing}
              >
                <Badge variant="brand">
                  {isAnalyzing ? <LoadingSpinner size={14} color="#c7d2fe" /> : <AppIcon name="sparkles" size={14} />}
                  {generationStateBadgeLabel}
                </Badge>
                <div className={styles.emptyStateText}>{generationStateText}</div>
                {aiSettingsIssue ? <div className={styles.hintText}>{aiSettingsIssue}</div> : null}
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzeButtonDisabled}
                  variant="primary"
                  size="md"
                >
                  <span className={styles.primaryActionContent}>
                    {isAnalyzing ? (
                      <LoadingSpinner size={14} color="#ffffff" />
                    ) : (
                      <AppIcon name={aiSettingsIssue ? 'settings-2' : 'sparkles'} size={14} />
                    )}
                    {analyzeButtonLabel}
                  </span>
                </Button>

                {isAnalyzing ? (
                  <div className={styles.analysisNotice} role="status" aria-live="polite">
                    <div className={styles.analysisNoticeHeader}>
                      <LoadingSpinner size={16} color="#818cf8" />
                      <span className={styles.analysisNoticeTitle}>{analysisHeadline}</span>
                    </div>
                    <div className={styles.analysisNoticeText}>{analysisDescription}</div>
                    <div className={styles.analysisStepRow}>
                      {['解析字幕', '提炼重点', '生成卡片'].map((label) => (
                        <span key={label} className={styles.analysisStepChip}>
                          <LoadingSpinner size={12} color="#94a3b8" />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {analysisResult && hasGeneratedCards && isAnalyzing ? (
              <div className={styles.analysisBanner} role="status" aria-live="polite">
                <div className={styles.analysisBannerHeader}>
                  <span className={styles.analysisBannerBadge}>
                    <LoadingSpinner size={12} color="#ffffff" />
                    分析中
                  </span>
                  <span className={styles.analysisBannerTitle}>{analysisHeadline}</span>
                </div>
                <div className={styles.analysisBannerText}>{analysisDescription}</div>
              </div>
            ) : null}
            {analysisError ? <div className={styles.error}>{analysisError}</div> : null}
            {hasGeneratedCards ? (
              <div className={styles.analysisWorkspace}>
                <div
                  className={joinClassNames(
                    styles.workspaceContent,
                    isAnalyzing ? styles.workspaceContentDimmed : '',
                  )}
                >
                  <ActionBar
                    start={
                      <Button onClick={handleSelectAllCards} variant="secondary" size="sm">
                        {allCardsSelected ? '取消全选' : '全选'}
                      </Button>
                    }
                    center={
                      <div className={styles.selectionSummary}>
                        已选 {selectedCount}/{analysisResult?.cards.length ?? 0}
                      </div>
                    }
                    end={
                      <Button
                        onClick={() => handleDeleteCards(enabledCardIds)}
                        disabled={selectedCount === 0 || isAnalyzing}
                        variant="danger"
                        size="sm"
                      >
                        删除已选
                      </Button>
                    }
                  />
                  <AICardList
                    cards={analysisResult?.cards ?? []}
                    placements={cardPlacements}
                    onToggleEnabled={handleToggleEnabled}
                    onDeleteCard={(cardId) => handleDeleteCards([cardId])}
                    onEditCard={(cardId) => onOpenCardInspector?.(cardId)}
                  />
                </div>
                {isAnalyzing ? (
                  <div className={styles.analysisOverlay} role="status" aria-live="polite">
                    <div className={styles.analysisOverlayCard}>
                      <span className={styles.analysisBannerBadge}>
                        <LoadingSpinner size={12} color="#ffffff" />
                        重新分析中
                      </span>
                      <div className={styles.analysisOverlayTitle}>{analysisOverlayTitle}</div>
                      <div className={styles.analysisOverlayText}>{analysisOverlayText}</div>
                      <div className={styles.analysisStepRow}>
                        {['解析字幕', '提炼重点', '生成卡片'].map((label) => (
                          <span key={label} className={styles.analysisStepChip}>
                            <LoadingSpinner size={12} color="#94a3b8" />
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <AICoverPanel
            coverPrompts={analysisResult?.coverPrompts ?? []}
            candidates={coverCandidates}
            isGenerating={isGeneratingCovers}
            isRegeneratingPrompt={isRegeneratingCoverPrompt}
            selectedCandidateId={selectedCoverCandidate?.id}
            onGenerateCovers={handleGenerateCovers}
            onRegeneratePrompt={handleRegenerateCoverPrompt}
            onSelectCover={handleSelectCover}
            onAddToTimeline={handleAddCoverToTimeline}
          />
        )}
      </div>

      {activeTab === 'cards' && hasGeneratedCards ? (
        <div className={styles.footer}>
          <Button
            onClick={handleApplyToTimeline}
            disabled={enabledCount === 0 || isAnalyzing}
            variant="primary"
            size={compact ? 'sm' : 'md'}
            fullWidth
            className={styles.footerButton}
          >
            <span className={styles.primaryActionContent}>
              {isAnalyzing ? <LoadingSpinner size={14} color="#ffffff" /> : <AppIcon name="send-horizontal" size={14} />}
              {isAnalyzing ? '分析中...' : '应用到时间线'}
              <span className={styles.countBadge}>{enabledCount}</span>
            </span>
          </Button>
        </div>
      ) : null}

      <AISettingsModal
        visible={isSettingsOpen}
        settings={panelSettings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(settings: AISettings) => saveAISettings(settings)}
      />
    </aside>
  );
}

function createPanelVars(options: {
  panelPadding: number;
  panelGap: number;
  primaryButtonHeight: number;
  headerIconSize: number;
}): CSSProperties {
  return {
    ['--ai-panel-padding' as string]: `${options.panelPadding}px`,
    ['--ai-panel-gap' as string]: `${options.panelGap}px`,
    ['--ai-footer-button-height' as string]: `${options.primaryButtonHeight}px`,
    ['--ai-header-icon-size' as string]: `${options.headerIconSize}px`,
  };
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}
