export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Realtime Collaborative Editor</h1>
      <p>Web app is running. Connects to API at NEXT_PUBLIC_API_URL.</p>
      <div style={{ marginTop: 12 }}>
        <a href="/workspaces">Manage Workspaces</a> | <a href="/sessions">Sessions</a> |{' '}
        <a href="/protected">Protected</a>
      </div>
    </main>
  );
}
