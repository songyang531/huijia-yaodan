import type { Material, MedicationItem } from '../../types/handoff';
import { extractionSchema } from './schema';

// Conservative quarantine supplements the prompt; it is not a clinical classifier.
const TREATMENT_ACTION =
  /停药|停用|换药|改用|加量|减量|增加剂量|减少剂量|替换药|调整剂量|discontinue|switch\s+to|stop\s+(taking|using)/i;
const UNKNOWN = /待确认|未确认|不详|不清|未知|无法|模糊|[?？]/;

export function normalizeExtraction(
  raw: unknown,
  materials: Pick<Material, 'id' | 'source'>[],
): MedicationItem[] {
  const parsed = extractionSchema.parse(raw);
  return parsed.medications.map((item, index) => {
    const refs = item.materialIds.map((id) => {
      const material = materials.find((m) => m.id === id);
      if (!material) throw new Error('模型引用了不存在的材料。');
      return material;
    });
    const doctorExplicit =
      item.doctorExplicit && refs.some((m) => m.source === 'DOCTOR_NOTE');
    const source = doctorExplicit ? 'DOCTOR_NOTE' : 'FAMILY_UPLOAD';
    const quarantined = TREATMENT_ACTION.test(
      [item.name, item.dosage, item.aiRemark].join(' '),
    );
    const conflict =
      quarantined ||
      !doctorExplicit ||
      !item.name.trim() ||
      UNKNOWN.test(item.name) ||
      !item.dosage.trim() ||
      UNKNOWN.test(item.dosage) ||
      item.isUnclear ||
      item.hasMismatch ||
      item.isAbsentFromDischarge ||
      item.status === 'CONFLICT_DETECTED';
    const remarks = [
      quarantined
        ? '模型输出包含治疗调整表述，已隔离；请药师核对原始材料。'
        : item.aiRemark,
      item.isUnclear ? '图片信息不清晰。' : '',
      item.hasMismatch ? '材料之间或家属口述与材料不一致。' : '',
      item.isAbsentFromDischarge
        ? '家中药品未见于本次出院单，不能据此判断停用。'
        : '',
      !doctorExplicit ? '医生原始文件未明确指定，待确认。' : '',
      !refs.length
        ? '缺少图片证据，请核对家属口述。'
        : `证据材料：${item.materialIds.join('、')}。`,
    ]
      .filter(Boolean)
      .join(' ');
    let dosage = quarantined
      ? '待确认：需人工核对原始材料'
      : item.dosage.trim() || '待确认：用法未提取到';
    if (conflict && !dosage.startsWith('待确认')) dosage = `待确认：${dosage}`;
    return {
      id: `ai-${index + 1}`,
      name:
        quarantined && TREATMENT_ACTION.test(item.name)
          ? '待确认药物'
          : item.name.trim() || '待确认药物',
      dosage,
      source,
      status: conflict ? 'CONFLICT_DETECTED' : 'PENDING_AI',
      aiRemark: remarks || '已整理原文，等待药师核对。',
    };
  });
}
