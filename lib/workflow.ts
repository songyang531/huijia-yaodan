import type {
  HandoffState,
  Material,
  MedicationItem,
  VerifyStatus,
  View,
} from '../types/handoff';
import { createInitialState } from './mock-data';

export const UNRESOLVED = /待确认|未确认|不详|不清|未知|无法|模糊|[?？]/;
export type Action =
  | { type: 'VIEW'; view: View }
  | { type: 'RESET' }
  | { type: 'SHARING'; enabled: boolean }
  | { type: 'MEMBER'; member: string; selected: boolean }
  | { type: 'MATERIAL_ADD'; material: Material }
  | { type: 'MATERIAL_REMOVE'; id: string }
  | { type: 'FAMILY_NOTE'; value: string }
  | { type: 'EXTRACT'; medications: MedicationItem[]; expectedRevision: number }
  | {
      type: 'EDIT_MED';
      id: string;
      patch: Partial<Pick<MedicationItem, 'name' | 'dosage'>>;
    }
  | {
      type: 'EDIT_REVIEW';
      id: string;
      field: 'basis' | 'change';
      value: string;
    }
  | { type: 'STATUS'; id: string; status: VerifyStatus }
  | { type: 'PHARMACIST'; name: string }
  | { type: 'EXPLANATION'; value: string }
  | { type: 'PUBLISH'; now: string }
  | {
      type: 'FEEDBACK';
      feedback: 'UNDERSTOOD' | 'QUESTION';
      question?: string;
      now: string;
    };

/** Every content change invalidates the published handoff and its caregiver receipt. */
function invalidate(state: HandoffState, ids?: string[]): HandoffState {
  const revision = state.revision + 1;
  const affected = (id: string) => !ids || ids.includes(id);
  return {
    ...state,
    revision,
    publishedRevision: null,
    verifiedAt: null,
    explanation: !ids || ids.length > 0 ? '' : state.explanation,
    feedback: state.feedback === 'QUESTION' ? 'QUESTION' : 'NONE',
    feedbackAt: null,
    task: {
      ...state.task,
      taskStage: state.draftReady ? 'PHARMACIST_REVIEW' : 'FAMILY_INPUT',
      medications: state.task.medications.map((m) =>
        affected(m.id) && m.status === 'PHARMACIST_VERIFIED'
          ? { ...m, status: 'PENDING_AI' }
          : m,
      ),
    },
    reviews: Object.fromEntries(
      Object.entries(state.reviews).map(([id, r]) => [
        id,
        { ...r, revision: affected(id) ? 0 : revision },
      ]),
    ),
  };
}

export function publishBlocker(state: HandoffState): string | null {
  if (!state.draftReady) return '请先从家庭端整理材料。';
  if (!state.task.medications.length)
    return '没有可核对的药物条目，请补充材料。';
  const pending = state.task.medications.filter(
    (m) =>
      m.status !== 'PHARMACIST_VERIFIED' ||
      state.reviews[m.id]?.revision !== state.revision ||
      !m.name.trim() ||
      UNRESOLVED.test(m.name) ||
      UNRESOLVED.test(m.dosage) ||
      !m.dosage.trim(),
  );
  if (pending.length)
    return `还有 ${pending.length} 项未完成核对，暂不能生成交接单。`;
  if (!state.pharmacistName.trim()) return '请填写本次演示核对人。';
  if (state.feedback === 'QUESTION' && state.explanation.trim().length < 5)
    return '请先填写给照护者的重新解释。';
  return null;
}

export function hasCurrentHandoff(state: HandoffState): boolean {
  return (
    state.publishedRevision === state.revision &&
    state.task.taskStage === 'CAREGIVER_CONFIRM' &&
    !publishBlocker(state)
  );
}

export function transition(state: HandoffState, action: Action): HandoffState {
  switch (action.type) {
    case 'RESET':
      return { ...createInitialState(), revision: state.revision + 1 };
    case 'VIEW':
      return { ...state, view: action.view };
    case 'SHARING':
      return {
        ...state,
        sharingEnabled: action.enabled,
        sharedMembers: action.enabled ? state.sharedMembers : [],
        task: {
          ...state.task,
          isShared: action.enabled && state.sharedMembers.length > 0,
        },
      };
    case 'MEMBER': {
      if (!state.sharingEnabled) throw new Error('请先开启按成员共享。');
      if (!['caregiver', 'pharmacist'].includes(action.member))
        throw new Error('无效的共享成员。');
      const sharedMembers = action.selected
        ? [...new Set([...state.sharedMembers, action.member])]
        : state.sharedMembers.filter((id) => id !== action.member);
      return {
        ...state,
        sharedMembers,
        task: { ...state.task, isShared: sharedMembers.length > 0 },
      };
    }
    case 'MATERIAL_ADD':
    case 'MATERIAL_REMOVE': {
      const materials =
        action.type === 'MATERIAL_ADD'
          ? [...state.materials, action.material]
          : state.materials.filter((m) => m.id !== action.id);
      if (materials.length > 6) throw new Error('一次最多添加 6 份材料。');
      const next = invalidate(state);
      const clearDemoNote =
        action.type === 'MATERIAL_ADD' &&
        !action.material.isDemo &&
        state.familyNoteIsDemo;
      return {
        ...next,
        materials,
        familyNote: clearDemoNote ? '' : state.familyNote,
        familyNoteIsDemo: clearDemoNote ? false : state.familyNoteIsDemo,
        draftReady: false,
        task: {
          ...next.task,
          taskStage: 'FAMILY_INPUT',
          materials: materials.map((m) => m.url),
          medications: [],
        },
        reviews: {},
      };
    }
    case 'FAMILY_NOTE': {
      const next = invalidate(state);
      return {
        ...next,
        familyNote: action.value,
        familyNoteIsDemo: false,
        draftReady: false,
        task: { ...next.task, taskStage: 'FAMILY_INPUT' },
      };
    }
    case 'EXTRACT': {
      if (state.revision !== action.expectedRevision)
        throw new Error('整理期间材料已变化，请重新整理当前材料。');
      if (!state.materials.length) throw new Error('请先添加材料。');
      if (action.medications.some((m) => m.status === 'PHARMACIST_VERIFIED'))
        throw new Error('AI 不能设置药师核对状态。');
      const next = invalidate(state);
      return {
        ...next,
        draftReady: true,
        view: 'pharmacist',
        reviews: {},
        task: {
          ...next.task,
          medications: structuredClone(action.medications),
          taskStage: 'PHARMACIST_REVIEW',
        },
      };
    }
    case 'EDIT_MED': {
      const next = invalidate(state, [action.id]);
      return {
        ...next,
        task: {
          ...next.task,
          medications: next.task.medications.map((m) =>
            m.id === action.id ? { ...m, ...action.patch } : m,
          ),
        },
      };
    }
    case 'EDIT_REVIEW': {
      const next = invalidate(state, [action.id]);
      return {
        ...next,
        reviews: {
          ...next.reviews,
          [action.id]: {
            ...(next.reviews[action.id] ?? {
              basis: '',
              change: '',
              revision: 0,
            }),
            [action.field]: action.value,
            revision: 0,
          },
        },
      };
    }
    case 'STATUS': {
      if (!state.draftReady || state.view !== 'pharmacist')
        throw new Error('请在药师工作台核对草稿。');
      const item = state.task.medications.find((m) => m.id === action.id);
      if (!item) throw new Error('药物条目不存在。');
      if (action.status === 'PHARMACIST_VERIFIED') {
        if (
          !item.name.trim() ||
          UNRESOLVED.test(item.name) ||
          !item.dosage.trim() ||
          UNRESOLVED.test(item.dosage)
        )
          throw new Error(
            '名称与用法仍不完整，请依据医生原始文件核实后填写；不能用“待确认”生成最终安排。',
          );
        if ((state.reviews[item.id]?.basis.trim().length ?? 0) < 5)
          throw new Error(
            '请填写至少 5 个字的核对依据，说明核对了哪份医生文件。',
          );
      }
      const next = invalidate(state, [action.id]);
      return {
        ...next,
        task: {
          ...next.task,
          medications: next.task.medications.map((m) =>
            m.id === action.id ? { ...m, status: action.status } : m,
          ),
        },
        reviews: {
          ...next.reviews,
          [action.id]: {
            ...(next.reviews[action.id] ?? {
              basis: '',
              change: '',
              revision: 0,
            }),
            revision:
              action.status === 'PHARMACIST_VERIFIED' ? next.revision : 0,
          },
        },
      };
    }
    case 'PHARMACIST':
      return { ...invalidate(state, []), pharmacistName: action.name };
    case 'EXPLANATION':
      return { ...invalidate(state, []), explanation: action.value };
    case 'PUBLISH': {
      if (state.view !== 'pharmacist')
        throw new Error('请在药师工作台生成交接单。');
      const blocker = publishBlocker(state);
      if (blocker) throw new Error(blocker);
      return {
        ...state,
        view: 'caregiver',
        publishedRevision: state.revision,
        verifiedAt: action.now,
        feedback: 'NONE',
        feedbackAt: null,
        task: { ...state.task, taskStage: 'CAREGIVER_CONFIRM' },
      };
    }
    case 'FEEDBACK': {
      if (!hasCurrentHandoff(state))
        throw new Error('请等待当前版本的交接单核对完成。');
      if (action.feedback === 'UNDERSTOOD')
        return { ...state, feedback: 'UNDERSTOOD', feedbackAt: action.now };
      const next = invalidate(state, []);
      return {
        ...next,
        view: 'pharmacist',
        feedback: 'QUESTION',
        question:
          action.question?.trim() ||
          '照护者表示尚未完全理解，请重新解释本次安排。',
        explanation: '',
        feedbackAt: action.now,
        task: { ...next.task, taskStage: 'PHARMACIST_REVIEW' },
      };
    }
  }
}
