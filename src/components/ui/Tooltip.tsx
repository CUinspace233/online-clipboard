'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

export function TooltipProvider({
  delayDuration = 300,
  ...props
}: TooltipPrimitive.TooltipProviderProps) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

interface TooltipProps {
  label: string;
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ label, children, side = 'top' }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-xs rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-md animate-tooltip-in"
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-gray-900" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

interface TooltipIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: string;
  variant?: 'default' | 'danger' | 'neutral';
  children: ReactNode;
}

const variantClasses = {
  default: 'text-gray-600 hover:text-blue-600 hover:bg-blue-50',
  danger: 'text-gray-600 hover:text-red-600 hover:bg-red-50',
  neutral: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
} as const;

export function TooltipIconButton({
  tooltip,
  variant = 'default',
  className = '',
  children,
  type = 'button',
  disabled,
  ...props
}: TooltipIconButtonProps) {
  return (
    <Tooltip label={tooltip}>
      <span className="inline-flex">
        <button
          type={type}
          disabled={disabled}
          className={`rounded-lg p-2 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
          {...props}
        >
          {children}
        </button>
      </span>
    </Tooltip>
  );
}
