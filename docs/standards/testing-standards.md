# Testing Standards - DellShop B2B Platform

**Версия**: 2.0 (оптимизирован)
**Дата**: 07.10.2025
**Статус**: ОБЯЗАТЕЛЬНЫЙ
**Применение**: Unit, Integration, E2E тесты

## Связь с другими стандартами

Дополняет:
- @docs/standards/GLOBAL-implementation-standard.md - базовые принципы
- @docs/standards/tdd-standard.md - **TDD цикл (см. детали)**
- @docs/standards/architecture-standard.md - архитектура

## Testing Pyramid

```
     /E2E\      10% - End-to-End
    /-----\
   /  INT  \    30% - Integration
  /--------\
 /   UNIT   \   60% - Unit Tests
/------------\
```

## Coverage Requirements (ОБЯЗАТЕЛЬНО)

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    statements: 60,
    branches: 60,
    functions: 60,
    lines: 60
  },
  // Критические модули
  './src/modules/payment/**/*.ts': {
    statements: 80,
    branches: 80
  }
}
```

**Обязательное покрытие:**
- 100% - критическая логика (платежи, заказы, безопасность)
- 80% - основная логика (каталог, корзина, котировки)
- 60% - вспомогательная функциональность

## TDD Workflow

**Детали в:** @docs/standards/tdd-standard.md

### Краткий цикл:

1. **RED** - тест ПЕРВЫМ → должен упасть
2. **GREEN** - минимальный код → тест проходит
3. **REFACTOR** - улучшить → тесты зеленые

### КРИТИЧНО:
❌ **ЗАПРЕЩЕНО** изменять тесты для устранения ошибок компиляции
✅ **ВСЕГДА** изменяйте код под требования теста

## Unit Tests

### Структура (AAA Pattern)

```typescript
describe('QuoteCalculationService', () => {
  let service: QuoteCalculationService
  let mockPriceService: jest.Mocked<IPriceService>

  beforeEach(() => {
    // Arrange - подготовка моков
    mockPriceService = { getPrice: jest.fn() } as any
    service = new QuoteCalculationService(mockPriceService)
  })

  describe('calculateTotal', () => {
    it('should calculate total with tax and discount', async () => {
      // Arrange
      const items = [{ productId: '1', quantity: 2, unitPrice: 1000 }]
      mockPriceService.applyDiscount.mockReturnValue(1800)

      // Act
      const result = await service.calculateTotal(items)

      // Assert
      expect(result.subtotal).toBe(2000)
      expect(result.total).toBe(2160)
      expect(mockPriceService.applyDiscount).toHaveBeenCalledWith(2000)
    })

    it('should handle zero quantity', async () => {
      const items = [{ productId: '1', quantity: 0, unitPrice: 1000 }]

      await expect(service.calculateTotal(items))
        .rejects.toThrow(InvalidQuantityError)
    })
  })
})
```

### Mocking

```typescript
// Mock repository
const mockUserRepository: jest.Mocked<IUserRepository> = {
  findById: jest.fn(),
  create: jest.fn()
} as any

// Mock external service
const mockEmailService: jest.Mocked<IEmailService> = {
  sendEmail: jest.fn().mockResolvedValue({ success: true })
} as any

// Cleanup between tests
afterEach(() => {
  jest.clearAllMocks()
})
```

### Test Data Builders

```typescript
class UserBuilder {
  private user: Partial<User> = {
    id: '1',
    email: 'test@example.com',
    role: 'user'
  }

  withId(id: string): this {
    this.user.id = id
    return this
  }

  withRole(role: UserRole): this {
    this.user.role = role
    return this
  }

  build(): User {
    return this.user as User
  }
}

// Usage
const admin = new UserBuilder().withRole('admin').build()
```

## Integration Tests

### API Integration

```typescript
describe('POST /api/v1/products', () => {
  let app: Express
  let authToken: string

  beforeAll(async () => {
    app = await createTestApp()
    authToken = await getAdminAuthToken()
  })

  afterAll(async () => {
    await cleanupDatabase()
  })

  it('should create product with valid data', async () => {
    const productData = {
      name: 'Dell PowerEdge R740',
      price: 250000
    }

    const response = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(productData)
      .expect(201)

    expect(response.body.success).toBe(true)
    expect(response.body.data.name).toBe(productData.name)

    // Verify in database
    const product = await productRepository.findById(response.body.data.id)
    expect(product).toBeDefined()
  })

  it('should return 422 for invalid data', async () => {
    const response = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: '', price: -100 })
      .expect(422)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})
```

### Repository Integration

```typescript
describe('UserRepository Integration', () => {
  let repository: UserRepository
  let connection: Connection

  beforeAll(async () => {
    connection = await createTestDatabaseConnection()
    repository = new UserRepository(connection)
  })

  beforeEach(async () => {
    await connection.query('TRUNCATE TABLE users CASCADE')
  })

  it('should create and find user by id', async () => {
    const userData = { email: 'test@example.com', password: 'hashed' }

    const created = await repository.create(userData)
    const found = await repository.findById(created.id)

    expect(found).toBeDefined()
    expect(found.id).toBe(created.id)
  })
})
```

## E2E Tests

```typescript
describe('B2B Order Flow E2E', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    browser = await puppeteer.launch()
  })

  it('should complete full order flow', async () => {
    page = await browser.newPage()
    await page.goto('http://localhost:3000')

    // 1. Login
    await page.type('#email', 'b2b@company.com')
    await page.type('#password', 'password123')
    await page.click('#submit-login')
    await page.waitForNavigation()

    // 2. Search and add to cart
    await page.type('#search-input', 'Dell PowerEdge R740')
    await page.click('#search-button')
    await page.click('.product-card:first-child .add-to-cart')

    // 3. Checkout
    await page.click('#cart-icon')
    await page.click('#checkout-button')
    await page.click('#complete-order')
    await page.waitForSelector('.order-success')

    // Assert
    const successMessage = await page.$eval('.success-message', el => el.textContent)
    expect(successMessage).toContain('Заказ успешно создан')
  })
})
```

## Error Scenario Testing (ОБЯЗАТЕЛЬНО)

```typescript
describe('Error Handling', () => {
  it('should handle database connection errors', async () => {
    const service = new UserService(failingRepository)
    await expect(service.getUser('123'))
      .rejects.toThrow(DatabaseConnectionError)
  })

  it('should handle validation errors', async () => {
    await expect(service.createUser({ email: 'not-an-email' }))
      .rejects.toThrow(ValidationError)
  })

  it('should handle concurrent access conflicts', async () => {
    const promise1 = service.addItem(cartId, 'product-1', 1)
    const promise2 = service.addItem(cartId, 'product-2', 1)

    const results = await Promise.allSettled([promise1, promise2])

    expect(results.some(r => r.status === 'fulfilled')).toBe(true)
    expect(results.some(r => r.status === 'rejected')).toBe(true)
  })
})
```

## Performance Testing

```typescript
describe('Performance Tests', () => {
  it('should handle 1000 products in <200ms', async () => {
    const products = generateTestProducts(1000)
    await repository.bulkCreate(products)

    const startTime = Date.now()
    const result = await productService.getAll({ limit: 1000 })
    const duration = Date.now() - startTime

    expect(duration).toBeLessThan(200)
    expect(result.length).toBe(1000)
  })
})
```

## Test Configuration

### jest.config.js

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts']
}
```

### Global Setup

```typescript
// test/setup.ts
beforeAll(async () => {
  global.testDb = await createTestDatabaseConnection()
  process.env.TZ = 'UTC'
  jest.useFakeTimers().setSystemTime(new Date('2025-10-07'))
})

afterAll(async () => {
  await global.testDb.close()
  jest.useRealTimers()
})
```

## Testing Checklist

Перед мержем:
- [ ] Новые функции покрыты unit тестами
- [ ] API endpoints имеют integration тесты
- [ ] Покрытие ≥60% (>80% для критической логики)
- [ ] Все тесты проходят (`npm test`)
- [ ] Нет `.skip`, `.only`
- [ ] Error scenarios протестированы
- [ ] Edge cases покрыты
- [ ] Performance тесты (критические операции)
- [ ] Test names описывают поведение
- [ ] Нет флакующих тестов

## Test Naming

```typescript
// ✅ Правильно - описывает поведение
it('should return user when found')
it('should throw error when user not found')
it('should create user with hashed password')

// ❌ Неправильно
it('test getUser')
it('works correctly')
it('should not fail')
```

---

**СТАТУС:** ОБЯЗАТЕЛЬНЫЙ
**ВЕРСИЯ:** 2.0 (оптимизирован)
**ДАТА:** 07.10.2025
