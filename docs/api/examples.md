# API Usage Examples

Auth
- Login:
```
curl -sX POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"pass"}'
```
- OAuth (dev):
```
curl -sX POST $API/api/auth/oauth -H 'Content-Type: application/json' \
  -d '{"provider":"dev","email":"user@example.com"}'
```

Workspace + Document
```
TOKEN=...
curl -sX POST $API/api/workspaces -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"WS","slug":"ws"}'

WS=...
curl -sX POST $API/api/docs -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"workspaceId":"'$WS'","title":"Doc"}'
```

Comments
```
DOC=...
curl -sX POST $API/comments -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"documentId":"'$DOC'","text":"Hello"}'
```

Search
```
curl -s "$API/api/search/docs?workspaceId=$WS&limit=20" -H "Authorization: Bearer $TOKEN"
```
