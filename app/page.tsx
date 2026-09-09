'use client';
import {
  HeartHandshake,
  House,
  Stethoscope,
  ClipboardCheck,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { HandoffProvider, useHandoff } from '@/context/handoff-context';
import { FamilyView } from '@/components/views/family-view';
import { PharmacistView } from '@/components/views/pharmacist-view';
import { CaregiverView } from '@/components/views/caregiver-view';
import { WebMCP } from '@/components/webmcp';
import type { View } from '@/types/handoff';
const stageLabels = {
  FAMILY_INPUT: '准备材料中',
  PHARMACIST_REVIEW: '药师核对中',
  CAREGIVER_CONFIRM: '等待理解确认',
};
function Workspace() {
  const { state, send, message, notify } = useHandoff();
  const family = state.view === 'family';
  const titles = {
    family: (
      <>
        准备好材料，
        <br />
        让回家更安心<span className="text-primary">。</span>
      </>
    ),
    pharmacist: (
      <>
        把每一处疑问，
        <br />
        核对清楚<span className="text-primary">。</span>
      </>
    ),
    caregiver: (
      <>
        安心接过，
        <br />
        这一份照护<span className="text-primary">。</span>
      </>
    ),
  };
  return (
    <div className="phone-shell max-w-md mx-auto min-h-dvh">
      <WebMCP />
      <header className="app-header">
        <div className="brand-icon">
          <HeartHandshake size={23} />
        </div>
        <div>
          <p className="brand-name">
            回家药单<span className="brand-dot">.</span>
          </p>
          <p className="text-xs text-muted-foreground">
            把照护，安心交到下一双手
          </p>
        </div>
        <span className="demo-label">演示模式</span>
      </header>
      <div className="demo-strip">
        <ShieldCheck size={14} />
        AI 仅整理 · 核对与成员权限均为演示
      </div>
      {message && (
        <div role="status" aria-live="polite" className="message-toast">
          {message}
          <Button
            className="absolute right-1 top-1 size-9"
            variant="ghost"
            aria-label="关闭提示"
            onClick={() => notify('')}
          >
            <X size={16} />
          </Button>
        </div>
      )}
      <Tabs
        value={state.view}
        onValueChange={(v) => {
          send({ type: 'VIEW', view: v as View });
        }}
      >
        <main className="px-5 pt-7 pb-32">
          <div className="eyebrow">
            {family
              ? 'CARE STARTS AT HOME'
              : state.view === 'pharmacist'
                ? 'EVERY DETAIL DESERVES CARE'
                : 'CARE CONTINUES WITH YOU'}
          </div>
          <h1 className={`page-title ${family ? '' : 'compact'}`}>
            {titles[state.view]}
          </h1>
          <p className="mt-3 text-muted-foreground leading-7">
            {family ? (
              <>
                出院单、家里的药，还有你想说的。
                <br />
                一起交给药师，核对清楚再交接。
              </>
            ) : state.view === 'pharmacist' ? (
              '对照原始材料，让不确定的信息有据可查。'
            ) : (
              '一项一项看明白，有疑问就再问一次。'
            )}
          </p>
          <section className="patient-card mt-6" aria-label="当前交接任务">
            <div className="avatar">陈</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">
                {state.task.patientName}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  演示患者
                </span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                照护人：{state.task.caregiverName}
              </p>
            </div>
            <span className="status-pill">
              {state.feedback === 'UNDERSTOOD'
                ? '已理解 · 交接完成'
                : state.feedback === 'QUESTION'
                  ? '等待重新解释'
                  : stageLabels[state.task.taskStage]}
            </span>
          </section>
          <div className="steps" aria-label="任务阶段">
            <span
              className={
                state.task.taskStage === 'FAMILY_INPUT' ? 'active' : ''
              }
            >
              01 材料准备
            </span>
            <i />
            <span
              className={
                state.task.taskStage === 'PHARMACIST_REVIEW' ? 'active' : ''
              }
            >
              02 药师核对
            </span>
            <i />
            <span
              className={
                state.task.taskStage === 'CAREGIVER_CONFIRM' ? 'active' : ''
              }
            >
              03 安心交接
            </span>
          </div>
          <TabsContent value="family">
            <FamilyView />
          </TabsContent>
          <TabsContent value="pharmacist">
            <PharmacistView />
          </TabsContent>
          <TabsContent value="caregiver">
            <CaregiverView />
          </TabsContent>
          <footer className="text-center text-xs text-muted-foreground mt-7 leading-6">
            复诊准备助手 · HJ-001
            <br />
            演示数据及交接单不能作为真实用药依据
          </footer>
        </main>
        <nav className="bottom-nav" aria-label="切换角色视角">
          <TabsList className="bottom-tabs">
            <TabsTrigger value="family">
              <House />
              <span>家庭端</span>
            </TabsTrigger>
            <TabsTrigger value="pharmacist">
              <Stethoscope />
              <span>药师端</span>
            </TabsTrigger>
            <TabsTrigger value="caregiver">
              <ClipboardCheck />
              <span>交接端</span>
            </TabsTrigger>
          </TabsList>
        </nav>
      </Tabs>
    </div>
  );
}
export default function Home() {
  return (
    <HandoffProvider>
      <Workspace />
    </HandoffProvider>
  );
}
