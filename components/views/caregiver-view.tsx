'use client';
import { useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock3,
  ShieldCheck,
  MessageCircle,
  ArrowUpRight,
  HeartHandshake,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useHandoff } from '@/context/handoff-context';
import { hasCurrentHandoff } from '@/lib/workflow';

export function CaregiverView() {
  const { state, send, notify } = useHandoff();
  const [question, setQuestion] = useState('');
  if (!hasCurrentHandoff(state))
    return (
      <section className="panel py-9 text-center">
        <Clock3 size={38} className="text-primary mx-auto mb-4" />
        <h2 className="text-xl font-semibold">
          {state.feedback === 'QUESTION' ? '正在重新解释' : '交接单还在核对中'}
        </h2>
        <p className="text-lg text-muted-foreground leading-8 mt-4">
          {state.feedback === 'QUESTION'
            ? '你的疑问已回到药师工作台。重新确认后，会在这里显示新的交接单。'
            : '等药师逐项核对完成，才会在这里显示本次确认的安排。'}
        </p>
        <Button
          className="primary-action mt-6"
          onClick={() => send({ type: 'VIEW', view: 'pharmacist' })}
        >
          查看核对进度
          <ArrowUpRight />
        </Button>
      </section>
    );
  const changes = state.task.medications.filter((m) =>
    state.reviews[m.id]?.change.trim(),
  );
  return (
    <div className="space-y-6">
      <section className="success-box">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <ShieldCheck size={23} />
          本次信息已核对 · 演示
        </div>
        <p className="mt-2 text-base leading-7">
          核对人：{state.pharmacistName}
          <br />
          {state.verifiedAt &&
            new Date(state.verifiedAt).toLocaleString('zh-CN', {
              hour12: false,
            })}
        </p>
        <p className="text-sm mt-2 leading-6">
          演示身份未经认证，此单不能作为真实用药依据。
        </p>
      </section>
      <section>
        <h2 className="text-xl font-bold mb-4">本次确认的安排</h2>
        <div className="space-y-3">
          {state.task.medications.map((m, index) => (
            <article key={m.id} className="handoff-med">
              <div className="flex gap-3 items-start">
                <span className="size-7 rounded-full bg-slate-100 text-primary text-sm grid place-items-center shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <h3 className="text-xl font-semibold leading-8">{m.name}</h3>
              </div>
              <p className="mt-3">{m.dosage}</p>
              <div className="text-sm leading-6 text-muted-foreground border-t mt-4 pt-3">
                核对依据：{state.reviews[m.id]?.basis}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
        <h2 className="text-xl font-bold text-amber-900">需要关注的变化</h2>
        {changes.length ? (
          <ul className="mt-4 space-y-4">
            {changes.map((m) => (
              <li key={m.id} className="text-lg leading-8">
                <strong>{m.name}</strong>
                <p>{state.reviews[m.id].change}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-lg leading-8 text-amber-900">
            药师未填写已确认的变化说明。如需了解前后差异，请在下方提出疑问。
          </p>
        )}
        <p className="text-sm mt-3 text-amber-800">
          仅展示核对人填写的变化，不由 AI 推断。
        </p>
      </section>
      {state.explanation && (
        <section className="panel">
          <h2 className="text-xl font-bold flex gap-2 items-center">
            <MessageCircle size={22} />
            药师的重新解释
          </h2>
          <p className="mt-3 text-lg leading-8 whitespace-pre-wrap">
            {state.explanation}
          </p>
        </section>
      )}
      <section className="action-panel">
        <div className="flex gap-2 items-center">
          <HeartHandshake className="text-primary" size={25} />
          <h2 className="text-xl font-bold">最后一步，确认交接</h2>
        </div>
        <p className="text-lg text-muted-foreground mt-3 leading-8">
          {state.task.caregiverName}
          ，上面的安排都看明白了吗？有不清楚的地方，我们再解释一次。
        </p>
        {state.feedback === 'UNDERSTOOD' && (
          <div role="status" className="success-box mt-4">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <CheckCheck size={23} />
              已记录：我已完全理解
            </p>
            <p className="text-base mt-2">
              本次交接已完成。后续有疑问仍可重新提出。
            </p>
          </div>
        )}
        <label
          htmlFor="caregiver-question"
          className="field-label mt-5 text-base"
        >
          想问的问题{' '}
          <span className="text-muted-foreground font-normal">（选填）</span>
        </label>
        <Textarea
          id="caregiver-question"
          className="form-field !text-lg leading-8 min-h-24"
          placeholder="例如：这个药的频率变化，我还没听明白。"
          maxLength={1200}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button
          className="primary-action !min-h-16 !text-xl mt-4"
          disabled={state.feedback === 'UNDERSTOOD'}
          onClick={() => {
            if (
              send({
                type: 'FEEDBACK',
                feedback: 'UNDERSTOOD',
                now: new Date().toISOString(),
              })
            )
              notify('已记录照护者理解反馈，本次演示交接完成。');
          }}
        >
          <Check className="!size-6" />
          我已完全理解
        </Button>
        <Button
          variant="outline"
          className="primary-action !min-h-16 !text-lg mt-3 !border-primary !bg-white !text-primary"
          onClick={() => {
            if (
              send({
                type: 'FEEDBACK',
                feedback: 'QUESTION',
                question,
                now: new Date().toISOString(),
              })
            )
              notify('疑问已返回演示药师工作台，等待重新解释。');
          }}
        >
          <MessageCircle className="!size-5" />
          我有疑问，需重新解释
        </Button>
        <p className="text-sm text-muted-foreground mt-4 text-center leading-6">
          理解反馈仅表示已理解本次交接内容。
        </p>
      </section>
    </div>
  );
}
