# Иконки элементов

## Решение

Оригинальные иконки предметов `Tiles Survive` в открытых источниках не найдены:

- официальный сайт публикует промо-графику и изображения героев, но не отдельные иконки ресурсов;
- неофициальная Fandom-вики содержит только фоновые изображения и не содержит предметных иконок;
- сторонний дата-хаб не публикует доступный набор предметных изображений.

Для первого интерфейса собран открытый набор SVG с [Game-icons.net](https://game-icons.net/) и из репозитория [game-icons/icons](https://github.com/game-icons/icons).

Иконки находятся в:

```text
frontend/public/icons/resources/
```

Превью всего набора доступно по адресу `/icons/preview.html` при запущенном frontend.

SVG адаптированы для интерфейса:

- удален черный фон;
- цвет изображения заменен на `currentColor`;
- цвет можно задавать обычным CSS-свойством `color`.

## Карта элементов

| Игровой элемент | Файл |
| --- | --- |
| Обломки снаряжения | `gear-scraps.svg` |
| Снаряжение из сплава | `alloy-gear.svg` |
| Молот перековки | `reforge-hammer.svg` |
| Изолента для перековки | `reforge-tape.svg` |
| Болты T1 / T2 / T3 | `common-parts.svg`, цвет задается из БД |
| Ускорение исследования | `research-speedup.svg` |
| Ускорение строительства | `construction-speedup.svg` |
| Солдаты ур. 1-10 | `soldiers.svg` |
| Клетка титана | `titan-cell.svg` |
| Опыт / сыворотка титана | `titan-experience.svg` |
| Биогенный белок | `biogenic-protein.svg` |
| Общие детали | `common-parts.svg` |
| Точные чертежи | `precise-blueprints.svg` |
| Купоны героя | `hero-coupon.svg` |
| Жетоны продвинутого призыва | `advanced-summon.svg` |
| Жетоны стандартного призыва | `standard-summon.svg` |
| Фрагмент легендарного героя | `legendary-hero-fragment.svg` |
| Фрагмент эпического героя | `epic-hero-fragment.svg` |
| Фрагмент редкого героя | `rare-hero-fragment.svg` |
| Руководство навыков героя | `hero-skill-guide.svg` |
| Зараженные | `infected.svg` |
| Нечестивые зараженные / рейд | `raid-infected.svg` |
| Зараженные в разведмиссиях | `scout-infected.svg` |
| Еда | `food.svg` |
| Древесина | `wood.svg` |
| Металл | `metal.svg` |
| Топливо | `fuel.svg` |
| Алмазы из наборов | `diamonds.svg` |

## Использование

Пример:

```html
<img class="resource-icon" src="/icons/resources/gear-scraps.svg" alt="" />
```

```css
.resource-icon {
  width: 24px;
  height: 24px;
  color: #0f6b4b;
}
```

При загрузке SVG через `<img>` свойство `currentColor` внутри файла может не наследовать цвет родителя во всех браузерах. Для полного управления цветом иконку следует подключать как inline SVG, через компонент или маску CSS.

## Атрибуция и лицензия

Иконки предоставлены [Game-icons.net](https://game-icons.net/) по лицензии Creative Commons Attribution 3.0, если для конкретного автора не указано иное.

Использованные авторы:

- Lorc;
- Delapouite;
- Faithtoken;
- Quoting;
- SeregaCthtuf.

Требуемая атрибуция:

> Icons made by Lorc, Delapouite, Faithtoken, Quoting and SeregaCthtuf. Available on Game-icons.net under CC BY 3.0.

Подробная лицензия исходного набора:

- https://github.com/game-icons/icons/blob/master/license.txt

## Будущая замена

Если появятся оригинальные игровые иконки, достаточно заменить SVG-файлы с сохранением текущих имен. Компоненты и привязка элементов калькулятора при этом не изменятся.
