// Serializes async sends per key so independent, concurrently-fired requests
// (e.g. one per hardware keystroke) reach the far end in enqueue order. Each
// send is otherwise a standalone fire-and-forget RPC with no ordering
// guarantee between requests in flight at once — held/fast typing can race
// two sends and land bytes at the PTY transposed. Chaining each new send onto
// the previous one's settlement (success or failure) for the same key
// guarantees only one is ever in flight and they resolve in order.
export function createKeyedSendSequencer<T>(
  send: (key: string, value: T) => Promise<unknown>
): (key: string, value: T) => void {
  const chains = new Map<string, Promise<unknown>>()
  return (key: string, value: T) => {
    const previous = chains.get(key) ?? Promise.resolve()
    const next = previous.then(() => send(key, value))
    chains.set(key, next.catch(() => undefined))
  }
}
