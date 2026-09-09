import type { HandoffState, Material, MedicationItem } from '../types/handoff';
export const MOCK_MATERIALS: Material[] = [
  {
    id: 'discharge',
    name: '出院记录 · 用药页',
    date: '2026-09-08',
    source: 'DOCTOR_NOTE',
    kind: 'DISCHARGE',
    url: '/materials/discharge.svg',
    isDemo: true,
  },
  {
    id: 'boxes',
    name: '家中现有药品',
    date: '2026-09-09',
    source: 'FAMILY_UPLOAD',
    kind: 'MEDICINE',
    url: '/materials/medicines.svg',
    isDemo: true,
  },
];
export const MOCK_MEDICATIONS: MedicationItem[] = [
  {
    id: 'med-1',
    name: '苯磺酸氨氯地平片',
    dosage: '出院单记录：5 mg，每日 1 次',
    source: 'DOCTOR_NOTE',
    status: 'CONFLICT_DETECTED',
    aiRemark: '家属口述原为每日 2 次，出院单记录每日 1 次；频率差异待确认。',
  },
  {
    id: 'med-2',
    name: '阿司匹林肠溶片',
    dosage: '待确认：家属口述每日 1 次，剂量未确认',
    source: 'FAMILY_UPLOAD',
    status: 'CONFLICT_DETECTED',
    aiRemark:
      '家属口述家中仍有此药，但本次出院单未见。资料缺失不能作为停药依据，请核对医生原始文件。',
  },
  {
    id: 'med-3',
    name: '盐酸二甲双胍片',
    dosage: '待确认：药盒规格模糊，用量及频率未确认',
    source: 'FAMILY_UPLOAD',
    status: 'CONFLICT_DETECTED',
    aiRemark:
      '药盒规格无法清晰辨认，未找到可对应的医生原文。请补充清晰照片和用药记录。',
  },
  {
    id: 'med-4',
    name: '阿托伐他汀钙片',
    dosage: '出院单记录：10 mg，每晚 1 次',
    source: 'DOCTOR_NOTE',
    status: 'PENDING_AI',
    aiRemark: '仅整理出院单原文，等待药师逐项核对。',
  },
];
export function createInitialState(): HandoffState {
  const materials = structuredClone(MOCK_MATERIALS);
  return {
    task: {
      taskId: 'HJ-20260909-001',
      patientName: '陈建国',
      caregiverName: '陈晓 · 女儿',
      isShared: false,
      materials: materials.map((m) => m.url),
      medications: structuredClone(MOCK_MEDICATIONS),
      taskStage: 'FAMILY_INPUT',
    },
    materials,
    view: 'family',
    sharedMembers: [],
    sharingEnabled: false,
    revision: 1,
    reviews: {},
    publishedRevision: null,
    pharmacistName: '',
    verifiedAt: null,
    feedback: 'NONE',
    question: '',
    explanation: '',
    feedbackAt: null,
    familyNote: '爸爸说阿司匹林家里还有；氨氯地平以前好像一天吃两次。',
    familyNoteIsDemo: true,
    draftReady: false,
  };
}
export const SOURCE_LABELS = {
  FAMILY_UPLOAD: '家属提供',
  DOCTOR_NOTE: '医生原始文件',
};
export const STATUS_LABELS = {
  PENDING_AI: '待药师核对',
  CONFLICT_DETECTED: '未确认',
  PHARMACIST_VERIFIED: '已核对 · 演示',
};
