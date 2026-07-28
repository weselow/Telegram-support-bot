---
name: start-task
description: Перед началом работы над любой задачей из папки docs\backlog и вложенных папок.
---

# Как реализовывать задачи из беклога

Этот навык применяется, когда пользователь говорит выполнить задачу из беклога.

## Instructions

Начинаю работу над задачей из беклога. Выполни следующие шаги:

1. **Прочитай стандарт** @docs/standards/backlog-workflow-standard.md . НАПИШИ пользователю дословно текст: "ПРИМЕНИЛ НАВЫК И ПРОЧИТАЛ СТАНДАРТ".

2. **Определи тип задачи** по пути к файлу:
   - `docs/backlog/technical-debt/` → технический долг → результат в `docs/bugs/`
   - `docs/backlog/tasks/` и остальные подпапки  → обычная задача → результат в `docs/solutions/`

3. **Выведи чеклист** для соответствующего типа задачи

4. **Создай ветку** по формату из стандарта:
   - Обычная задача: `feature/[номер]-[название]`
   - Технический долг: `fix/[название]`

5. **Напомни** про структуру папок и формат файлов результата

6. **Проверь** по итогу выполнения задачи, все ли задачи были выполнены из файла  задачи, все ли требования стандарта @docs/standards/backlog-workflow-standard.md выполнены, проведен ли полный code review.

7. **Выполни** следующую инструкцию после выполнения задач:
```
I'm ready to create this PR. Please:
1. Review test coverage
2. Check for silent failures
3. Verify code comments are accurate
4. Review any new types
5. General code review
6. Security code review. 

Then, provide a feedback, what recommendations we should apply, what should reject as over-engeneering, what should save as technical debt in backlog @docs\backlog\technical-debt to apply in the future.

Answer in Russian.
```
Оцени поступившие рекомендации, какие принять, какие отложить в технический долг, какие отклонить как необоснованные, избыточные или over-engeenering. Отлоненные - отклони, отложенные - сохрани как технический долг в @docs/backlog/technical-debt/`, а какие применить - примени.



Если путь к файлу задачи не указан — спроси его у пользователя.

Отвечай на русском.
