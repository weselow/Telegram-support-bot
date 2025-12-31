import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store scope callbacks for testing
let scopeCallbacks: Array<(scope: MockScope) => void> = [];

// Mock scope object
interface MockScope {
  setExtra: ReturnType<typeof vi.fn>;
  setTag: ReturnType<typeof vi.fn>;
  setLevel: ReturnType<typeof vi.fn>;
}

const createMockScope = (): MockScope => ({
  setExtra: vi.fn(),
  setTag: vi.fn(),
  setLevel: vi.fn(),
});

// Mock Sentry module
vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  withScope: vi.fn((callback: (scope: MockScope) => void) => {
    scopeCallbacks.push(callback);
    callback(createMockScope());
  }),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setExtra: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Mock env - with SENTRY_DSN to enable initialization
vi.mock('../env.js', () => ({
  env: {
    SENTRY_DSN: 'https://test@sentry.io/123',
    NODE_ENV: 'test',
  },
}));

// Import after mocks are set up
import * as Sentry from '@sentry/node';
import { captureError, setUserContext, addBreadcrumb, captureMessage } from '../sentry.js';

const mockSentry = vi.mocked(Sentry);

describe('Sentry Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeCallbacks = [];
  });

  describe('captureError', () => {
    it('should capture exception with context', () => {
      const error = new Error('Test error');
      const context = { userId: 'user-123', action: 'test' };

      captureError(error, context);

      expect(mockSentry.withScope).toHaveBeenCalled();
      expect(mockSentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should filter phone from context', () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user-123',
        phone: '+79991234567',
        action: 'test',
      };

      captureError(error, context);

      // Get the scope from callback
      expect(scopeCallbacks.length).toBeGreaterThan(0);
      const mockScope = createMockScope();
      scopeCallbacks[0](mockScope);

      // phone should NOT be set
      expect(mockScope.setExtra).not.toHaveBeenCalledWith('phone', expect.anything());
      // Other fields should be set
      expect(mockScope.setExtra).toHaveBeenCalledWith('userId', 'user-123');
      expect(mockScope.setExtra).toHaveBeenCalledWith('action', 'test');
    });

    it('should filter tgPhone from context', () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user-123',
        tgPhone: '+79991234567',
        action: 'test',
      };

      captureError(error, context);

      const mockScope = createMockScope();
      scopeCallbacks[0](mockScope);

      expect(mockScope.setExtra).not.toHaveBeenCalledWith('tgPhone', expect.anything());
      expect(mockScope.setExtra).toHaveBeenCalledWith('userId', 'user-123');
    });

    it('should handle undefined context', () => {
      const error = new Error('Test error');

      expect(() => captureError(error)).not.toThrow();
      expect(mockSentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should not throw when Sentry SDK fails', () => {
      mockSentry.withScope.mockImplementationOnce(() => {
        throw new Error('Sentry SDK failure');
      });

      const error = new Error('Test error');

      // Should not throw - graceful degradation
      expect(() => captureError(error, { test: 'data' })).not.toThrow();
    });
  });

  describe('setUserContext', () => {
    it('should set user ID', () => {
      setUserContext('user-123');

      expect(mockSentry.setUser).toHaveBeenCalledWith({ id: 'user-123' });
    });

    it('should set extra data', () => {
      setUserContext('user-123', { role: 'admin', company: 'Test Corp' });

      expect(mockSentry.setUser).toHaveBeenCalledWith({ id: 'user-123' });
      expect(mockSentry.setExtra).toHaveBeenCalledWith('role', 'admin');
      expect(mockSentry.setExtra).toHaveBeenCalledWith('company', 'Test Corp');
    });

    it('should filter phone from extra', () => {
      setUserContext('user-123', { role: 'admin', phone: '+79991234567' });

      expect(mockSentry.setExtra).toHaveBeenCalledWith('role', 'admin');
      expect(mockSentry.setExtra).not.toHaveBeenCalledWith('phone', expect.anything());
    });

    it('should filter tgPhone from extra', () => {
      setUserContext('user-123', { role: 'admin', tgPhone: '+79991234567' });

      expect(mockSentry.setExtra).toHaveBeenCalledWith('role', 'admin');
      expect(mockSentry.setExtra).not.toHaveBeenCalledWith('tgPhone', expect.anything());
    });

    it('should not throw when Sentry SDK fails', () => {
      mockSentry.setUser.mockImplementationOnce(() => {
        throw new Error('Sentry SDK failure');
      });

      expect(() => setUserContext('user-123', { test: 'data' })).not.toThrow();
    });
  });

  describe('addBreadcrumb', () => {
    it('should add breadcrumb with category and message', () => {
      addBreadcrumb('http', 'GET /api/users');

      expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'http',
        message: 'GET /api/users',
        level: 'info',
      });
    });

    it('should add breadcrumb with custom level', () => {
      addBreadcrumb('error', 'Something failed', 'error');

      expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'error',
        message: 'Something failed',
        level: 'error',
      });
    });

    it('should add breadcrumb with data', () => {
      addBreadcrumb('http', 'GET /api/users', 'info', { statusCode: 200, duration: 150 });

      expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'http',
        message: 'GET /api/users',
        level: 'info',
        data: { statusCode: 200, duration: 150 },
      });
    });

    it('should filter phone from data', () => {
      addBreadcrumb('user', 'User action', 'info', {
        userId: 'user-123',
        phone: '+79991234567',
        action: 'login',
      });

      expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'user',
        message: 'User action',
        level: 'info',
        data: { userId: 'user-123', action: 'login' },
      });
    });

    it('should filter tgPhone from data', () => {
      addBreadcrumb('user', 'User action', 'info', {
        userId: 'user-123',
        tgPhone: '+79991234567',
      });

      expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'user',
        message: 'User action',
        level: 'info',
        data: { userId: 'user-123' },
      });
    });

    it('should not throw when Sentry SDK fails', () => {
      mockSentry.addBreadcrumb.mockImplementationOnce(() => {
        throw new Error('Sentry SDK failure');
      });

      expect(() => addBreadcrumb('test', 'message', 'info', { data: 'test' })).not.toThrow();
    });
  });

  describe('captureMessage', () => {
    it('should capture message with default error level', () => {
      captureMessage('Test message');

      expect(mockSentry.withScope).toHaveBeenCalled();
      expect(mockSentry.captureMessage).toHaveBeenCalledWith('Test message');
    });

    it('should capture message with custom level', () => {
      captureMessage('Warning message', 'warning');

      const mockScope = createMockScope();
      scopeCallbacks[0](mockScope);

      expect(mockScope.setLevel).toHaveBeenCalledWith('warning');
      expect(mockSentry.captureMessage).toHaveBeenCalledWith('Warning message');
    });

    it('should set tags', () => {
      captureMessage('Test message', 'error', undefined, { source: 'widget', env: 'test' });

      const mockScope = createMockScope();
      scopeCallbacks[0](mockScope);

      expect(mockScope.setTag).toHaveBeenCalledWith('source', 'widget');
      expect(mockScope.setTag).toHaveBeenCalledWith('env', 'test');
    });

    it('should set context and filter phone', () => {
      captureMessage('Test message', 'error', {
        userId: 'user-123',
        phone: '+79991234567',
        action: 'test',
      });

      const mockScope = createMockScope();
      scopeCallbacks[0](mockScope);

      expect(mockScope.setExtra).toHaveBeenCalledWith('userId', 'user-123');
      expect(mockScope.setExtra).toHaveBeenCalledWith('action', 'test');
      expect(mockScope.setExtra).not.toHaveBeenCalledWith('phone', expect.anything());
    });

    it('should set context and filter tgPhone', () => {
      captureMessage('Test message', 'error', {
        userId: 'user-123',
        tgPhone: '+79991234567',
      });

      const mockScope = createMockScope();
      scopeCallbacks[0](mockScope);

      expect(mockScope.setExtra).toHaveBeenCalledWith('userId', 'user-123');
      expect(mockScope.setExtra).not.toHaveBeenCalledWith('tgPhone', expect.anything());
    });

    it('should not throw when Sentry SDK fails', () => {
      mockSentry.withScope.mockImplementationOnce(() => {
        throw new Error('Sentry SDK failure');
      });

      expect(() =>
        captureMessage('Test', 'error', { context: 'data' }, { tag: 'value' })
      ).not.toThrow();
    });
  });
});
