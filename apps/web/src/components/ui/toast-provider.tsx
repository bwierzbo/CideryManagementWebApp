"use client";

import * as React from "react";
import { createContext, useContext, useReducer } from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
  getToastIcon,
} from "./toast";

export interface ToastState {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive" | "success" | "warning" | "info";
  duration?: number;
}

type ToastAction =
  | { type: "ADD_TOAST"; toast: ToastState }
  | { type: "UPDATE_TOAST"; id: string; toast: Partial<ToastState> }
  | { type: "DISMISS_TOAST"; id: string }
  | { type: "REMOVE_TOAST"; id: string };

interface ToastContextValue {
  toasts: ToastState[];
  toast: (props: Omit<ToastState, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

function toastReducer(state: ToastState[], action: ToastAction): ToastState[] {
  switch (action.type) {
    case "ADD_TOAST":
      return [...state, action.toast];

    case "UPDATE_TOAST":
      return state.map((t) =>
        t.id === action.id ? { ...t, ...action.toast } : t,
      );

    case "DISMISS_TOAST": {
      const { id } = action;
      return state.map((t) =>
        t.id === id || id === undefined
          ? {
              ...t,
              duration: 0,
            }
          : t,
      );
    }

    case "REMOVE_TOAST":
      return state.filter((t) => t.id !== action.id);
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const toast = React.useCallback(({ ...props }: Omit<ToastState, "id">) => {
    const id = genId();

    const update = (props: Partial<ToastState>) =>
      dispatch({
        type: "UPDATE_TOAST",
        id,
        toast: props,
      });

    const dismiss = () => dispatch({ type: "DISMISS_TOAST", id });

    dispatch({
      type: "ADD_TOAST",
      toast: {
        ...props,
        id,
        duration: props.duration ?? 5000,
      },
    });

    return {
      id,
      dismiss,
      update,
    };
  }, []);

  const dismiss = React.useCallback((id: string) => {
    dispatch({
      type: "DISMISS_TOAST",
      id,
    });
  }, []);

  React.useEffect(() => {
    toasts.forEach((toast) => {
      if (toast.duration && toast.duration > 0) {
        setTimeout(() => {
          dispatch({ type: "REMOVE_TOAST", id: toast.id });
        }, toast.duration);
      }
    });
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastState[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map((toast) => {
        const icon = getToastIcon(toast.variant || null);
        return (
          <Toast
            key={toast.id}
            variant={toast.variant}
            className="animate-in slide-in-from-top-full duration-300 sm:slide-in-from-bottom-full"
          >
            <div className="flex items-start space-x-3">
              {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
              <div className="flex-1 space-y-1">
                {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
                {toast.description && (
                  <ToastDescription>{toast.description}</ToastDescription>
                )}
              </div>
            </div>
            {toast.action}
            <ToastClose onClick={() => onDismiss(toast.id)} />
          </Toast>
        );
      })}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}
