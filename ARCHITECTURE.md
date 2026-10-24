# Архитектура

Исходники лежат в `src/` слоями. Каждый слой зависит только от слоёв ниже.

```
public/        API для пользователя: MathQuill(el), StaticMath, MathField, TextField, типы
controller/    один Controller на поле и его сервисы
commands/      узлы дерева для LaTeX-команд и символов + реестр команд
tree/          модель редактирования: MQNode, Fragment, Cursor, Selection
core/          без бизнес-логики: направления L/R, DOM-хелперы, DOMFragment, парсер-комбинаторы, анимация
options.ts     опции поля, значения по умолчанию, проверка конфига
```

## core/

| файл | назначение |
|---|---|
| `direction.ts` | `L = -1`, `R = 1`, `Direction`, `Ends<T>`, `opp(dir)` |
| `dom.ts` | `h(tag, attrs, children)`, `h.text`, `h.entityText`, `h.block` (рендер блока и связь элемента с узлом) |
| `domFragment.ts` | `DOMFragment`: диапазон соседних DOM-узлов (замена jQuery) |
| `parser.ts` | парсер-комбинаторы для LaTeX |
| `geometry.ts`, `animate.ts`, `unicode.ts` | мелкие утилиты |

## tree/

* `node.ts`: `MQNode`, базовый класс всех узлов. Хранит двусвязные указатели (`[L]`, `[R]`, `parent`, `ends`) и *хуки* с поведением по умолчанию (`write`, `deleteTowards`, `moveOutOf`, `handleKeystroke`, `finalizeTree`, `reflow`, …). Подклассы переопределяют только нужные хуки.
* `fragment.ts`: `Fragment`, единственное место, где меняются связи дерева (`adopt` / `disown`).
* `cursor.ts`: `Point`, `Cursor`, `Anticursor`. Курсор синхронно двигается по дереву и по DOM.
* `selection.ts`: выделение, т.е. фрагмент, обёрнутый в `span.mq-selection`.
* `domLink.ts`: связь DOM-элемент → узел через `WeakMap`, без expando-свойств на элементах.

## commands/

* `registry.ts`: `latexCommands` (`\name`) и `charCommands` (набираемые символы). В реестр можно записать класс или фабрику, а `create(name)` всегда возвращает узел. Здесь же `embeds` и `basicNodes` (фабрики букв и цифр, которые использует ядро).
* `index.ts`: точка сборки. Импортирует модули команд в фиксированном порядке. Если два модуля регистрируют одно имя, побеждает поздний.
* `math/core.ts`: `MathBlock`, `MathCommand`, `MQSymbol`, `RootMathBlock`. Блок передаёт контекстное поведение своей команде через хуки `writeInBlock` и `deleteOutOfBlock`. Так SupSub и Bracket меняют поведение своих блоков без подмены методов у экземпляров.
* `math/latexParser.ts`: грамматика math-mode LaTeX.
* Модули по темам: `symbols.ts` (буквы, цифры, операторы, греческие буквы), `supsub.ts`, `fraction.ts`, `roots.ts`, `brackets.ts`, `largeOperators.ts`, `style.ts`, `advancedSymbols.ts` (+ `symbols-config.json`), `innerField.ts`, `embed.ts`, `operatorNames.ts`.
* `text.ts` (`\text{}`, корень TextField), `latexCommandInput.ts` (ввод `\команды`).

## controller/

`Controller` хранит состояние поля (root, cursor, options, editable, blurred) и собирает сервисы:

| сервис | что делает |
|---|---|
| `editor` (`Editor.ts`) | раскладка клавиш, движение, удаление, выделение, ввод, буфер обмена |
| `latex` (`LatexIO.ts`) | импорт и экспорт LaTeX и текста, быстрый путь для обновления числа в конце |
| `textarea` (`Textarea.ts`) | скрытый textarea: создание, реестр слушателей, зеркалирование выделения для копирования |
| `keyboardEvents.ts` | нормализация браузерных клавиатурных событий в имена вида `Shift-Left` |
| `focusBlur` | фокус и blur, подавление группировки цифр во время ввода |
| `mouse` | клик и выделение перетаскиванием |
| `scroller` | горизонтальная прокрутка |

Каждое изменение дерева проходит через `controller.notify(event)`. Это явный конвейер с фиксированным порядком шагов, а не глобальный список подписчиков.

Хендлеры пользователя (`edit`, `enter`, `moveOutOf`, …) вызывает `controller.handle(name)`. Им передаётся публичный объект поля (`controller.api`), всегда один и тот же: `MathQuill(el) === mq`.

## public/

* `api.ts`: обычные ES-классы `AbstractMathQuill → StaticMath | EditableField → MathField → InnerMathField | TextField`. Фабрик классов и `__controller` больше нет.
* `mathquill.ts`: объект `MathQuill` с точками входа. `mq instanceof MathQuill.MathField` продолжает работать.
* `types.ts`: все публичные типы (`Config`, `Handlers`, `MathFieldApi`, …). Раньше `shared_types.d.ts` ссылался на несуществующий namespace `MathQuill.v3`.

## Опции

`options.ts` строит цепочку прототипов: опции поля → глобальные опции (`MathQuill.config`) → значения по умолчанию. Все проверки конфига собраны в одном месте (`processors`).

## Как добавить команду

```ts
// в подходящем модуле commands/math/*.ts
latexCommands.define(['name', 'alias'], () => new VanillaSymbol('\\name ', h.text('N')))
// или класс с собственным DOM и парсером:
class MyCmd extends MathCommand { ctrlSeq = '\\my'; domView = new DOMView(1, (b) => h.block('span', {}, b[0])) }
latexCommands.define('my', MyCmd)
```

## Регрессионный набор

`pnpm dev`, затем открыть `/test/`. Страница прогоняет около 11.5 тыс. сценариев через публичный API (`test/regression/scenarios.js`) и сравнивает результат со снимком `test/regression/snapshot.json`. Если поведение изменилось намеренно, просмотрите расхождения и скачайте новый снимок кнопкой на странице.

`pnpm typecheck` запускает строгую проверку типов.
