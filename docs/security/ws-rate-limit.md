# WebSocket Rate Limiting

Use `allowWsMessage(redis, keyId)` from `api/src/common/ws-rate.ts` in your gateway handlers to enforce 10 messages/sec per user/IP.

Example (NestJS Gateway):

```
@SubscribeMessage('message')
async onMessage(@ConnectedSocket() socket: Socket, @MessageBody() body: any) {
  const userId = socket.data.userId || socket.id;
  const ok = await allowWsMessage(this.redis, userId);
  if (!ok) return; // optionally emit warning or drop
  // handle message
}
```

Configure via env: `WS_MSGS_PER_SEC`.
