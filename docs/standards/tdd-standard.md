# СТАНДАРТ TEST-DRIVEN DEVELOPMENT (TDD)

> **Обязательный стандарт разработки через тестирование для DellShop B2B Platform**

**Версия**: 1.0
**Дата**: 2025-09-28
**Статус**: ОБЯЗАТЕЛЬНЫЙ для всех модулей
**Применение**: Все агенты implementation и разработка кода

## Связь с другими стандартами

Данный стандарт дополняет:
- @docs/standards/GLOBAL-implementation-standard.md
- @docs/standards/architecture-standard.md

## 🎯 Цели TDD стандарта

1. **Качество кода**: Обеспечение высокого качества через тестирование
2. **Архитектурная чистота**: TDD способствует лучшему дизайну кода
3. **Регрессионная защита**: Предотвращение поломок при изменениях
4. **Документация**: Тесты как живая документация поведения системы
5. **Уверенность в рефакторинге**: Безопасные изменения кода

## 🚨 КРИТИЧЕСКИЕ ПРАВИЛА

### ⚠️ ЗАПРЕЩЕНО

**НИКОГДА не изменяйте тесты для устранения ошибок компиляции - ВСЕГДА изменяйте код**

```typescript
// ❌ НЕПРАВИЛЬНО: Изменение теста под сломанный код
expect(result.crop).toEqual({ x: 0, y: 0, width: 800, height: 600 })

// ✅ ПРАВИЛЬНО: Сохранить тест, исправить имплементацию
expect(result.crop).toBe('fill')
```

### ✅ ОБЯЗАТЕЛЬНО

1. **Тесты сначала** - писать тесты ДО реализации функциональности
2. **Следовать циклу** - RED → GREEN → REFACTOR
3. **Проверять результат** - всегда запускать тесты после написания кода
4. **Покрытие >60%** - обязательное минимальное покрытие тестами

## 🔄 TDD Цикл (ОБЯЗАТЕЛЬНО для каждой имплементации)

### **1. RED - Написать падающий тест ПЕРВЫМ**

```bash
# ВСЕГДА создавать тест ДО имплементации
touch backend/src/modules/[module]/__tests__/unit/[feature].test.ts

# Запустить тест - он ДОЛЖЕН упасть
npm test -- --testPathPattern=[test-file]
# Убедиться что тест красный (провалился)
```

**Пример создания падающего теста:**
```typescript
// backend/src/modules/quotes/__tests__/unit/quote-calculator.test.ts
describe('QuoteCalculator', () => {
  it('should calculate quote total with discounts', () => {
    const calculator = new QuoteCalculator()
    const items = [
      { productId: 'prod-1', quantity: 2, unitPrice: 100 }
    ]
    const discount = 0.1 // 10%

    const result = calculator.calculateTotal(items, discount)

    expect(result.subtotal).toBe(200)
    expect(result.discount).toBe(20)
    expect(result.total).toBe(180)
  })
})
```

### **2. GREEN - Написать минимальный код для прохождения теста**

```bash
# Реализовать функциональность
# НИКОГДА не изменять expectations теста

# Запустить тест - он ДОЛЖЕН пройти
npm test -- --testPathPattern=[test-file]
# Убедиться что все тесты зеленые
```

**Пример минимальной имплементации:**
```typescript
// backend/src/modules/quotes/domain/services/quote-calculator.ts
export class QuoteCalculator {
  calculateTotal(items: QuoteItem[], discount: number): QuoteTotal {
    const subtotal = items.reduce((sum, item) =>
      sum + (item.quantity * item.unitPrice), 0
    )
    const discountAmount = subtotal * discount
    const total = subtotal - discountAmount

    return {
      subtotal,
      discount: discountAmount,
      total
    }
  }
}
```

### **3. REFACTOR - Улучшить код, сохраняя зеленые тесты**

```bash
# Рефакторинг при зеленых тестах
# Запускать тесты после каждого изменения
npm test -- --testPathPattern=[test-file]
```

**Пример рефакторинга:**
```typescript
export class QuoteCalculator {
  calculateTotal(items: QuoteItem[], discount: number): QuoteTotal {
    const subtotal = this.calculateSubtotal(items)
    const discountAmount = this.calculateDiscount(subtotal, discount)
    const total = subtotal - discountAmount

    return { subtotal, discount: discountAmount, total }
  }

  private calculateSubtotal(items: QuoteItem[]): number {
    return items.reduce((sum, item) =>
      sum + (item.quantity * item.unitPrice), 0
    )
  }

  private calculateDiscount(subtotal: number, rate: number): number {
    return subtotal * rate
  }
}
```

## 🚫 ЗАПРЕЩЕННЫЕ действия

### 1. Изменение теста при ошибке компиляции

```typescript
// ❌ НЕПРАВИЛЬНО: Адаптация теста под код
it('should handle crop configuration', () => {
  const options = { crop: { x: 0, y: 0, width: 800, height: 600 } }
  // Изменили тест, чтобы подогнать под существующий код
})

// ✅ ПРАВИЛЬНО: Сохранить изначальные требования
it('should handle crop configuration', () => {
  const options = { crop: 'fill' }
  // Сохранили изначальное требование, меняем код
})
```

### 2. Написание кода без запуска тестов

```bash
# ❌ НЕПРАВИЛЬНО
# Написать код
# Написать еще код
# Написать еще больше кода
# Запустить тесты в конце

# ✅ ПРАВИЛЬНО
# Написать код
npm test -- --testPathPattern=[test-file]
# Написать еще код
npm test -- --testPathPattern=[test-file]
# После каждого изменения проверять
```

### 3. Предположение что тесты проходят

```bash
# ❌ НЕПРАВИЛЬНО: "Тесты должны проходить"
# Не запускать тесты

# ✅ ПРАВИЛЬНО: Всегда проверять фактически
npm test -- --testPathPattern=[test-file]
# Убедиться визуально в результате
```

## ✅ Правильный TDD подход

### При ошибке компиляции:

1. **Внимательно прочитать сообщение об ошибке**
2. **Определить какой API ожидает тест**
3. **Имплементировать этот API в коде**
4. **Запустить тесты для проверки**
5. **НИКОГДА не изменять тест под текущий код**

### Пример правильного исправления:

**Тест ожидает строковый crop:**
```typescript
// Тест (НЕ МЕНЯТЬ):
const options = { crop: 'fill' }
expect(transform(image, options).crop).toBe('fill')

// Имплементация (ИСПРАВИТЬ):
interface TransformOptions {
  crop?: string | CropConfig  // Поддержать строку И объект
}

function normalizeCrop(crop: string | CropConfig): CropConfig {
  if (typeof crop === 'string') {
    return CROP_PRESETS[crop] // Конвертировать fill в config
  }
  return crop
}
```

## 📊 Типы тестов

### 1. Unit тесты (Domain & Application слои)
- **Назначение**: Тестирование отдельных функций/методов в изоляции
- **Покрытие**: >80% для критической бизнес-логики
- **TDD**: ОБЯЗАТЕЛЕН

```typescript
// Unit тест для доменной сущности
describe('Quote Entity', () => {
  it('should calculate total price correctly', () => {
    const quote = new Quote([
      new QuoteItem('prod-1', 2, 100),
      new QuoteItem('prod-2', 1, 50)
    ])

    expect(quote.getTotalPrice()).toBe(250)
  })
})
```

### 2. Integration тесты (Infrastructure & Presentation слои)
- **Назначение**: Тестирование взаимодействия компонентов
- **Покрытие**: >60% для API endpoints и репозиториев
- **TDD**: ОБЯЗАТЕЛЕН

```typescript
// Integration тест для API endpoint
describe('POST /store/quotes', () => {
  it('should create quote successfully', async () => {
    const response = await request(app)
      .post('/store/quotes')
      .send({
        customerId: 'customer-1',
        items: [{ productId: 'prod-1', quantity: 2 }]
      })

    expect(response.status).toBe(201)
    expect(response.body.data.total).toBeDefined()
  })
})
```

### 3. E2E тесты (Полные сценарии)
- **Назначение**: Тестирование критических пользовательских сценариев
- **Покрытие**: Основные business flows
- **TDD**: Рекомендуется

```typescript
// E2E тест полного сценария
describe('Quote Creation Flow', () => {
  it('should create, calculate and convert quote to order', async () => {
    // 1. Создать quote
    const quote = await createQuote(customerId, items)

    // 2. Применить скидку
    await applyDiscount(quote.id, discountCode)

    // 3. Конвертировать в заказ
    const order = await convertQuoteToOrder(quote.id)

    expect(order.status).toBe('pending')
  })
})
```

## 🎯 Обязательная проверка перед завершением задачи

**Каждая задача ДОЛЖНА пройти все проверки:**

```bash
# 1. Специфичный тест модуля
npm test -- --testPathPattern=[module]

# 2. Все тесты проекта
npm test

# 3. Проверка покрытия (>60%)
npm run test:coverage

# 4. TypeScript компиляция
npm run typecheck

# 5. Линтинг кода
npm run lint
```

**Задача НЕ может быть завершена если:**
- ❌ Тесты не проходят
- ❌ Покрытие <60%
- ❌ TypeScript ошибки существуют
- ❌ Lint ошибки есть
- ❌ TDD цикл не был соблюден

## 📁 Структура тестов

### Обязательная организация тестов:

```
backend/src/modules/[module]/__tests__/
├── unit/                     # Unit тесты
│   ├── domain/
│   │   ├── entities/
│   │   │   └── quote.entity.test.ts
│   │   └── services/
│   │       └── quote-calculator.test.ts
│   ├── application/
│   │   └── services/
│   │       └── quote.service.test.ts
│   └── shared/
│       └── utils/
│           └── validation.test.ts
├── integration/              # Integration тесты
│   ├── infrastructure/
│   │   └── repositories/
│   │       └── quote.repository.test.ts
│   └── presentation/
│       ├── controllers/
│       │   └── quote.controller.test.ts
│       └── routes/
│           └── quotes.routes.test.ts
└── __mocks__/               # Test Mocks
    ├── quote.mock.ts
    └── database.mock.ts
```

### Naming Conventions:

- **Test files**: `[feature].test.ts`
- **Mock files**: `[feature].mock.ts`
- **Test suites**: `describe('[ClassName/FeatureName]')`
- **Test cases**: `it('should [expected behavior]')`

## 🔧 Test Utilities и Mocks

### Создание качественных моков:

```typescript
// __mocks__/quote.mock.ts
export const mockQuoteRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
}

export const mockQuoteData = {
  id: 'quote-1',
  customerId: 'customer-1',
  items: [
    { productId: 'prod-1', quantity: 2, unitPrice: 100 }
  ],
  totalPrice: 200,
  status: 'draft'
}
```

### Test Helper функции:

```typescript
// __tests__/helpers/test-helpers.ts
export const createTestQuote = (overrides: Partial<Quote> = {}): Quote => {
  return new Quote({
    ...mockQuoteData,
    ...overrides
  })
}

export const setupTestDatabase = async () => {
  // Database setup for integration tests
}
```

## 📈 Метрики качества тестов

### Обязательные показатели:

1. **Test Coverage**: >60% для production модулей
2. **Test Success Rate**: 100% (все тесты должны проходить)
3. **Test Performance**: Unit тесты <100ms, Integration <1s
4. **Test Maintainability**: Рефакторинг тестов при изменении API

### Мониторинг качества:

```bash
# Детальный отчет по покрытию
npm run test:coverage -- --verbose

# Производительность тестов
npm test -- --verbose --detectOpenHandles

# Только измененные файлы
npm test -- --onlyChanged
```

## 🚀 TDD для различных слоев архитектуры

### Domain Layer (строгий TDD):
- Все entities и value objects
- Domain services и бизнес-правила
- Валидация доменных инвариантов

### Application Layer (строгий TDD):
- Use cases и application services
- DTOs и их валидация
- Coordination logic

### Infrastructure Layer (TDD для логики):
- Repository implementations
- External service integrations
- Complex data transformations

### Presentation Layer (TDD для контроллеров):
- Request/response handling
- Validation logic
- Error handling

## 📝 Чек-лист TDD соответствия

### ✅ Готовность задачи (TDD perspective):

- [ ] ✅ Тесты написаны ДО имплементации
- [ ] ✅ Соблюден цикл RED → GREEN → REFACTOR
- [ ] ✅ Все тесты проходят (100% success rate)
- [ ] ✅ Покрытие тестами >60%
- [ ] ✅ Тесты документируют поведение системы
- [ ] ✅ Нет изменений тестов для исправления компиляции
- [ ] ✅ TypeScript компилируется без ошибок
- [ ] ✅ Lint проверки проходят
- [ ] ✅ Integration тесты покрывают API endpoints
- [ ] ✅ Моки созданы для внешних зависимостей

---

**⚠️ ВАЖНО**: Данный стандарт является ОБЯЗАТЕЛЬНЫМ для всех implementation задач. Нарушение TDD процесса считается критической ошибкой в разработке.

**📧 Контакты**: По вопросам TDD стандарта обращаться к senior-code-reviewer agent.

**🔄 Версионирование**: При изменениях стандарта все команды должны быть уведомлены заранее.