# Темы и цвета

Цвета заданы на двух уровнях.

**SCSS-переменные** (`$mq-color-*` в `src/styles/main.scss`) задают значения по умолчанию и вшиваются в собранный `mathquill.css`. Менять их имеет смысл, если вы собираете стили сами и хотите другой базовый вид.

**CSS-переменные** (`--mq-color-*`) перекрывают их во время выполнения. Ничего пересобирать не нужно, и значение можно задать где угодно выше по дереву — на `:root`, на контейнере темы или на конкретном поле.

Библиотека сама не объявляет ни одной CSS-переменной: каждое свойство записано как `var(--mq-…, <значение из SCSS>)`. Пока вы ничего не задали, работает значение по умолчанию; как только задали — ваше.

## Что каким цветом

| Что видно на экране | Переменная | По умолчанию |
|---|---|---|
| Буквы, цифры, операторы | `--mq-color-text` | `currentColor` |
| Скобки и знак радикала (рисуются SVG) | `--mq-color-text` | `currentColor` |
| Дробная черта, черта корня, `\overline`, `\underline`, `\overarc`, стрелки | `--mq-color-text` | `currentColor` |
| Каретка | `--mq-color-cursor` | `currentColor` |
| Фон выделения в сфокусированном поле | `--mq-color-selection` | `#b4d5fe` |
| Символы внутри выделения | `--mq-color-selection-text` | `inherit` |
| Фон выделения, когда поле потеряло фокус | `--mq-color-selection-blur` | `#d4d4d4` |
| Символы внутри такого выделения | `--mq-color-selection-text-blur` | `currentColor` |
| Затенение пустого блока: место под пустым `\sqrt`, пустой числитель | `--mq-color-empty-bg` | `rgba(0, 0, 0, 0.2)` |
| Непарная скобка-призрак | `--mq-ghost-opacity` | `0.2` |
| Рамка редактируемого поля | `--mq-color-border` | `gray` |
| Рамка в фокусе | `--mq-color-border-focused` | `#709ac0` |
| Свечение в фокусе | `--mq-color-shadow-focused`, `--mq-color-shadow-inset-focused` | `#8bd`, `#6ae` |
| Рамка поля ввода `\команды` под кареткой | `--mq-color-border-active` | `#709ac0` |
| Подсветка блока `\text` под кареткой | `--mq-color-hascursor-shadow` | `darkgray` |

Ключевое: `--mq-color-text` отвечает и за символы, и за все линии. Линии рисуются рамками (`border-top`), поэтому раньше они не следовали за цветом текста и в тёмной теме пропадали — теперь следуют.

## Минимум для тёмной темы

Значение по умолчанию `currentColor` означает, что поле наследует цвет текста страницы. Если ваша тёмная тема уже задаёт `color` на `body`, символы и линии станут светлыми сами. Останется поправить то, что `currentColor` выразить не может — фоны:

```css
[data-theme="dark"] {
    --mq-color-selection: #2d5f8f;
    --mq-color-selection-text: #fff;
    --mq-color-selection-blur: #3a3a3a;
    --mq-color-empty-bg: rgba(255, 255, 255, 0.18);
}
```

Затенение пустого блока можно задать один раз на обе темы, если не нужен точный контроль оттенка:

```css
:root {
    --mq-color-empty-bg: color-mix(in srgb, currentColor 20%, transparent);
}
```

`currentColor` здесь — цвет символов, так что в светлой теме получится серая плашка, в тёмной — светлая. `color-mix` работает в браузерах с 2023 года; если нужна поддержка старее, задавайте `rgba()` для каждой темы отдельно.

## Полная тёмная тема

Если тема не задаёт `color` на странице или хочется контролировать всё явно:

```css
[data-theme="dark"] {
    --mq-color-text: #e8e8e8;
    --mq-color-cursor: #e8e8e8;

    --mq-color-selection: #2d5f8f;
    --mq-color-selection-text: #fff;
    --mq-color-selection-blur: #3a3a3a;
    --mq-color-selection-text-blur: #c8c8c8;

    --mq-color-empty-bg: rgba(255, 255, 255, 0.18);

    --mq-color-border: #555;
    --mq-color-border-focused: #5a9fd4;
    --mq-color-border-active: #5a9fd4;
    --mq-color-shadow-focused: #2d5f8f;
    --mq-color-shadow-inset-focused: #3a7ab0;
    --mq-color-hascursor-shadow: #000;
}
```

## Выделение: про контраст

`--mq-color-selection` и `--mq-color-selection-text` надо подбирать парой. Светло-голубой фон по умолчанию рассчитан на тёмные символы; если в тёмной теме символы светлые, а фон выделения остался светлым, текст на нём исчезнет. Поэтому либо затемняйте фон выделения, либо явно задавайте `--mq-color-selection-text`.

`--mq-color-selection-text` по умолчанию `inherit`, то есть символы в выделении сохраняют свой цвет — в том числе покрашенные через `\textcolor{...}`. Как только вы зададите переменную, она перекроет и их.

## Отдельное поле

Переменные наследуются, поэтому их можно задать точечно:

```css
.formula-preview {
    --mq-color-text: #444;
    --mq-color-empty-bg: transparent;
}
```

То же работает и прямо на элементе поля — например, чтобы подсветить поле с ошибкой:

```css
.mq-editable-field.is-invalid {
    --mq-color-border: #c0392b;
    --mq-color-border-focused: #c0392b;
    --mq-color-shadow-focused: #e8a39b;
}
```
