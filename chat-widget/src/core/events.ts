/**
 * Simple typed event emitter
 */

type EventHandler<T = unknown> = (data: T) => void

export class EventEmitter<EventMap extends Record<string, unknown>> {
  private listeners: Map<keyof EventMap, Set<EventHandler>> = new Map()

  /**
   * Subscribe to an event
   */
  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as EventHandler)

    // Return unsubscribe function
    return () => this.off(event, handler)
  }

  /**
   * Subscribe to an event once
   */
  once<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): () => void {
    const wrappedHandler: EventHandler<EventMap[K]> = (data) => {
      this.off(event, wrappedHandler)
      handler(data)
    }
    return this.on(event, wrappedHandler)
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>
  ): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler as EventHandler)
    }
  }

  /**
   * Emit an event
   */
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data)
        } catch (error) {
          console.error(`[ChatWidget] Error in event handler for "${String(event)}":`, error)
        }
      })
    }
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }
}
