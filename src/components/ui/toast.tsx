"use client";

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

/**
 * Toast component that wraps sonner's Toaster with shadcn-style theming.
 * Position: bottom-right on desktop, top-center on mobile.
 * Auto-dismiss after 5 seconds.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="light"
      richColors
      closeButton
      duration={5000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-lg rounded-md",
          description:
            "group-[.toast]:text-muted-foreground text-sm",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:text-muted-foreground hover:group-[.toast]:text-foreground",
        },
      }}
    />
  );
}

/**
 * Typed toast helpers for different toast types.
 * Matches sonner's API with shadcn styling.
 */
export const toast = {
  success: (message: string, options?: Parameters<typeof sonnerToast.success>[1]) =>
    sonnerToast.success(message, { duration: 5000, ...options }),

  error: (message: string, options?: Parameters<typeof sonnerToast.error>[1]) =>
    sonnerToast.error(message, { duration: 5000, ...options }),

  warning: (message: string, options?: Parameters<typeof sonnerToast.warning>[1]) =>
    sonnerToast.warning(message, { duration: 5000, ...options }),

  info: (message: string, options?: Parameters<typeof sonnerToast.info>[1]) =>
    sonnerToast(message, { duration: 5000, ...options }),

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    },
    options?: Parameters<typeof sonnerToast.promise>[2]
  ) =>
    sonnerToast.promise(promise, messages, { duration: 5000, ...options }),

  /**
   * Custom toast with action button
   */
  action: (
    message: string,
    actionLabel: string,
    onAction: () => void,
    options?: Parameters<typeof sonnerToast>[1]
  ) =>
    sonnerToast(message, {
      action: {
        label: actionLabel,
        onClick: onAction,
      },
      duration: 5000,
      ...options,
    }),

  /**
   * Dismiss all toasts
   */
  dismiss: sonnerToast.dismiss,

  /**
   * Remove a specific toast by ID
   */
  remove: (toastId: string | number) => sonnerToast.dismiss(toastId),
};
