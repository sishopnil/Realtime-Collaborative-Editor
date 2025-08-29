export type ClientUser = { id: string; email: string; name?: string };

export type JoinRoomPayload = {
  documentId: string;
};

export type YUpdatePayload = {
  documentId: string;
  updateB64: string; // base64-encoded Yjs update (gzipped allowed)
  msgId?: string; // for dedup/ack
  seq?: number; // per-sender monotonic sequence
};

export type TextMessagePayload = {
  documentId: string;
  content: string;
  msgId?: string;
  seq?: number;
};

export type YSyncPayload = {
  documentId: string;
  vectorB64?: string; // client state vector in base64
};

export type PresencePayload = {
  documentId: string;
  anchor: number;
  head: number;
  typing?: boolean;
};
