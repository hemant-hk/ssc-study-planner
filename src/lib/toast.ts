let listeners: ((message: string, type: "success" | "error") => void)[] = [];
let currentMessage: string | null = null;
let currentType: "success" | "error" = "success";
let timer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, type: "success" | "error" = "success") {
  currentMessage = message;
  currentType = type;
  listeners.forEach((fn) => fn(message, type));
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    currentMessage = null;
    listeners.forEach((fn) => fn("", "success"));
  }, 2500);
}

export function getToastState() {
  return { message: currentMessage, type: currentType };
}

export function subscribeToast(fn: (message: string, type: "success" | "error") => void) {
  listeners.push(fn);
  if (currentMessage) fn(currentMessage, currentType);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}