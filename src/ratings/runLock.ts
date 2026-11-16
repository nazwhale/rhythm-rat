const name = (id: string) => `rhythm-rat:run:${id}`
// Other tabs recover deferred losses only once the owner releases its lock,
// including the browser's automatic release on refresh or tab close.
export async function holdRun(id: string): Promise<() => Promise<void>> {
  if (!navigator.locks) throw new Error('Rated play needs a browser with Web Locks support. Unrated play is available.')
  let unlock!: () => void
  let entered!: () => void
  let failed!: (error: unknown) => void
  const granted = new Promise<void>((resolve,reject) => { entered=resolve; failed=reject })
  const held = navigator.locks.request(name(id), () => new Promise<void>(resolve => { unlock=resolve; entered() }))
  void held.catch(failed)
  await granted
  return async () => { unlock(); await held }
}
export async function withAvailableRun(id: string, save: () => Promise<void>) {
  if (!navigator.locks) throw new Error('Saving rated results needs Web Locks support in this browser.')
  await navigator.locks.request(name(id), { ifAvailable: true }, async lock => { if (lock) await save() })
}
