# TD-011: Проверка на пустой список админов в SLA

## Проблема

Функция `getGroupAdmins` в `src/services/group.service.ts` может вернуть пустой массив (все админы — боты, или нет админов). В этом случае SLA reminder отправится в топик без упоминаний (@mentions), что делает его неэффективным.

## Текущее поведение

```typescript
const admins = await getGroupAdmins(bot.api);
const mentions = formatAdminMentions(admins);
// Если admins === [], то mentions === '', сообщение: "// ⏰ SLA: 10 минут\n"
```

## Последствия

SLA reminder отправляется, но никто не получает notification. Пинг неэффективен.

## Предлагаемое решение

```typescript
if (admins.length === 0) {
  logger.error({ topicId }, 'No human admins found for SLA reminder');
  // Можно добавить fallback: @admin или @here
}
```

## Приоритет

Низкий — edge case. В продакшене всегда есть хотя бы 1 человек-админ.

## Источник

PR review для задачи 013.

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
