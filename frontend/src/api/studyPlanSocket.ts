const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000';

export type StudyPlanRequest = {
  assignmentTitle: string;
  difficultTopic: string;
  minutes: number;
};

export type StudyPlanEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; source: 'model' | 'template' }
  | { type: 'error'; message: string };

/**
 * Opens a WebSocket to /ws/study-plan, sends one request, and streams the
 * response token-by-token via onEvent. Returns a cleanup function that closes
 * the socket (call it on unmount or before starting another request).
 */
export function requestStudyTask(
  request: StudyPlanRequest,
  handlers: {
    onEvent: (event: StudyPlanEvent) => void;
    onClose?: (code: number, reason: string) => void;
  },
): () => void {
  const socket = new WebSocket(`${WS_BASE_URL}/ws/study-plan`);

  socket.onopen = () => socket.send(JSON.stringify(request));

  socket.onmessage = (event) => {
    try {
      handlers.onEvent(JSON.parse(event.data as string) as StudyPlanEvent);
    } catch {
      handlers.onEvent({ type: 'error', message: 'Received an unreadable response' });
    }
  };

  socket.onerror = () => handlers.onEvent({ type: 'error', message: 'Connection error' });
  socket.onclose = (event) => handlers.onClose?.(event.code, event.reason);

  return () => socket.close();
}
