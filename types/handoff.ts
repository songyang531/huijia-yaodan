export type MaterialSource = 'FAMILY_UPLOAD' | 'DOCTOR_NOTE';
export type VerifyStatus =
  | 'PENDING_AI'
  | 'CONFLICT_DETECTED'
  | 'PHARMACIST_VERIFIED';
export interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  source: MaterialSource;
  status: VerifyStatus;
  aiRemark?: string;
}
export interface HandoffTask {
  taskId: string;
  patientName: string;
  caregiverName: string;
  isShared: boolean;
  materials: string[];
  medications: MedicationItem[];
  taskStage: 'FAMILY_INPUT' | 'PHARMACIST_REVIEW' | 'CAREGIVER_CONFIRM';
}
// Companion records preserve the requested interfaces and retain provenance.
export interface Material {
  id: string;
  url: string;
  name: string;
  date: string;
  source: MaterialSource;
  kind: 'DISCHARGE' | 'MEDICINE';
  isDemo: boolean;
}
export type View = 'family' | 'pharmacist' | 'caregiver';
export interface ReviewRecord {
  basis: string;
  change: string;
  revision: number;
}
export interface HandoffState {
  task: HandoffTask;
  materials: Material[];
  view: View;
  sharedMembers: string[];
  sharingEnabled: boolean;
  revision: number;
  reviews: Record<string, ReviewRecord>;
  publishedRevision: number | null;
  pharmacistName: string;
  verifiedAt: string | null;
  feedback: 'NONE' | 'UNDERSTOOD' | 'QUESTION';
  question: string;
  explanation: string;
  feedbackAt: string | null;
  familyNote: string;
  familyNoteIsDemo: boolean;
  draftReady: boolean;
}
