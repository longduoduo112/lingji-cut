import { useEffect, useRef, useState } from 'react';
import { Upload, Film, Image as ImageIcon, Tag, Check, X, Loader2, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { Button, Checkbox, Field, Input, Select } from '../../ui';
import {
  BILIBILI_PARTITIONS,
  findPartition,
} from '../../lib/publish/bilibili-partitions';
import { Spinner } from '../../ui/primitives/Spinner';
import { usePublishStore } from '../../store/publish';
import { loadAISettings, useAIStore } from '../../store/ai';
import { useTimelineStore } from '../../store/timeline';
import type { PublishAccount, PublishTarget } from '../../lib/electron-api';
import type { AIAnalysisResult } from '../../types/ai';
import {
  extractPublishSection,
  type ProjectData,
  type ProjectPublishMeta,
} from '../../lib/project-persistence';
import { PublishCoverPanel } from './PublishCoverPanel';

/** 拼接 AI 分析摘要 / 关键词 / 段落，兜底用字幕原文，作为发布文案生成素材。 */
function buildMetadataSource(analysis: AIAnalysisResult | null, srtText: string): string {
  const parts: string[] = [];
  if (analysis?.summary) parts.push(`节目总结：${analysis.summary}`);
  if (analysis?.keywords?.length) parts.push(`关键词：${analysis.keywords.join('、')}`);
  if (analysis?.segments?.length) {
    const segs = analysis.segments
      .slice(0, 16)
      .map((s, i) => `${i + 1}. ${s.title}${s.summary ? `：${s.summary}` : ''}`)
      .join('\n');
    parts.push(`段落概要：\n${segs}`);
  }
  if (parts.length === 0 && srtText.trim()) {
    parts.push(`字幕内容：${srtText.trim().slice(0, 3000)}`);
  }
  return parts.join('\n\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_LABEL: Record<string, string> = {
  douyin: '抖音',
  tencent: '视频号',
  xiaohongshu: '小红书',
  kuaishou: '快手',
  bilibili: 'B站',
};

function AccountStatusBadge({ status }: { status: PublishAccount['status'] }) {
  const config = {
    valid: { label: '已登录', color: 'var(--color-success, #22c55e)' },
    expired: { label: '已过期', color: 'var(--color-warning, #f59e0b)' },
    unknown: { label: '未知', color: 'var(--color-text-tertiary, #888)' },
  }[status];
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 6px',
        borderRadius: 4,
        background: `color-mix(in srgb, ${config.color} 15%, transparent)`,
        color: config.color,
        fontWeight: 500,
      }}
    >
      {config.label}
    </span>
  );
}

function ResultRow({
  accountId,
  state,
  percent,
  message,
}: {
  accountId: string;
  state: string;
  percent?: number;
  message?: string;
}) {
  const icon =
    state === 'success' ? (
      <Check size={14} style={{ color: 'var(--color-success, #22c55e)' }} />
    ) : state === 'failed' ? (
      <X size={14} style={{ color: 'var(--color-error, #ef4444)' }} />
    ) : state === 'running' ? (
      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-system-blue)' }} />
    ) : null;

  const pctStr = percent != null ? ` ${percent}%` : '';
  const barWidth = percent != null ? `${Math.max(0, Math.min(100, percent))}%` : '0%';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        fontSize: 13,
        borderBottom: '1px solid var(--color-border-subtle, rgba(0,0,0,0.06))',
      }}
    >
      <span style={{ minWidth: 16 }}>{icon}</span>
      <span style={{ flex: 1, color: 'var(--color-text-primary)' }}>
        {PLATFORM_LABEL[accountId.split('_')[0]] ?? accountId.split('_')[0]}{' '}
        <span style={{ color: 'var(--color-text-secondary)' }}>
          {accountId.split('_').slice(1).join('_')}
        </span>
      </span>
      {state === 'running' && percent != null && (
        <div
          style={{
            width: 80,
            height: 4,
            background: 'var(--color-border-subtle, rgba(0,0,0,0.1))',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: barWidth,
              height: '100%',
              background: 'var(--color-system-blue)',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}
      <span
        style={{
          fontSize: 12,
          color:
            state === 'success'
              ? 'var(--color-success, #22c55e)'
              : state === 'failed'
                ? 'var(--color-error, #ef4444)'
                : 'var(--color-text-secondary)',
          minWidth: 60,
          textAlign: 'right',
        }}
      >
        {state === 'success'
          ? '成功'
          : state === 'failed'
            ? message ?? '失败'
            : state === 'running'
              ? `上传中${pctStr}`
              : '等待中'}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PublishWorkbench({ projectDir }: { projectDir: string | null }) {
  const { accounts, job, results, loadAccounts, startPublish, cancelPublish } = usePublishStore();
  const lastExportPath = usePublishStore((s) => s.lastExportPath);

  // Form state
  const [filePath, setFilePath] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  // 多比例封面：每个比例各选一张（视频号 4:3+3:4，抖音 3:4+16:9）
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  // B站分区 ID（tid，全平台共享，仅 B站使用）— 经分区选择器写入，仍存为字符串
  const [bilibiliTid, setBilibiliTid] = useState('');
  // 级联选择器的主分区态（由 bilibiliTid 反查同步，picker 切换时维护）
  const [bilibiliParentId, setBilibiliParentId] = useState<number | null>(null);
  // AI 智能推荐分区
  const [isRecommendingPartition, setIsRecommendingPartition] = useState(false);
  const [partitionError, setPartitionError] = useState<string | null>(null);

  // AI 文案生成
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  // 封面联动面板展开
  const [showCoverPanel, setShowCoverPanel] = useState(true);

  // Multi-select: set of checked account IDs
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Derive publishing state from store job — no local state needed
  const isPublishing = !!job;

  // 文案持久化：hydrate 完成前禁止 autosave，避免用空值覆盖磁盘上的已存文案
  const hydratedRef = useRef(false);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  // ── 联动编辑器：预填视频文件与封面缩略图 ──
  // 同会话：编辑器导出后写入 store.lastExportPath；跨重启：扫描项目目录最新成片。
  useEffect(() => {
    if (lastExportPath) setFilePath((prev) => prev || lastExportPath);
  }, [lastExportPath]);

  useEffect(() => {
    if (!projectDir) return;
    let cancelled = false;
    void (async () => {
      // 视频文件兜底
      const last = usePublishStore.getState().lastExportPath;
      let resolved: string | null = last;
      if (!resolved) {
        resolved = await window.electronAPI.findLatestExport(projectDir).catch(() => null);
      }
      if (resolved && !cancelled) setFilePath((prev) => prev || resolved!);
      // 封面：默认取编辑器选定的封面候选
      const selectedCover = useAIStore
        .getState()
        .coverCandidates.find((c) => c.selected && c.imageUrl);
      if (selectedCover && !cancelled) {
        setThumbnail((prev) => prev || selectedCover.imageUrl);
        // 编辑器选定封面为 16:9 整期封面 → 预填 16:9 槽
        setCovers((prev) => (prev['16:9'] ? prev : { ...prev, '16:9': selectedCover.imageUrl }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectDir]);

  // ── 文案持久化：项目切换时从 project.json 回填已存的标题/描述/标签/封面/覆盖 ──
  useEffect(() => {
    hydratedRef.current = false;
    if (!projectDir) {
      hydratedRef.current = true;
      return;
    }
    let cancelled = false;
    void (async () => {
      let saved: ProjectPublishMeta | null = null;
      try {
        const raw = await window.electronAPI.loadProject(projectDir);
        saved = extractPublishSection(JSON.parse(raw) as ProjectData);
      } catch {
        saved = null;
      }
      if (cancelled) return;
      if (saved) {
        // 已存文案优先于派生预填（派生预填仍用 prev|| 兜底空值）
        if (saved.title) setTitle((prev) => prev || saved!.title);
        if (saved.desc) setDesc((prev) => prev || saved!.desc);
        if (saved.tagsInput) setTagsInput((prev) => prev || saved!.tagsInput);
        if (saved.thumbnail) setThumbnail((prev) => prev || saved!.thumbnail);
        if (saved.covers && Object.keys(saved.covers).length) {
          setCovers((prev) => ({ ...saved!.covers, ...prev }));
        }
        if (saved.bilibiliTid) setBilibiliTid((prev) => prev || saved!.bilibiliTid!);
      }
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [projectDir]);

  // ── 文案持久化：标题/描述/标签/封面/覆盖变更时防抖写回 project.json ──
  useEffect(() => {
    if (!projectDir || !hydratedRef.current) return;
    const meta: ProjectPublishMeta = {
      title,
      desc,
      tagsInput,
      thumbnail,
      covers,
      bilibiliTid,
    };
    const timer = setTimeout(() => {
      window.electronAPI
        .saveProjectSection(projectDir, 'publish', JSON.stringify(meta))
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [projectDir, title, desc, tagsInput, thumbnail, covers, bilibiliTid]);

  const handleGenerateMeta = async () => {
    setMetaError(null);
    const settings = await loadAISettings();
    if (!settings) {
      setMetaError('请先在「设置 → AI」完成大模型配置');
      return;
    }
    const analysis = useAIStore.getState().analysisResult;
    const srtText = useTimelineStore
      .getState()
      .srtEntries.map((e) => e.text)
      .join(' ');
    const sourceText = buildMetadataSource(analysis, srtText);
    if (!sourceText.trim()) {
      setMetaError('暂无内容可供生成，请先完成 AI 分析或导入字幕');
      return;
    }
    setIsGeneratingMeta(true);
    try {
      const projectBindings = projectDir
        ? await window.electronAPI.readPromptBindings('project', projectDir).catch(() => null)
        : null;
      const md = await window.electronAPI.generatePublishMetadata({
        settings,
        sourceText,
        currentTitle: title.trim() || undefined,
        projectDir: projectDir || undefined,
        projectBindings,
      });
      if (md.title) setTitle(md.title);
      if (md.desc) setDesc(md.desc);
      if (md.tags.length) setTagsInput(md.tags.join(', '));
    } catch (e) {
      setMetaError(e instanceof Error ? e.message : 'AI 文案生成失败');
    } finally {
      setIsGeneratingMeta(false);
    }
  };

  // bilibiliTid 变化（hydrate / AI 推荐 / 手选）时，反查并同步主分区态
  useEffect(() => {
    const n = parseInt(bilibiliTid, 10);
    const found = Number.isInteger(n) ? findPartition(n) : null;
    if (found) setBilibiliParentId(found.parent.id);
  }, [bilibiliTid]);

  const handleRecommendPartition = async () => {
    setPartitionError(null);
    const settings = await loadAISettings();
    if (!settings) {
      setPartitionError('请先在「设置 → AI」完成大模型配置');
      return;
    }
    // 标题 / 描述均空时，回退用 AI 分析摘要 / 字幕作为依据
    let fallbackSource: string | undefined;
    if (!title.trim() && !desc.trim()) {
      const analysis = useAIStore.getState().analysisResult;
      const srtText = useTimelineStore
        .getState()
        .srtEntries.map((e) => e.text)
        .join(' ');
      fallbackSource = buildMetadataSource(analysis, srtText);
      if (!fallbackSource.trim()) {
        setPartitionError('请先填写或生成标题 / 描述');
        return;
      }
    }
    setIsRecommendingPartition(true);
    try {
      const projectBindings = projectDir
        ? await window.electronAPI.readPromptBindings('project', projectDir).catch(() => null)
        : null;
      const { tid } = await window.electronAPI.recommendBilibiliPartition({
        settings,
        title: title.trim(),
        desc: desc.trim(),
        fallbackSource,
        projectDir: projectDir || undefined,
        projectBindings,
      });
      setBilibiliTid(String(tid));
    } catch (e) {
      setPartitionError(e instanceof Error ? e.message : 'AI 分区推荐失败');
    } finally {
      setIsRecommendingPartition(false);
    }
  };

  const toggleAccount = (accId: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accId) ? prev.filter((id) => id !== accId) : [...prev, accId],
    );
    setValidationError(null);
  };

  const handlePickFile = async () => {
    const path = await window.electronAPI.selectMediaFile('video');
    if (path) setFilePath(path);
  };

  const handlePickThumbnail = async () => {
    const path = await window.electronAPI.selectMediaFile('image');
    if (path) setThumbnail(path);
  };

  const handlePublish = async () => {
    if (!filePath) return;
    if (selectedAccountIds.length === 0) return;

    setValidationError(null);

    const sharedTags = tagsInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);

    // ── B站专项校验（全平台共享文案，B站额外需要 tid + 描述）─────────────────────
    const hasBilibili = selectedAccountIds.some(
      (id) => accounts.find((a) => a.id === id)?.platform === 'bilibili',
    );
    const tid = parseInt(bilibiliTid.trim(), 10);
    if (hasBilibili) {
      if (!bilibiliTid.trim() || isNaN(tid) || tid <= 0) {
        setValidationError('发布到 B站需要先选择分区');
        return;
      }
      if (!desc.trim()) {
        setValidationError('发布到 B站需要填写描述');
        return;
      }
    }

    // 多比例封面：仅收集已选比例；单图 thumbnail 作为兜底（优先竖图，兼容旧/单封面平台）
    const ratios = ['16:9', '4:3', '3:4'] as const;
    const coversObj = ratios.reduce<Record<string, string>>((acc, r) => {
      if (covers[r]) acc[r] = covers[r];
      return acc;
    }, {});
    const primaryThumb = covers['3:4'] || covers['16:9'] || covers['4:3'] || thumbnail || undefined;
    const shared = {
      title,
      desc,
      tags: sharedTags,
      thumbnail: primaryThumb,
      covers: Object.keys(coversObj).length ? coversObj : undefined,
    };

    // Build targets — 全平台共用 shared 文案，B站附加 tid
    const targets: PublishTarget[] = selectedAccountIds.map((accountId) => {
      const acc = accounts.find((a) => a.id === accountId);
      const bilibiliExtra: PublishTarget['bilibili'] =
        acc?.platform === 'bilibili' && !isNaN(tid) ? { tid } : undefined;
      return {
        accountId,
        ...(bilibiliExtra ? { bilibili: bilibiliExtra } : {}),
      };
    });

    try {
      await startPublish(filePath, shared, targets, true);
    } catch {
      // errors are handled in the store (failTask)
    }
  };

  // Show results from last run (store clears job on completion but keeps results)
  const jobResults = results;
  const hasResults = Object.keys(jobResults).length > 0;
  const targetCount = selectedAccountIds.length;

  // ── B站分区选择器派生值 ──
  const parentOptions = BILIBILI_PARTITIONS.map((p) => ({
    value: String(p.id),
    label: p.name,
  }));
  const childOptions =
    bilibiliParentId != null
      ? (BILIBILI_PARTITIONS.find((p) => p.id === bilibiliParentId)?.children ?? []).map((c) => ({
          value: String(c.id),
          label: c.name,
        }))
      : [];
  const selectedPartition = findPartition(parseInt(bilibiliTid, 10));

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--color-border-subtle, rgba(0,0,0,0.08))',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}
        >
          发布视频
        </h2>
        {projectDir && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            {projectDir}
          </p>
        )}
      </div>

      {/* Form */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Video file */}
        <Field label="视频文件" required>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="选择 MP4 文件或直接输入路径…"
              leftIcon={<Film size={14} />}
              style={{ flex: 1 }}
            />
            <Button variant="outline" onClick={handlePickFile} style={{ flexShrink: 0 }}>
              选择…
            </Button>
          </div>
        </Field>

        {/* Thumbnail (optional) + 封面联动面板 */}
        <Field
          label="封面缩略图"
          hint="视频号 / 抖音都用 4:3 横版 + 3:4 竖版各选一张；16:9 为编辑器整期封面 / 单图兜底"
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="封面图路径（点下方封面或手动选择）"
              leftIcon={<ImageIcon size={14} />}
              style={{ flex: 1 }}
            />
            <Button variant="outline" onClick={handlePickThumbnail} style={{ flexShrink: 0 }}>
              选择…
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setShowCoverPanel((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 8,
              fontSize: 12,
              color: 'var(--color-system-blue)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {showCoverPanel ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            封面比例与生成（16:9 / 4:3 / 3:4）
          </button>
          {showCoverPanel && (
            <div style={{ marginTop: 8 }}>
              <PublishCoverPanel
                projectDir={projectDir}
                selectedByRatio={covers}
                onSelectRatio={(ratio, path) =>
                  setCovers((prev) => {
                    const next = { ...prev };
                    if (next[ratio] === path) delete next[ratio];
                    else next[ratio] = path;
                    return next;
                  })
                }
              />
            </div>
          )}
        </Field>

        {/* AI 一键生成文案 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            variant="outline"
            onClick={() => void handleGenerateMeta()}
            disabled={isGeneratingMeta}
            style={{ flexShrink: 0 }}
          >
            {isGeneratingMeta ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />
                生成中…
              </>
            ) : (
              <>
                <Sparkles size={14} style={{ marginRight: 6 }} />
                AI 一键生成标题/描述/标签
              </>
            )}
          </Button>
          {metaError && (
            <span style={{ fontSize: 12, color: 'var(--color-error, #ef4444)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={12} />
              {metaError}
            </span>
          )}
        </div>

        {/* Title */}
        <Field label="标题" required hint="所有平台共用同一份标题">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="视频标题"
          />
        </Field>

        {/* Description */}
        <Field label="描述">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="视频描述（可选）"
            rows={3}
            style={{
              width: '100%',
              resize: 'vertical',
              padding: '8px 10px',
              fontSize: 13,
              border: '1px solid var(--color-border, rgba(0,0,0,0.15))',
              borderRadius: 6,
              background: 'var(--color-input-bg, var(--color-bg-elevated))',
              color: 'var(--color-text-primary)',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </Field>

        {/* Tags */}
        <Field label="标签" hint="用逗号分隔多个标签，所有平台共用">
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="标签1, 标签2, 标签3"
            leftIcon={<Tag size={14} />}
          />
        </Field>

        {/* Account multi-select */}
        <Field label="发布到" required>
          {accounts.length === 0 ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 6,
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border, rgba(0,0,0,0.1))',
                fontSize: 13,
                color: 'var(--color-text-secondary)',
              }}
            >
              暂无账号，请前往「设置 → 发布账号」添加账号
            </div>
          ) : (
            <div
              style={{
                borderRadius: 6,
                border: '1px solid var(--color-border, rgba(0,0,0,0.1))',
                overflow: 'hidden',
              }}
            >
              {accounts.map((acc, idx) => {
                const isChecked = selectedAccountIds.includes(acc.id);
                const isValid = acc.status === 'valid';
                const isLast = idx === accounts.length - 1;
                return (
                  <div
                    key={acc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle, rgba(0,0,0,0.06))',
                      background: isChecked
                        ? 'color-mix(in srgb, var(--color-system-blue) 6%, transparent)'
                        : 'transparent',
                      opacity: !isValid ? 0.55 : 1,
                    }}
                  >
                    <Checkbox
                      checked={isChecked}
                      disabled={!isValid}
                      onChange={() => toggleAccount(acc.id)}
                      className="flex-1 min-w-0"
                      label={
                        <span style={{ fontSize: 13 }}>
                          <span style={{ fontWeight: 500 }}>
                            {PLATFORM_LABEL[acc.platform] ?? acc.platform}
                          </span>
                          {' '}
                          <span style={{ color: 'var(--color-text-secondary)' }}>{acc.accountName}</span>
                        </span>
                      }
                    />
                    <AccountStatusBadge status={acc.status} />
                    {!isValid && (
                      <span
                        style={{ fontSize: 11, color: 'var(--color-system-blue)', cursor: 'pointer' }}
                        title="前往设置重新登录"
                      >
                        去设置
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Field>

        {/* B站分区 ID — 仅选中 B站账号时显示，全平台共享一份 */}
        {selectedAccountIds.some(
          (id) => accounts.find((a) => a.id === id)?.platform === 'bilibili',
        ) && (
          <Field label="B站分区" required hint="发布到 B站必填；选择最贴合内容的子分区，或用「智能推荐分区」按标题/描述自动选">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Select
                    placeholder="主分区"
                    options={parentOptions}
                    value={bilibiliParentId != null ? String(bilibiliParentId) : ''}
                    onChange={(e) => {
                      const nextParent = parseInt(e.target.value, 10);
                      setBilibiliParentId(Number.isInteger(nextParent) ? nextParent : null);
                      // 切换主分区后清空子分区，强制重新选择
                      setBilibiliTid('');
                      setPartitionError(null);
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Select
                    placeholder="子分区"
                    options={childOptions}
                    disabled={bilibiliParentId == null}
                    value={bilibiliTid}
                    onChange={(e) => {
                      setBilibiliTid(e.target.value);
                      setPartitionError(null);
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  onClick={() => void handleRecommendPartition()}
                  disabled={isRecommendingPartition}
                  style={{ flexShrink: 0 }}
                >
                  {isRecommendingPartition ? (
                    <>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />
                      推荐中…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} style={{ marginRight: 6 }} />
                      智能推荐分区
                    </>
                  )}
                </Button>
                {selectedPartition && (
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    已选：{selectedPartition.parent.name} / {selectedPartition.sub.name}（tid {selectedPartition.sub.id}）
                  </span>
                )}
                {partitionError && (
                  <span style={{ fontSize: 12, color: 'var(--color-error, #ef4444)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <X size={12} />
                    {partitionError}
                  </span>
                )}
              </div>
            </div>
          </Field>
        )}

        {/* Publish button */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            variant="primary"
            onClick={handlePublish}
            disabled={isPublishing || !filePath || targetCount === 0}
            style={{ minWidth: 140 }}
          >
            {isPublishing ? (
              <>
                <Spinner size={14} />
                <span style={{ marginLeft: 6 }}>发布中…</span>
              </>
            ) : (
              <>
                <Upload size={14} style={{ marginRight: 6 }} />
                一键发布{targetCount > 0 ? ` (${targetCount} 个目标)` : ''}
              </>
            )}
          </Button>
          {isPublishing && (
            <Button variant="ghost" onClick={cancelPublish}>
              取消
            </Button>
          )}
          {targetCount === 0 && !isPublishing && (
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              请勾选至少一个账号
            </span>
          )}
          {validationError && !isPublishing && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-error, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <X size={12} />
              {validationError}
            </span>
          )}
        </div>

        {/* Per-target progress rows */}
        {hasResults && (
          <div
            style={{
              borderRadius: 8,
              border: '1px solid var(--color-border, rgba(0,0,0,0.1))',
              padding: '8px 14px',
              background: 'var(--color-bg-elevated)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              发布进度
            </div>
            {Object.entries(jobResults).map(([accountId, result]) => (
              <ResultRow
                key={accountId}
                accountId={accountId}
                state={result.state}
                percent={result.percent}
                message={result.message}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
