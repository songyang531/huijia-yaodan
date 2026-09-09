'use client';
import { useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Plus,
  LockKeyhole,
  Trash2,
  MessageSquareText,
  LoaderCircle,
  RotateCcw,
  Camera,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHandoff } from '@/context/handoff-context';
import { MaterialPreview } from '@/components/material-preview';
import { MOCK_MATERIALS } from '@/lib/mock-data';
import type { Material, MaterialSource } from '@/types/handoff';
import { medicationListSchema } from '@/lib/ai/schema';

export function FamilyView() {
  const { state, send, notify } = useHandoff();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [kind, setKind] = useState<Material['kind']>('DISCHARGE');
  const [source, setSource] = useState<MaterialSource>('DOCTOR_NOTE');
  const [date, setDate] = useState('2026-09-09');
  const [file, setFile] = useState<File | null>(null);
  const allDemo = state.materials.every((m) => m.isDemo);

  function addDemo(demoKind: Material['kind']) {
    const sample = MOCK_MATERIALS.find((m) => m.kind === demoKind)!;
    if (
      send({
        type: 'MATERIAL_ADD',
        material: { ...sample, id: crypto.randomUUID(), date },
      })
    ) {
      setOpen(false);
      setError('');
      notify('已添加虚构演示材料，日期与来源已记录。');
    }
  }
  async function upload(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!file) return setError('请先选择一张图片，或使用下方演示材料。');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      return setError('支持 JPG、PNG、WebP 图片。');
    if (file.size > 3 * 1024 * 1024)
      return setError('单张图片不能超过 3 MB，请压缩后重试。');
    if (!date) return setError('请填写材料日期。');
    setUploading(true);
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'));
        reader.readAsDataURL(file);
      });
      if (
        send({
          type: 'MATERIAL_ADD',
          material: {
            id: crypto.randomUUID(),
            url,
            name: file.name,
            date,
            source,
            kind,
            isDemo: false,
          },
        })
      ) {
        setOpen(false);
        setFile(null);
        notify('图片已添加到本次会话，尚未发送给 AI。');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败，请重试。');
    } finally {
      setUploading(false);
    }
  }
  async function extract() {
    if (busy) return;
    setBusy(true);
    setError('');
    const expectedRevision = state.revision;
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(55000),
        body: JSON.stringify(
          allDemo
            ? { mode: 'demo' }
            : {
                mode: 'live',
                consent,
                familyNote: state.familyNote,
                materials: state.materials.filter((m) => !m.isDemo),
              },
        ),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || '整理失败，请稍后重试。');
      const medications = medicationListSchema.parse(result.medications);
      if (send({ type: 'EXTRACT', medications, expectedRevision }))
        notify(
          allDemo
            ? '已加载演示草稿：3 项未确认、1 项待核对。'
            : '材料已整理为草稿，每一项都需要药师核对。',
        );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.name === 'TimeoutError'
            ? '整理超时，原有材料已保留，请重试。'
            : e.message
          : '网络异常，请重试。',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <div className="section-heading">
          <h2>
            我的材料{' '}
            <span className="count">
              {String(state.materials.length).padStart(2, '0')}
            </span>
          </h2>
          <span className="text-xs text-muted-foreground">
            日期与来源可追溯
          </span>
        </div>
        <button
          className="upload-zone"
          onClick={() => {
            setError('');
            setOpen(true);
          }}
          disabled={busy || state.materials.length >= 6}
        >
          <span className="upload-icon">
            <Plus size={25} />
          </span>
          <strong>添加材料</strong>
          <span>出院单 / 药盒照片 · 最多 6 份</span>
          <ArrowUpRight className="absolute right-5 top-5" size={18} />
        </button>
        <div className="mt-4 space-y-3">
          {state.materials.map((m) => (
            <div key={m.id} className="material-card">
              <MaterialPreview material={m} />
              <Button
                variant="ghost"
                className="size-11 shrink-0 text-muted-foreground"
                disabled={busy}
                aria-label={`移除${m.name}`}
                onClick={() => send({ type: 'MATERIAL_REMOVE', id: m.id })}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>
        {!state.materials.length && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            还没有材料，先添加一份出院单吧。
          </p>
        )}
      </section>
      <section className="privacy-card">
        <div className="flex items-center gap-3">
          <LockKeyhole size={20} className="shrink-0 text-primary" />
          <div className="flex-1">
            <h2 className="font-semibold text-base">材料由你决定给谁看</h2>
            <p className="text-sm text-muted-foreground mt-1">
              默认不共享，按成员选择
            </p>
          </div>
          <Switch
            aria-label="开启按成员共享"
            checked={state.sharingEnabled}
            onCheckedChange={(enabled) => send({ type: 'SHARING', enabled })}
          />
        </div>
        {state.sharingEnabled && (
          <div className="mt-4 border-t pt-3 space-y-1">
            {[
              { id: 'caregiver', name: '陈晓 · 实际照护人' },
              { id: 'pharmacist', name: '本次核对药师' },
            ].map((member) => (
              <label
                key={member.id}
                className="flex gap-3 items-center min-h-11 text-sm"
              >
                <Checkbox
                  checked={state.sharedMembers.includes(member.id)}
                  onCheckedChange={(selected) =>
                    send({
                      type: 'MEMBER',
                      member: member.id,
                      selected: !!selected,
                    })
                  }
                />
                {member.name}
              </label>
            ))}
            <p className="text-xs text-muted-foreground mt-1">
              {state.task.isShared
                ? `已选择 ${state.sharedMembers.length} 位成员`
                : '尚未选择成员，仍不共享'}{' '}
              · 仅模拟权限，未向成员发送
            </p>
          </div>
        )}
      </section>
      <section>
        <label
          htmlFor="family-note"
          className="field-label flex items-center gap-2"
        >
          <MessageSquareText size={17} className="text-muted-foreground" />
          还有什么想告诉药师？
        </label>
        <Textarea
          id="family-note"
          className="form-field min-h-24 leading-7"
          placeholder="例如：家里还有以前的药，不确定是否与这次有变化……"
          maxLength={1200}
          value={state.familyNote}
          disabled={busy}
          onChange={(e) => send({ type: 'FAMILY_NOTE', value: e.target.value })}
        />
        <p className="text-xs text-muted-foreground mt-2">
          家属口述单独记录，不会被当作医生医嘱。
        </p>
      </section>
      {!allDemo && (
        <div className="panel">
          <label className="flex items-start gap-3 text-sm leading-6">
            <Checkbox
              className="mt-1"
              checked={consent}
              onCheckedChange={(value) => setConsent(!!value)}
            />
            <span>
              同意将本次上传的图片和补充说明发送给 AI
              服务进行整理。演示材料不会一同发送。
            </span>
          </label>
          <p className="text-xs text-muted-foreground mt-2">
            此选择与成员共享分开控制。
          </p>
        </div>
      )}
      {error && !open && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <div>
        <Button
          className="primary-action"
          disabled={busy || !state.materials.length || (!allDemo && !consent)}
          onClick={extract}
        >
          {busy ? (
            <>
              <LoaderCircle className="animate-spin" />
              正在整理材料…
            </>
          ) : (
            <>
              {allDemo ? '演示整理，交给药师' : 'AI 整理，交给药师'}
              <ArrowUpRight />
            </>
          )}
        </Button>
        <p className="text-xs text-center text-muted-foreground leading-5 mt-3">
          {allDemo
            ? '使用固定的虚构案例演示，不进行真实图片识别。'
            : 'AI 整理结果为未核对草稿，不作为用药安排。'}
        </p>
      </div>
      <Button
        variant="ghost"
        className="w-full h-11 text-sm text-muted-foreground"
        disabled={busy}
        onClick={() => {
          send({ type: 'RESET' });
          setError('');
          setConsent(false);
          notify('演示已重置，共享恢复为关闭。');
        }}
      >
        <RotateCcw />
        重新开始演示
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!uploading) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-auto">
          <DialogTitle className="text-xl">添加材料</DialogTitle>
          <DialogDescription>
            保留材料日期与来源，帮助药师还原用药信息。
          </DialogDescription>
          <form className="space-y-4" onSubmit={upload}>
            <fieldset disabled={uploading} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="material-kind" className="field-label">
                    材料类型
                  </label>
                  <NativeSelect
                    id="material-kind"
                    className="w-full [&_select]:h-11"
                    value={kind}
                    onChange={(e) => {
                      const value = e.target.value as Material['kind'];
                      setKind(value);
                      setSource(
                        value === 'DISCHARGE' ? 'DOCTOR_NOTE' : 'FAMILY_UPLOAD',
                      );
                    }}
                  >
                    <option value="DISCHARGE">出院单</option>
                    <option value="MEDICINE">药盒照片</option>
                  </NativeSelect>
                </div>
                <div>
                  <label htmlFor="material-date" className="field-label">
                    材料日期 *
                  </label>
                  <Input
                    className="form-field"
                    id="material-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="material-source" className="field-label">
                  信息来源 *
                </label>
                <NativeSelect
                  id="material-source"
                  className="w-full [&_select]:h-11"
                  value={source}
                  onChange={(e) => setSource(e.target.value as MaterialSource)}
                >
                  <option value="DOCTOR_NOTE">医生原始文件</option>
                  <option value="FAMILY_UPLOAD">家属提供</option>
                </NativeSelect>
              </div>
              <div>
                <label className="field-label" htmlFor="material-file">
                  选择图片
                </label>
                <Input
                  id="material-file"
                  className="form-field p-2"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  JPG / PNG / WebP，单张不超过 3 MB
                </p>
              </div>
              {error && (
                <p role="alert" className="error-box">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="primary-action"
                disabled={uploading}
              >
                {uploading ? '正在添加…' : '添加到本次材料'}
              </Button>
            </fieldset>
          </form>
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-3">
              没有照片？使用虚构演示材料
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-11"
                disabled={uploading}
                onClick={() => addDemo('DISCHARGE')}
              >
                <FileText />
                演示出院单
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-11"
                disabled={uploading}
                onClick={() => addDemo('MEDICINE')}
              >
                <Camera />
                演示药盒
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
