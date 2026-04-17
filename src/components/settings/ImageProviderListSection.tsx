import { useState } from 'react';
import type { ImageProvider } from '../../types/ai';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  ModalFooter,
  Select,
} from '../../ui';
import type { SelectOption } from '../../ui';
import {
  normalizeImageProviderDraft,
  validateImageProviderDraft,
} from './ai-config-utils';
import styles from './ImageProviderListSection.module.css';

/** 生成唯一 ID */
function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const IMAGE_PROVIDER_TYPE_OPTIONS: SelectOption[] = [
  { value: 'jimeng', label: '即梦' },
  { value: 'openai_image', label: 'OpenAI Images（暂未实现）' },
  { value: 'custom', label: '自定义' },
];

/** 空白 ImageProvider 表单 */
function emptyImageProvider(): ImageProvider {
  return {
    id: genId(),
    name: '',
    type: 'jimeng',
    baseUrl: '',
    apiKey: '',
    models: [],
  };
}

function getApiKeyLabel(type: ImageProvider['type']): string {
  return type === 'jimeng' ? '即梦 Session ID' : 'API Key';
}

function getApiKeyPlaceholder(type: ImageProvider['type']): string {
  return type === 'jimeng' ? '即梦 session 凭证' : 'sk-...';
}

// ─── 子组件：ImageProvider 编辑弹窗 ───────────────────────────────────────

interface DialogProps {
  initial: ImageProvider;
  isDefault: boolean;
  onSave: (p: ImageProvider, isDefault: boolean) => void;
  onCancel: () => void;
}

function ImageProviderDialog({ initial, isDefault, onSave, onCancel }: DialogProps) {
  const [form, setForm] = useState<ImageProvider>({ ...initial });
  const [setAsDefault, setSetAsDefault] = useState(isDefault);
  const [newModel, setNewModel] = useState('');
  const [errors, setErrors] = useState<ReturnType<typeof validateImageProviderDraft>>({});
  const title = initial.name ? '编辑图像 Provider' : '添加图像 Provider';

  const clearFieldError = (key: keyof ReturnType<typeof validateImageProviderDraft>) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const set = <K extends keyof ImageProvider>(
    key: K,
    value: ImageProvider[K],
    errorKey?: keyof ReturnType<typeof validateImageProviderDraft>,
  ) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errorKey) {
      clearFieldError(errorKey);
    }
  };

  const addModel = () => {
    const m = newModel.trim();
    if (m && !form.models.includes(m)) {
      set('models', [...form.models, m], 'models');
    }
    setNewModel('');
  };

  const removeModel = (idx: number) =>
    set(
      'models',
      form.models.filter((_, i) => i !== idx),
      'models',
    );

  const handleConfirm = () => {
    const pendingModel = newModel.trim();
    const nextForm =
      pendingModel && !form.models.includes(pendingModel)
        ? { ...form, models: [...form.models, pendingModel] }
        : form;

    const nextErrors = validateImageProviderDraft(nextForm);
    setErrors(nextErrors);

    if (pendingModel) {
      setNewModel('');
      if (nextForm !== form) {
        setForm(nextForm);
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onSave(normalizeImageProviderDraft(nextForm), setAsDefault);
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onCancel() : undefined)}>
      <DialogContent size="lg" className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className={styles.dialogBody}>
          <Field label="名称" required error={errors.name}>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value, 'name')}
              placeholder="例如：即梦主账号"
              size="sm"
              aria-invalid={Boolean(errors.name)}
            />
          </Field>

          <Field label="类型">
            <Select
              value={form.type}
              options={IMAGE_PROVIDER_TYPE_OPTIONS}
              onChange={(e) => {
                const nextType = e.target.value as ImageProvider['type'];
                setForm((f) => ({ ...f, type: nextType }));
                clearFieldError('baseUrl');
                clearFieldError('apiKey');
              }}
            />
          </Field>

          <Field label="Base URL" required error={errors.baseUrl}>
            <Input
              value={form.baseUrl}
              onChange={(e) => set('baseUrl', e.target.value, 'baseUrl')}
              placeholder="https://example.com/api"
              size="sm"
              aria-invalid={Boolean(errors.baseUrl)}
            />
          </Field>

          <Field label={getApiKeyLabel(form.type)} required error={errors.apiKey}>
            <Input
              variant="password"
              value={form.apiKey}
              onChange={(e) => set('apiKey', e.target.value, 'apiKey')}
              placeholder={getApiKeyPlaceholder(form.type)}
              size="sm"
              aria-invalid={Boolean(errors.apiKey)}
            />
          </Field>

          <Field label="模型列表" required error={errors.models}>
            {form.models.length > 0 ? (
              <div className={styles.modelList}>
                {form.models.map((m, idx) => (
                  <div key={`${m}-${idx}`} className={styles.modelItem}>
                    <Badge variant="secondary" size="xs">
                      {m}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={styles.removeModelButton}
                      onClick={() => removeModel(idx)}
                    >
                      移除
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.hintText}>暂未添加模型</p>
            )}
            <div className={styles.modelInputRow}>
              <Input
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addModel();
                  }
                }}
                placeholder="输入模型名后按 Enter 或点击添加"
                size="sm"
                wrapperClassName={styles.modelInput}
                aria-invalid={Boolean(errors.models)}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addModel}>
                添加
              </Button>
            </div>
          </Field>

          <Checkbox
            label="设为默认图像 Provider"
            checked={setAsDefault}
            onChange={(checked) => setSetAsDefault(checked)}
            size="sm"
            className={styles.defaultCheckbox}
          />

          <ModalFooter
            onCancel={onCancel}
            onConfirm={handleConfirm}
            confirmLabel="保存"
            extra={
              Object.keys(errors).length > 0 ? (
                <span className={styles.footerError}>请先补全 Provider 的必填项</span>
              ) : null
            }
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────

interface Props {
  imageProviders: ImageProvider[];
  defaultImageProviderId: string | null;
  onChange: (providers: ImageProvider[], defaultId: string | null) => void;
}

export function ImageProviderListSection({
  imageProviders,
  defaultImageProviderId,
  onChange,
}: Props) {
  const [editTarget, setEditTarget] = useState<ImageProvider | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleSave = (updated: ImageProvider, setAsDefault: boolean) => {
    let next: ImageProvider[];
    if (isAdding) {
      next = [...imageProviders, updated];
    } else {
      next = imageProviders.map((p) => (p.id === updated.id ? updated : p));
    }
    const newDefaultId = setAsDefault ? updated.id : (defaultImageProviderId ?? null);
    onChange(next, newDefaultId);
    setEditTarget(null);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const next = imageProviders.filter((p) => p.id !== id);
    const newDefaultId =
      defaultImageProviderId === id ? (next[0]?.id ?? null) : (defaultImageProviderId ?? null);
    onChange(next, newDefaultId);
  };

  const openAdd = () => {
    setEditTarget(emptyImageProvider());
    setIsAdding(true);
  };

  const openEdit = (p: ImageProvider) => {
    setEditTarget({ ...p });
    setIsAdding(false);
  };

  const closeDialog = () => {
    setEditTarget(null);
    setIsAdding(false);
  };

  return (
    <div className={styles.root}>
      {imageProviders.length === 0 ? (
        <EmptyState
          eyebrow="Image Provider"
          title="暂无图像 Provider"
          description="点击下方按钮添加你的第一个图像 Provider。"
          actions={
            <Button type="button" variant="secondary" onClick={openAdd}>
              + 添加图像 Provider
            </Button>
          }
        />
      ) : (
        <>
          <div className={styles.providerList}>
            {imageProviders.map((p) => (
              <div key={p.id} className={styles.providerCard}>
                <div className={styles.providerHeader}>
                  <div className={styles.providerTitleGroup}>
                    <span className={styles.providerName}>{p.name || '未命名 Provider'}</span>
                    {p.id === defaultImageProviderId ? (
                      <Badge variant="info" size="xs">
                        默认
                      </Badge>
                    ) : null}
                  </div>
                  <div className={styles.providerActions}>
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(p)}>
                      编辑
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(p.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>

                {p.baseUrl ? <span className={styles.providerBaseUrl}>{p.baseUrl}</span> : null}

                {p.models.length > 0 ? (
                  <div className={styles.providerModels}>
                    {p.models.map((m) => (
                      <Badge key={m} variant="secondary" size="xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className={styles.providerHint}>未配置模型</span>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            className={styles.addProviderButton}
            onClick={openAdd}
          >
            + 添加图像 Provider
          </Button>
        </>
      )}

      {editTarget && (
        <ImageProviderDialog
          initial={editTarget}
          isDefault={isAdding ? false : editTarget.id === defaultImageProviderId}
          onSave={handleSave}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
