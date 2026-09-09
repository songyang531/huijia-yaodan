'use client';
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useHandoff } from '@/context/handoff-context';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
type ModelContext = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function WebMCP() {
  const { state, send } = useHandoff();
  const ref = useRef(state);
  ref.current = state;
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      {
        name: 'get_handoff_progress',
        description: '读取演示流程进度和待核对数量，不返回个人信息或材料。',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => ({
          stage: ref.current.task.taskStage,
          view: ref.current.view,
          unconfirmed: ref.current.task.medications.filter(
            (m) => m.status !== 'PHARMACIST_VERIFIED',
          ).length,
        }),
      },
      {
        name: 'navigate_handoff_view',
        description:
          '切换家庭、药师或照护者演示视角；不会核对药物或生成交接单。',
        inputSchema: {
          type: 'object',
          properties: {
            view: {
              type: 'string',
              enum: ['family', 'pharmacist', 'caregiver'],
            },
          },
          required: ['view'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input) => {
          if (
            !input ||
            typeof input !== 'object' ||
            !('view' in input) ||
            !['family', 'pharmacist', 'caregiver'].includes(String(input.view))
          )
            throw new Error('无效视角');
          const view = input.view as 'family' | 'pharmacist' | 'caregiver';
          flushSync(() => send({ type: 'VIEW', view }));
          return { view };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional browser capability. */
      }
    }
    return () => lifecycle.abort();
  }, [send]);
  return null;
}
