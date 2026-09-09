'use client';
import {
  AlertTriangle,
  CheckCheck,
  ClipboardCheck,
  ArrowUpRight,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { MaterialPreview } from '@/components/material-preview';
import { useHandoff } from '@/context/handoff-context';
import { publishBlocker, UNRESOLVED } from '@/lib/workflow';
import { SOURCE_LABELS, STATUS_LABELS } from '@/lib/mock-data';
import type { VerifyStatus } from '@/types/handoff';

export function PharmacistView() {
  const { state, send, notify } = useHandoff();
  const pending = state.task.medications.filter(
    (m) => m.status !== 'PHARMACIST_VERIFIED',
  ).length;
  const conflicts = state.task.medications.filter(
    (m) => m.status === 'CONFLICT_DETECTED',
  ).length;
  const blocker = publishBlocker(state);
  if (!state.draftReady)
    return (
      <div className="panel py-8 text-center">
        <ClipboardCheck className="mx-auto text-primary mb-4" size={35} />
        <h2 className="font-semibold text-xl">等待家庭提交材料</h2>
        <p className="text-muted-foreground leading-7 mt-3">
          材料整理完成后，药师可以在这里
          <br />
          查看原图、处理疑问并逐项核对。
        </p>
        <Button
          className="primary-action mt-6"
          onClick={() => send({ type: 'VIEW', view: 'family' })}
        >
          去家庭端整理材料
          <ArrowUpRight />
        </Button>
      </div>
    );
  return (
    <div className="space-y-5">
      {state.feedback === 'QUESTION' && (
        <section className="notice">
          <div className="flex gap-2 items-center font-semibold text-base">
            <MessageCircle size={18} />
            照护者需要重新解释
          </div>
          <p className="mt-2">{state.question}</p>
          <label htmlFor="explanation" className="field-label mt-4">
            给照护者的说明 *
          </label>
          <Textarea
            id="explanation"
            className="form-field"
            placeholder="请针对疑问，用易懂的语言说明……"
            value={state.explanation}
            maxLength={1500}
            onChange={(e) =>
              send({ type: 'EXPLANATION', value: e.target.value })
            }
          />
        </section>
      )}
      <section>
        <div className="section-heading">
          <h2>对照原始材料</h2>
          <span className="text-xs text-muted-foreground">点击查看原图</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {state.materials.map((material) => (
            <MaterialPreview key={material.id} material={material} compact />
          ))}
        </div>
        {state.familyNote && (
          <div className="mt-3 rounded-lg bg-slate-100 px-3 py-3 text-sm leading-6">
            <strong className="text-primary">家属补充 · 待确认</strong>
            <p className="mt-1">{state.familyNote}</p>
          </div>
        )}
      </section>
      <section className="notice flex gap-3">
        <AlertTriangle size={20} className="shrink-0 mt-1" />
        <div>
          <h2 className="font-semibold text-base">
            {conflicts ? `${conflicts} 项信息存在疑问` : '请完成逐项人工核对'}
          </h2>
          <p className="mt-1">
            AI 只整理资料。未见于新出院单的旧药，不能据此认定停用。
          </p>
        </div>
      </section>
      <section>
        <div className="section-heading">
          <h2>
            药物草稿{' '}
            <span className="count">{state.task.medications.length} 项</span>
          </h2>
          <span className="text-sm text-muted-foreground">
            {state.task.medications.length - pending}/
            {state.task.medications.length} 已核对
          </span>
        </div>
        <div className="space-y-4">
          {state.task.medications.map((med, index) => {
            const verified = med.status === 'PHARMACIST_VERIFIED';
            const conflict = med.status === 'CONFLICT_DETECTED';
            const review = state.reviews[med.id];
            const needsDetail =
              !med.name.trim() ||
              UNRESOLVED.test(med.name) ||
              !med.dosage.trim() ||
              UNRESOLVED.test(med.dosage) ||
              (review?.basis.trim().length ?? 0) < 5;
            return (
              <article
                key={med.id}
                className={`review-card ${conflict ? 'conflict' : ''} ${verified ? 'verified' : ''}`}
              >
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="subtle-label">
                    药物 {String(index + 1).padStart(2, '0')} ·{' '}
                    {SOURCE_LABELS[med.source]}
                  </span>
                  <span
                    className={`status-badge ${conflict ? 'conflict' : ''} ${verified ? 'verified' : ''}`}
                  >
                    {verified ? (
                      <CheckCheck size={13} />
                    ) : conflict ? (
                      <AlertTriangle size={13} />
                    ) : null}
                    {STATUS_LABELS[med.status]}
                  </span>
                </div>
                <label className="field-label" htmlFor={`name-${med.id}`}>
                  药物名称
                </label>
                <Input
                  id={`name-${med.id}`}
                  className="form-field font-semibold"
                  value={med.name}
                  maxLength={150}
                  onChange={(e) =>
                    send({
                      type: 'EDIT_MED',
                      id: med.id,
                      patch: { name: e.target.value },
                    })
                  }
                />
                <label
                  className="field-label mt-3"
                  htmlFor={`dosage-${med.id}`}
                >
                  原文用法 / 核对后安排 *
                </label>
                <Textarea
                  id={`dosage-${med.id}`}
                  className="form-field min-h-20 leading-6"
                  value={med.dosage}
                  maxLength={500}
                  onChange={(e) =>
                    send({
                      type: 'EDIT_MED',
                      id: med.id,
                      patch: { dosage: e.target.value },
                    })
                  }
                />
                {med.aiRemark && (
                  <div
                    className={`mt-3 text-sm leading-6 rounded-lg p-3 ${conflict ? 'bg-orange-50 text-amber-800' : 'bg-slate-50 text-slate-600'}`}
                  >
                    <span className="font-semibold">
                      AI 原始疑问 ·{' '}
                      {verified ? '已人工核对，保留记录' : '待核对'}
                    </span>
                    <p>{med.aiRemark}</p>
                  </div>
                )}
                <label className="field-label mt-4" htmlFor={`basis-${med.id}`}>
                  药师核对依据 *
                </label>
                <Textarea
                  id={`basis-${med.id}`}
                  className="form-field min-h-20"
                  value={review?.basis ?? ''}
                  maxLength={1000}
                  placeholder="例如：已对照 9 月 8 日出院单第 2 页并核实原文。"
                  onChange={(e) =>
                    send({
                      type: 'EDIT_REVIEW',
                      id: med.id,
                      field: 'basis',
                      value: e.target.value,
                    })
                  }
                />
                <label
                  className="field-label mt-3"
                  htmlFor={`change-${med.id}`}
                >
                  需要照护者关注的变化{' '}
                  <span className="font-normal text-muted-foreground">
                    （选填）
                  </span>
                </label>
                <Input
                  id={`change-${med.id}`}
                  className="form-field"
                  value={review?.change ?? ''}
                  maxLength={500}
                  placeholder="只填写有依据、已核实的变化"
                  onChange={(e) =>
                    send({
                      type: 'EDIT_REVIEW',
                      id: med.id,
                      field: 'change',
                      value: e.target.value,
                    })
                  }
                />
                <label
                  className="field-label mt-4"
                  htmlFor={`status-${med.id}`}
                >
                  核对状态
                </label>
                <NativeSelect
                  id={`status-${med.id}`}
                  className="w-full [&_select]:h-11 [&_select]:text-sm"
                  value={med.status}
                  onChange={(e) =>
                    send({
                      type: 'STATUS',
                      id: med.id,
                      status: e.target.value as VerifyStatus,
                    })
                  }
                >
                  <option value="PENDING_AI">待药师核对</option>
                  <option value="CONFLICT_DETECTED">
                    未确认 · 需要补充依据
                  </option>
                  <option value="PHARMACIST_VERIFIED" disabled={needsDetail}>
                    已逐项核对（演示）
                  </option>
                </NativeSelect>
                {needsDetail && !verified && (
                  <p className="text-xs text-muted-foreground leading-5 mt-2">
                    先补全名称、明确用法与核对依据，再选择“已逐项核对”。
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section className="action-panel">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={19} />
          完成本次核对
        </div>
        <label className="field-label mt-4" htmlFor="pharmacist-name">
          演示核对人 *
        </label>
        <Input
          id="pharmacist-name"
          className="form-field"
          placeholder="填写演示姓名"
          maxLength={50}
          value={state.pharmacistName}
          onChange={(e) => send({ type: 'PHARMACIST', name: e.target.value })}
        />
        <p className="text-xs text-muted-foreground leading-5 mt-3">
          本原型未认证真实药师身份。修改内容后需重新核对对应条目；未确认项不能进入最终安排。
        </p>
        {blocker && (
          <p className="text-sm text-amber-800 mt-4" role="status">
            {blocker}
          </p>
        )}
        <Button
          className="primary-action mt-4"
          disabled={!!blocker}
          onClick={() => {
            if (send({ type: 'PUBLISH', now: new Date().toISOString() }))
              notify('演示交接单已生成，等待照护者确认理解。');
          }}
        >
          确认无误，生成交接单
          <ArrowUpRight />
        </Button>
      </section>
    </div>
  );
}
