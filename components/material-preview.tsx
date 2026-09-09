'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SOURCE_LABELS } from '@/lib/mock-data';
import type { Material } from '@/types/handoff';

export function MaterialPreview({
  material,
  compact = false,
}: {
  material: Material;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? 'w-[112px] shrink-0 text-left'
            : 'flex min-w-0 flex-1 items-center gap-3 text-left'
        }
        aria-label={`查看${material.name}原始材料`}
      >
        <div
          className={
            compact
              ? 'h-[94px] overflow-hidden rounded-lg border bg-slate-50'
              : 'material-thumb'
          }
        >
          <img
            src={material.url}
            alt={material.name}
            className="h-full w-full object-cover object-top"
          />
        </div>
        <div className="min-w-0">
          <p
            className={
              compact
                ? 'mt-2 truncate text-sm font-medium'
                : 'font-medium text-base'
            }
          >
            {material.name}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {material.date}
          </p>
          <span
            className={`source-tag !ml-0 mt-1 ${material.source === 'FAMILY_UPLOAD' ? 'family' : ''}`}
          >
            {SOURCE_LABELS[material.source]}
          </span>
        </div>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88dvh] overflow-auto">
          <DialogTitle>{material.name}</DialogTitle>
          <DialogDescription>
            {material.date} · {SOURCE_LABELS[material.source]}
            {material.isDemo ? ' · 虚构演示材料' : ''}
          </DialogDescription>
          <img
            src={material.url}
            alt={`${material.name}完整原图`}
            className="w-full rounded-lg border"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
