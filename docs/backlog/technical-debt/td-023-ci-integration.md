# TD-023: CI интеграция

**Источник:** Задача 018
**Приоритет:** Низкий
**Блокер:** Нет (опционально)

## Описание

Не настроена CI интеграция:
- GitHub Actions workflow
- Автоматический запуск тестов при push

## Реализация

Создать `.github/workflows/test.yml`:
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

## Зависимости

- Репозиторий должен быть на GitHub
- Секреты для тестового окружения (если нужны)
