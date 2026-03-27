import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, side = 'top' }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Content
          side={side}
          className={cn(
            'z-50 rounded-md bg-bg-active px-2.5 py-1.5 text-xs text-text-primary shadow-lg border border-border-primary',
            'animate-in fade-in-0 zoom-in-95',
          )}
          sideOffset={5}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
