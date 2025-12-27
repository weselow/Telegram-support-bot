# Decisions: Onboarding Flow для пользователей

## Контекст

Улучшение первого контакта с пользователем — сбор описания проблемы и телефона для резервной связи.

## Принятые решения

### 1. Порядок flow
**Решение:** Проблема → Тикет → Телефон (а не Телефон → Проблема)
**Причина:** Сначала решаем проблему пользователя, потом дополнительная информация

### 2. Хранение состояния
**Решение:** Redis с TTL
**Причина:** Быстро, TTL из коробки, Redis уже в стеке проекта (BullMQ)

### 3. TTL состояния
**Решение:** TTL только для очистки Redis, не для сброса flow
**Причина:** Сообщения остаются в чате Telegram — пользователь видит контекст

### 4. URL источника
**Решение:** Показывать только агентам в карточке тикета, не пользователю
**Причина:** URL может быть длинным/техническим

### 5. Onboarding для всех
**Решение:** Запускать onboarding и для пользователей с сайта, и напрямую
**Причина:** Единый опыт, разница только в записи источника в тикет

### 6. Запрос телефона
**Решение:** Использовать request_contact (встроенная кнопка Telegram)
**Причина:** Минимум действий пользователя — нажать кнопку вместо ввода текста

### 7. Разный flow для новых/вернувшихся
**Новые:** "Оставишь номер?" → [Отправить номер] [Не сейчас]
**Вернувшиеся:** "Номер {phone} актуален?" → [Да] [Изменить]

### 8. Тексты реплик
**Решение:** Хранить в config.json
**Стиль:** Короткий, живой, дружелюбный — как общение с другом

## Что реализовано

- [x] OnboardingService (Redis состояние)
- [x] Тексты реплик в config.json
- [x] Start handler с началом onboarding
- [x] Обработка шага awaiting_question
- [x] Обработка шага awaiting_phone
- [x] Contact handler (request_contact)
- [x] Callback handlers для кнопок
- [x] Тесты

## Технические детали

### Состояние onboarding
```typescript
type OnboardingStep = 'awaiting_question' | 'awaiting_phone' | 'confirming_phone';

interface OnboardingState {
  step: OnboardingStep;
  sourceUrl?: string;
  ip?: string;
  city?: string;
}
```

### Redis ключи
- `onboarding:{tgUserId}` — состояние onboarding
- TTL: 1 час (для очистки, не сброса)

## Созданные/изменённые файлы

### Новые файлы
- `src/services/onboarding.service.ts` — сервис управления состоянием onboarding в Redis
- `src/bot/handlers/onboarding.ts` — обработчики шагов onboarding
- `src/services/__tests__/onboarding.service.test.ts` — тесты для OnboardingService

### Изменённые файлы
- `config/messages.json` — добавлены тексты реплик onboarding
- `src/config/messages.ts` — добавлена zod-схема для onboarding
- `src/bot/handlers/start.ts` — начало onboarding при /start
- `src/bot/handlers/message.ts` — интеграция с onboarding
- `src/bot/handlers/phone.ts` — интеграция с onboarding contact
- `src/bot/handlers/private-callback.ts` — обработка onboarding callbacks
- `src/db/repositories/user.repository.ts` — добавлен метод updateSourceUrl
