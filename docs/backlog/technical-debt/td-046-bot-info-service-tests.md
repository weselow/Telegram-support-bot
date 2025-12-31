# TD-046: Unit-тесты для bot-info.service.ts

**Приоритет:** Средний
**Источник:** Code Review TD-040

## Проблема

Сервис `src/services/bot-info.service.ts` имеет 0% покрытия тестами.

## Что нужно сделать

1. Создать файл `src/services/__tests__/bot-info.service.test.ts`
2. Замокать `bot.api.getMe()`, `bot.api.getUserProfilePhotos()`, `bot.api.getFile()`
3. Покрыть сценарии:
   - Успешное получение bot info с аватаром
   - Успешное получение bot info без аватара
   - Ошибка API → fallback на кэш
   - Ошибка API без кэша → fallback на дефолтные значения
   - Кэширование (второй вызов возвращает кэш)
   - Истечение TTL кэша

## Критерии готовности

- [ ] Тесты созданы и проходят
- [ ] Покрытие bot-info.service.ts > 80%
