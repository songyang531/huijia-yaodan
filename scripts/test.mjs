import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

// Compile a small real-module graph; tests exercise the same state machine and API.
const out = resolve('work/test-runtime');
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'package.json'), '{"type":"commonjs"}');
for (const file of [
  'lib/mock-data.ts',
  'lib/workflow.ts',
  'lib/ai/prompt.ts',
  'lib/ai/schema.ts',
  'lib/ai/normalize.ts',
  'app/api/extract/route.ts',
]) {
  let code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  code = code.replace(
    /require\("@\/([^\"]+)"\)/g,
    (_, path) => `require(${JSON.stringify(resolve(out, path + '.js'))})`,
  );
  const destination = resolve(out, file.replace(/\.ts$/, '.js'));
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, code);
}
const require = createRequire(import.meta.url);
const { createInitialState, MOCK_MEDICATIONS, MOCK_MATERIALS } = require(
  resolve(out, 'lib/mock-data.js'),
);
const { transition, publishBlocker, hasCurrentHandoff } = require(
  resolve(out, 'lib/workflow.js'),
);
const { normalizeExtraction } = require(resolve(out, 'lib/ai/normalize.js'));
const { POST } = require(resolve(out, 'app/api/extract/route.js'));
const now = '2026-09-09T10:00:00.000Z';
const draft = () => {
  const s = createInitialState();
  return transition(s, {
    type: 'EXTRACT',
    medications: MOCK_MEDICATIONS,
    expectedRevision: s.revision,
  });
};
function reviewed() {
  let s = draft();
  for (const m of s.task.medications) {
    s = transition(s, {
      type: 'EDIT_MED',
      id: m.id,
      patch: { dosage: '测试用法文本，仅用于自动化断言' },
    });
    s = transition(s, {
      type: 'EDIT_REVIEW',
      id: m.id,
      field: 'basis',
      value: '测试核对依据，非真实医嘱',
    });
    s = transition(s, {
      type: 'STATUS',
      id: m.id,
      status: 'PHARMACIST_VERIFIED',
    });
  }
  return transition(s, { type: 'PHARMACIST', name: '测试核对人' });
}
const rawItem = {
  name: '演示药物',
  dosage: '原文用法',
  source: 'DOCTOR_NOTE',
  status: 'PENDING_AI',
  aiRemark: '',
  materialIds: ['discharge'],
  isUnclear: false,
  hasMismatch: false,
  isAbsentFromDischarge: false,
  doctorExplicit: true,
};
const normalize = (patch = {}) =>
  normalizeExtraction(
    { medications: [{ ...rawItem, ...patch }] },
    MOCK_MATERIALS,
  )[0];
const request = (body, extra = {}) =>
  new Request('http://localhost/api/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('Mock has conflict, missing dosage, pending review, mandatory source/date', () => {
  const s = createInitialState();
  assert.equal(s.task.isShared, false);
  assert.ok(s.task.medications.some((m) => m.status === 'PENDING_AI'));
  assert.equal(
    s.task.medications.filter((m) => m.status === 'CONFLICT_DETECTED').length,
    3,
  );
  assert.ok(s.materials.every((m) => m.date && m.source && m.url));
});
test('view changes never advance workflow or enable sharing', () => {
  const s = transition(createInitialState(), {
    type: 'VIEW',
    view: 'caregiver',
  });
  assert.equal(s.task.taskStage, 'FAMILY_INPUT');
  assert.equal(hasCurrentHandoff(s), false);
  assert.equal(s.task.isShared, false);
});
test('sharing requires an explicit member and revocation clears members', () => {
  let s = transition(createInitialState(), { type: 'SHARING', enabled: true });
  assert.equal(s.task.isShared, false);
  s = transition(s, { type: 'MEMBER', member: 'caregiver', selected: true });
  assert.equal(s.task.isShared, true);
  s = transition(s, { type: 'SHARING', enabled: false });
  assert.equal(s.task.isShared, false);
  assert.deepEqual(s.sharedMembers, []);
});
test('unconfirmed item blocks publication', () => {
  const s = draft();
  assert.match(publishBlocker(s), /未完成核对/);
  assert.throws(() => transition(s, { type: 'PUBLISH', now }));
});
test('unknown dosage and missing review evidence block verification', () => {
  let s = draft();
  assert.throws(() =>
    transition(s, {
      type: 'STATUS',
      id: 'med-2',
      status: 'PHARMACIST_VERIFIED',
    }),
  );
  s = transition(s, {
    type: 'EDIT_MED',
    id: 'med-2',
    patch: { dosage: '人工测试文本' },
  });
  assert.throws(() =>
    transition(s, {
      type: 'STATUS',
      id: 'med-2',
      status: 'PHARMACIST_VERIFIED',
    }),
  );
});
test('complete review permits handoff and caregiver acknowledgement', () => {
  let s = reviewed();
  assert.equal(publishBlocker(s), null);
  s = transition(s, { type: 'PUBLISH', now });
  assert.equal(hasCurrentHandoff(s), true);
  s = transition(s, { type: 'FEEDBACK', feedback: 'UNDERSTOOD', now });
  assert.equal(s.feedback, 'UNDERSTOOD');
  assert.equal(s.task.taskStage, 'CAREGIVER_CONFIRM');
});
test('editing a verified item invalidates its review, handoff, and receipt', () => {
  let s = transition(reviewed(), { type: 'PUBLISH', now });
  s = transition(s, { type: 'FEEDBACK', feedback: 'UNDERSTOOD', now });
  s = transition(s, {
    type: 'EDIT_MED',
    id: 'med-1',
    patch: { dosage: '新的测试文本' },
  });
  assert.equal(hasCurrentHandoff(s), false);
  assert.equal(s.feedback, 'NONE');
  assert.equal(s.task.medications[0].status, 'PENDING_AI');
  assert.equal(s.task.medications[1].status, 'PHARMACIST_VERIFIED');
});
test('new materials invalidate extraction, clear old medicines, preserve URL model', () => {
  let s = reviewed();
  s = transition(s, {
    type: 'MATERIAL_ADD',
    material: { ...MOCK_MATERIALS[0], id: 'new' },
  });
  assert.equal(s.draftReady, false);
  assert.equal(s.task.medications.length, 0);
  assert.equal(s.task.materials.length, 3);
  assert.equal(s.task.taskStage, 'FAMILY_INPUT');
});
test('stale async extraction cannot overwrite edited material', () => {
  const initial = createInitialState();
  const changed = transition(initial, { type: 'FAMILY_NOTE', value: '补充' });
  assert.throws(
    () =>
      transition(changed, {
        type: 'EXTRACT',
        medications: MOCK_MEDICATIONS,
        expectedRevision: initial.revision,
      }),
    /变化/,
  );
});
test('reset keeps revisions monotonic and rejects responses from the previous session', () => {
  const old = createInitialState();
  let s = transition(old, { type: 'RESET' });
  s = transition(s, {
    type: 'MATERIAL_ADD',
    material: { ...MOCK_MATERIALS[0], id: 'new' },
  });
  assert.ok(s.revision > old.revision);
  assert.throws(
    () =>
      transition(s, {
        type: 'EXTRACT',
        medications: MOCK_MEDICATIONS,
        expectedRevision: old.revision,
      }),
    /变化/,
  );
});
test('real uploads discard default fictional notes but retain user-entered notes', () => {
  const material = { ...MOCK_MATERIALS[0], id: 'real', isDemo: false };
  const s = transition(createInitialState(), {
    type: 'MATERIAL_ADD',
    material,
  });
  assert.equal(s.familyNote, '');
  const authored = transition(createInitialState(), {
    type: 'FAMILY_NOTE',
    value: '我填写的口述',
  });
  assert.equal(
    transition(authored, { type: 'MATERIAL_ADD', material }).familyNote,
    '我填写的口述',
  );
});
test('medication changes clear stale explanations', () => {
  const s = { ...reviewed(), explanation: '旧的频率说明' };
  assert.equal(
    transition(s, {
      type: 'EDIT_MED',
      id: 'med-1',
      patch: { dosage: '新的频率' },
    }).explanation,
    '',
  );
});
test('question returns to pharmacist; explanation and new receipt are required', () => {
  let s = transition(reviewed(), { type: 'PUBLISH', now });
  s = transition(s, {
    type: 'FEEDBACK',
    feedback: 'QUESTION',
    question: '频率不清楚',
    now,
  });
  assert.equal(s.view, 'pharmacist');
  assert.equal(s.question, '频率不清楚');
  assert.equal(hasCurrentHandoff(s), false);
  assert.match(publishBlocker(s), /重新解释/);
  s = transition(s, {
    type: 'EXPLANATION',
    value: '请查看本次已核对安排中的频率说明。',
  });
  s = transition(s, { type: 'PUBLISH', now });
  assert.equal(s.feedback, 'NONE');
  assert.equal(hasCurrentHandoff(s), true);
});
test('AI may never return PHARMACIST_VERIFIED', () => {
  assert.throws(() => normalize({ status: 'PHARMACIST_VERIFIED' }));
  assert.throws(() =>
    transition(createInitialState(), {
      type: 'EXTRACT',
      expectedRevision: 1,
      medications: [{ ...MOCK_MEDICATIONS[0], status: 'PHARMACIST_VERIFIED' }],
    }),
  );
});
test('unclear, mismatch, absent old medicines remain explicit conflicts', () => {
  for (const flag of ['isUnclear', 'hasMismatch', 'isAbsentFromDischarge']) {
    const med = normalize({ [flag]: true });
    assert.equal(med.status, 'CONFLICT_DETECTED');
    assert.match(med.dosage, /待确认/);
  }
});
test('source is derived from provided evidence, not model claim', () => {
  const m = normalize({
    materialIds: ['boxes'],
    source: 'DOCTOR_NOTE',
    doctorExplicit: true,
  });
  assert.equal(m.source, 'FAMILY_UPLOAD');
  assert.equal(m.status, 'CONFLICT_DETECTED');
  assert.match(m.dosage, /待确认/);
  assert.throws(() => normalize({ materialIds: ['invented'] }));
});
test('treatment conclusions are quarantined, not shown as instructions', () => {
  const m = normalize({ dosage: '建议停用旧药，改用新药' });
  assert.equal(m.status, 'CONFLICT_DETECTED');
  assert.doesNotMatch(m.dosage, /停用|改用/);
  assert.match(m.aiRemark, /隔离/);
});
test('missing fields and unknown name cannot become clear AI output', () => {
  const m = normalize({ name: '', dosage: '' });
  assert.equal(m.status, 'CONFLICT_DETECTED');
  assert.match(m.name, /待确认/);
});
test('API demo works with no keys and has no verified medications', async () => {
  const r = await POST(request({ mode: 'demo' }));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const json = await r.json();
  assert.equal(json.mode, 'demo');
  assert.equal(json.medications.length, 4);
  assert.ok(json.medications.every((m) => m.status !== 'PHARMACIST_VERIFIED'));
});
test('API rejects invalid JSON, wrong origin, extra properties, and unconsented images', async () => {
  assert.equal((await POST(request('{'))).status, 400);
  assert.equal(
    (
      await POST(
        request({ mode: 'demo' }, { origin: 'https://untrusted.example' }),
      )
    ).status,
    403,
  );
  assert.equal(
    (await POST(request({ mode: 'demo', image: 'private' }))).status,
    400,
  );
  assert.equal(
    (await POST(request({ mode: 'live', consent: false, materials: [] })))
      .status,
    400,
  );
});
test('API never treats unavailable live extraction as demo OCR', async () => {
  const before = process.env.ENABLE_LIVE_AI;
  process.env.ENABLE_LIVE_AI = 'false';
  try {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    const r = await POST(
      request({
        mode: 'live',
        consent: true,
        familyNote: '',
        materials: [
          {
            id: 'test',
            name: 'test.png',
            source: 'DOCTOR_NOTE',
            date: '2026-09-09',
            kind: 'DISCHARGE',
            isDemo: false,
            url: png,
          },
        ],
      }),
    );
    assert.equal(r.status, 503);
    assert.equal((await r.json()).medications, undefined);
  } finally {
    if (before === undefined) delete process.env.ENABLE_LIVE_AI;
    else process.env.ENABLE_LIVE_AI = before;
  }
});
