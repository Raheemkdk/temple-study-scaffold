export type Assignment = {
  id: string;
  title: string;
  dueAt: string;
  sourceDate: string | null;
  dateOnly: boolean;
  completed: boolean;
};

export type EventResponse = {
  assignments: Assignment[];
  lastSyncedAt: string | null;
  hasCanvasFeed: boolean;
};

export type UserSummary = {
  id: string;
  email: string;
};
