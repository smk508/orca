import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { isHardwareKeyboardConnected, type NativeKeyEvent } from '@orca/expo-hardware-keyboard'
import { nativeKeyEventToBytes } from './terminal-hardware-key'
import { createKeyedSendSequencer } from './terminal-hardware-key-send-sequencer'
import type { TerminalLiveInputSender } from './terminal-live-input-sender'

// Why: the native module may be absent in a shell built before it shipped
// (Expo Go, an older dev client); treat that as "no hardware keyboard" rather
// than letting the throw crash the whole session screen's first render.
function probeHardwareKeyboardConnected(): boolean {
  try {
    return isHardwareKeyboardConnected()
  } catch {
    return false
  }
}

type UseHardwareKeyInputOptions = {
  readonly activeHandle: string | null
  readonly liveInputEnabled: boolean
  readonly liveInputTerminalHandlesRef: RefObject<Set<string>>
  readonly sendLiveTerminalInputRef: RefObject<TerminalLiveInputSender>
}

type UseHardwareKeyInputResult = {
  readonly handleNativeKey: (event: { nativeEvent: NativeKeyEvent }) => void
  readonly hardwareKeyboardConnected: boolean
}

// Backs the "physical keyboard attached" branch of live input: tracks whether
// a hardware keyboard is connected (there's no attach/detach push event, so
// it's polled) and forwards captured key events to the PTY in order.
export function useHardwareKeyInput({
  activeHandle,
  liveInputEnabled,
  liveInputTerminalHandlesRef,
  sendLiveTerminalInputRef
}: UseHardwareKeyInputOptions): UseHardwareKeyInputResult {
  const [hardwareKeyboardConnected, setHardwareKeyboardConnected] = useState(
    probeHardwareKeyboardConnected
  )

  useEffect(() => {
    if (!liveInputEnabled) {
      return
    }
    const probe = () => setHardwareKeyboardConnected(probeHardwareKeyboardConnected())
    let interval: ReturnType<typeof setInterval> | null = null
    const startPolling = () => {
      if (interval) {
        return
      }
      interval = setInterval(probe, 1000)
    }
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }
    probe()
    // Why: gate polling on foreground state — a backgrounded app has no reason
    // to keep waking every second for a query with no attach/detach event.
    if (AppState.currentState === 'active') {
      startPolling()
    }
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        probe()
        startPolling()
      } else {
        stopPolling()
      }
    })
    return () => {
      stopPolling()
      sub.remove()
    }
  }, [liveInputEnabled])

  const enqueueSendRef = useRef<((handle: string, bytes: string) => void) | undefined>(undefined)
  if (!enqueueSendRef.current) {
    enqueueSendRef.current = createKeyedSendSequencer<string>((handle, bytes) =>
      sendLiveTerminalInputRef.current(handle, bytes)
    )
  }

  const handleNativeKey = useCallback(
    (event: { nativeEvent: NativeKeyEvent }) => {
      if (!activeHandle || !liveInputTerminalHandlesRef.current.has(activeHandle)) {
        return
      }
      const bytes = nativeKeyEventToBytes(event.nativeEvent)
      if (!bytes) {
        return
      }
      enqueueSendRef.current?.(activeHandle, bytes)
    },
    [activeHandle, liveInputTerminalHandlesRef]
  )

  return { handleNativeKey, hardwareKeyboardConnected }
}
