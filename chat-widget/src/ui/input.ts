/**
 * Message input component
 */

import { createElement, on, debounce } from '../utils/dom'
import { sanitizeInput } from '../utils/escape'
import { saveDraft, loadDraft, clearDraft } from '../utils/storage'
import { icons } from './icons'
import { validateFile, isImage, formatFileSize, getAcceptAttribute } from '../utils/file-validation'

export interface ChatInputOptions {
  placeholder?: string
  maxLength?: number
  onSend?: (text: string) => void
  onTyping?: (isTyping: boolean) => void
  onFileSelect?: (file: File) => void
  onFileSend?: (file: File) => Promise<void>
  enableDraft?: boolean
  enableFileUpload?: boolean
}

export class ChatInput {
  private element: HTMLElement
  private textarea: HTMLTextAreaElement
  private sendButton: HTMLButtonElement
  private attachButton: HTMLButtonElement | null = null
  private fileInput: HTMLInputElement | null = null
  private previewContainer: HTMLElement | null = null
  private selectedFile: File | null = null
  private isTyping = false
  private typingTimeout: ReturnType<typeof setTimeout> | null = null
  private unsubscribe: (() => void)[] = []

  constructor(private options: ChatInputOptions = {}) {
    this.element = this.createContainer()
    this.textarea = this.element.querySelector('.chat-input__field') as HTMLTextAreaElement
    this.sendButton = this.element.querySelector('.chat-input__send') as HTMLButtonElement
    this.attachButton = this.element.querySelector('.chat-input__attach') as HTMLButtonElement
    this.fileInput = this.element.querySelector('.chat-input__file') as HTMLInputElement
    this.previewContainer = this.element.querySelector('.chat-input__preview') as HTMLElement
    this.setupEventListeners()
    this.loadDraftMessage()
  }

  /**
   * Get container element
   */
  getElement(): HTMLElement {
    return this.element
  }

  /**
   * Focus input
   */
  focus(): void {
    this.textarea.focus()
  }

  /**
   * Clear input
   */
  clear(): void {
    this.textarea.value = ''
    this.updateSendButton()
    this.adjustHeight()
    if (this.options.enableDraft !== false) {
      clearDraft()
    }
  }

  /**
   * Set input value
   */
  setValue(text: string): void {
    this.textarea.value = text
    this.updateSendButton()
    this.adjustHeight()
  }

  /**
   * Get input value
   */
  getValue(): string {
    return this.textarea.value.trim()
  }

  /**
   * Disable input
   */
  disable(): void {
    this.textarea.disabled = true
    this.sendButton.disabled = true
  }

  /**
   * Enable input
   */
  enable(): void {
    this.textarea.disabled = false
    this.updateSendButton()
  }

  /**
   * Destroy component
   */
  destroy(): void {
    this.saveDraftMessage()
    this.unsubscribe.forEach(fn => fn())
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout)
    }
    this.element.remove()
  }

  private createContainer(): HTMLElement {
    const container = createElement('div', { className: 'chat-input' })

    // File preview container (hidden by default)
    const previewContainer = createElement('div', { className: 'chat-input__preview chat-input__preview--hidden' })
    container.appendChild(previewContainer)

    // Input row
    const inputRow = createElement('div', { className: 'chat-input__row' })

    // Attach button (optional)
    if (this.options.enableFileUpload !== false) {
      const attachBtn = createElement('button', {
        className: 'chat-input__attach',
        type: 'button',
        'aria-label': 'Прикрепить файл'
      }) as HTMLButtonElement

      const attachIconWrapper = document.createElement('div')
      attachIconWrapper.innerHTML = icons.attach
      const attachSvg = attachIconWrapper.firstElementChild
      if (attachSvg) {
        attachBtn.appendChild(attachSvg)
      }

      inputRow.appendChild(attachBtn)

      // Hidden file input
      const fileInput = createElement('input', {
        className: 'chat-input__file',
        type: 'file',
        accept: getAcceptAttribute(),
        'aria-hidden': 'true'
      }) as HTMLInputElement
      inputRow.appendChild(fileInput)
    }

    // Textarea
    const textarea = createElement('textarea', {
      className: 'chat-input__field',
      placeholder: this.options.placeholder || 'Введите сообщение...',
      rows: '1',
      'aria-label': 'Сообщение'
    }) as HTMLTextAreaElement

    if (this.options.maxLength) {
      textarea.setAttribute('maxlength', String(this.options.maxLength))
    }

    inputRow.appendChild(textarea)

    // Send button
    const sendBtn = createElement('button', {
      className: 'chat-input__send',
      type: 'button',
      'aria-label': 'Отправить',
      disabled: 'true'
    }) as HTMLButtonElement

    const iconWrapper = document.createElement('div')
    iconWrapper.innerHTML = icons.send
    const svg = iconWrapper.firstElementChild
    if (svg) {
      sendBtn.appendChild(svg)
    }

    inputRow.appendChild(sendBtn)
    container.appendChild(inputRow)

    return container
  }

  private setupEventListeners(): void {
    // Input handler
    const handleInput = () => {
      this.updateSendButton()
      this.adjustHeight()
      this.handleTypingIndicator()
      this.debouncedSaveDraft()
    }

    const inputUnsub = on(this.textarea, 'input', handleInput)
    this.unsubscribe.push(inputUnsub)

    // Send on button click
    const sendUnsub = on(this.sendButton, 'click', () => this.sendMessage())
    this.unsubscribe.push(sendUnsub)

    // Send on Enter (without Shift)
    const keydownUnsub = on(this.textarea, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })
    this.unsubscribe.push(keydownUnsub)

    // Stop typing on blur
    const blurUnsub = on(this.textarea, 'blur', () => {
      this.stopTyping()
    })
    this.unsubscribe.push(blurUnsub)

    // File upload handlers
    if (this.attachButton && this.fileInput) {
      const attachUnsub = on(this.attachButton, 'click', () => {
        this.fileInput?.click()
      })
      this.unsubscribe.push(attachUnsub)

      const fileUnsub = on(this.fileInput, 'change', () => {
        const file = this.fileInput?.files?.[0]
        if (file) {
          this.handleFileSelect(file)
        }
        // Reset input to allow selecting same file again
        if (this.fileInput) {
          this.fileInput.value = ''
        }
      })
      this.unsubscribe.push(fileUnsub)
    }
  }

  private sendMessage(): void {
    const text = sanitizeInput(this.textarea.value)
    const file = this.selectedFile

    // Nothing to send
    if (!text && !file) return

    // Send file if selected
    if (file && this.options.onFileSend) {
      this.options.onFileSend(file)
        .then(() => {
          // File sent successfully, clear preview
          this.clearFilePreview()
          this.updateSendButton()
        })
        .catch(() => {
          // Error handled in widget, just update button state
          this.updateSendButton()
        })
    }

    // Send text if present
    if (text && this.options.onSend) {
      this.options.onSend(text)
    }

    // Clear text input
    if (text) {
      this.clear()
    }
    this.stopTyping()
  }

  private updateSendButton(): void {
    const hasText = this.textarea.value.trim().length > 0
    const hasFile = this.selectedFile !== null
    this.sendButton.disabled = (!hasText && !hasFile) || this.textarea.disabled
  }

  private adjustHeight(): void {
    // Reset height to get accurate scrollHeight
    this.textarea.style.height = 'auto'

    // Calculate new height
    const maxHeight = 120 // Match CSS max-height
    const newHeight = Math.min(this.textarea.scrollHeight, maxHeight)

    this.textarea.style.height = `${newHeight}px`
  }

  private handleTypingIndicator(): void {
    if (!this.options.onTyping) return

    const hasContent = this.textarea.value.trim().length > 0

    if (hasContent && !this.isTyping) {
      this.isTyping = true
      this.options.onTyping(true)
    }

    // Reset typing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout)
    }

    // Stop typing after 3 seconds of inactivity
    this.typingTimeout = setTimeout(() => {
      this.stopTyping()
    }, 3000)
  }

  private stopTyping(): void {
    if (this.isTyping && this.options.onTyping) {
      this.isTyping = false
      this.options.onTyping(false)
    }

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout)
      this.typingTimeout = null
    }
  }

  private debouncedSaveDraft = debounce(() => {
    this.saveDraftMessage()
  }, 500)

  private saveDraftMessage(): void {
    if (this.options.enableDraft !== false) {
      saveDraft(this.textarea.value)
    }
  }

  private loadDraftMessage(): void {
    if (this.options.enableDraft !== false) {
      const draft = loadDraft()
      if (draft) {
        this.textarea.value = draft
        this.updateSendButton()
        this.adjustHeight()
      }
    }
  }

  /**
   * Handle file selection
   */
  private handleFileSelect(file: File): void {
    const validation = validateFile(file)

    if (!validation.valid) {
      this.showFileError(validation.error ?? 'Ошибка файла')
      return
    }

    this.selectedFile = file
    this.showFilePreview(file)
    this.updateSendButton()

    if (this.options.onFileSelect) {
      this.options.onFileSelect(file)
    }
  }

  /**
   * Show file preview
   */
  private showFilePreview(file: File): void {
    if (!this.previewContainer) return

    this.previewContainer.innerHTML = ''
    this.previewContainer.classList.remove('chat-input__preview--hidden')

    const previewContent = createElement('div', { className: 'chat-input__preview-content' })

    if (isImage(file.type)) {
      // Image preview
      const img = createElement('img', {
        className: 'chat-input__preview-image',
        alt: file.name
      }) as HTMLImageElement

      const reader = new FileReader()
      reader.onload = (e) => {
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)

      previewContent.appendChild(img)
    } else {
      // Document preview - show icon
      const iconWrapper = createElement('div', { className: 'chat-input__preview-icon' })
      iconWrapper.innerHTML = icons.document
      previewContent.appendChild(iconWrapper)
    }

    // File info
    const info = createElement('div', { className: 'chat-input__preview-info' })
    const name = createElement('span', { className: 'chat-input__preview-name' }, [file.name])
    const size = createElement('span', { className: 'chat-input__preview-size' }, [formatFileSize(file.size)])
    info.appendChild(name)
    info.appendChild(size)
    previewContent.appendChild(info)

    // Remove button
    const removeBtn = createElement('button', {
      className: 'chat-input__preview-remove',
      type: 'button',
      'aria-label': 'Удалить файл'
    }) as HTMLButtonElement
    removeBtn.innerHTML = icons.close
    const removeUnsub = on(removeBtn, 'click', () => {
      this.clearFilePreview()
    })
    this.unsubscribe.push(removeUnsub)

    previewContent.appendChild(removeBtn)
    this.previewContainer.appendChild(previewContent)
  }

  /**
   * Clear file preview
   */
  clearFilePreview(): void {
    this.selectedFile = null
    if (this.previewContainer) {
      this.previewContainer.innerHTML = ''
      this.previewContainer.classList.add('chat-input__preview--hidden')
    }
  }

  /**
   * Show file error message
   */
  private showFileError(message: string): void {
    if (!this.previewContainer) return

    this.previewContainer.innerHTML = ''
    this.previewContainer.classList.remove('chat-input__preview--hidden')

    const errorContent = createElement('div', { className: 'chat-input__preview-error' })
    const errorIcon = createElement('span', { className: 'chat-input__preview-error-icon' })
    errorIcon.innerHTML = icons.error
    const errorText = createElement('span', { className: 'chat-input__preview-error-text' }, [message])

    errorContent.appendChild(errorIcon)
    errorContent.appendChild(errorText)
    this.previewContainer.appendChild(errorContent)

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.clearFilePreview()
    }, 3000)
  }

  /**
   * Get selected file (if any)
   */
  getSelectedFile(): File | null {
    return this.selectedFile
  }

  /**
   * Show upload progress
   */
  showUploadProgress(progress: number): void {
    if (!this.previewContainer) return

    const progressBar = this.previewContainer.querySelector('.chat-input__progress-bar') as HTMLElement | null
    if (progressBar) {
      progressBar.style.width = `${progress}%`
    }
  }

  /**
   * Show upload result (success or error)
   */
  showUploadResult(success: boolean): void {
    if (!this.previewContainer) return

    // Add result indicator to progress bar
    const progressBar = this.previewContainer.querySelector('.chat-input__progress-bar') as HTMLElement | null
    if (progressBar) {
      progressBar.style.width = '100%'
      progressBar.classList.add(success ? 'chat-input__progress-bar--success' : 'chat-input__progress-bar--error')
    }

    // Show result icon
    const progressContainer = this.previewContainer.querySelector('.chat-input__progress') as HTMLElement | null
    if (progressContainer) {
      const resultIcon = createElement('div', {
        className: `chat-input__upload-result chat-input__upload-result--${success ? 'success' : 'error'}`
      })
      resultIcon.innerHTML = success ? icons.check : icons.error
      progressContainer.appendChild(resultIcon)
    }
  }

  /**
   * Set uploading state
   */
  setUploading(uploading: boolean): void {
    if (uploading) {
      this.attachButton?.setAttribute('disabled', 'true')
      this.sendButton.setAttribute('disabled', 'true')
      this.textarea.setAttribute('disabled', 'true')

      // Add progress bar to preview if showing a file
      if (this.previewContainer && this.selectedFile) {
        const progressContainer = createElement('div', { className: 'chat-input__progress' })
        const progressBar = createElement('div', { className: 'chat-input__progress-bar' })
        progressContainer.appendChild(progressBar)
        this.previewContainer.appendChild(progressContainer)
      }
    } else {
      this.attachButton?.removeAttribute('disabled')
      this.textarea.removeAttribute('disabled')
      this.updateSendButton()

      // Remove progress bar
      const progress = this.previewContainer?.querySelector('.chat-input__progress')
      progress?.remove()
    }
  }
}
