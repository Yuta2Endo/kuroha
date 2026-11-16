/* Kuroha prototype — reading clubs data. */
(function () {
  "use strict";

  window.KUROHA_CLUBS = [
    {
      slug: "night-reading",
      name: "Ночная читальня",
      accent: "#E63946",
      mark: "moon",
      since: "2023",
      description:
        "Клуб для тех, кто читает после полуночи. Одна глава в день, без спешки и без спойлеров. Здесь можно остановиться на фразе, вернуться на страницу назад и написать об этом другим.",
      motto: "Одна глава в день. Без спешки.",
      currentSlug: "pepel-i-luna",
      members: [
        "Мина С.",
        "Ая К.",
        "Тэра В.",
        "Ида Л.",
        "Рина Д.",
        "Нина В.",
        "Хару М."
      ],
      nextDay: 0,
      nextTime: "21:00",
      meeting: {
        topic: "Главы 1–12",
        duration: "60 минут",
        place: "Telegram · голосовой чат",
        note: "Без спойлеров. Приходи, даже если не дочитал.",
        attending: 5,
        seats: 12
      },
      plan: [
        { label: "Неделя 1", from: 1, to: 12 },
        { label: "Неделя 2", from: 13, to: 24 },
        { label: "Неделя 3", from: 25, to: 36 },
        { label: "Неделя 4", from: 37, to: 48 }
      ],
      candidates: [
        { slug: "poslednee-pismo", votes: 4 },
        { slug: "kniga-zabytyh-imyon", votes: 3 },
        { slug: "gorod-bez-solntsa", votes: 2 }
      ],
      question: "Что остаётся за строкой, когда книга закрыта?",
      quote:
        "Иногда история начинается не с картинки, а с фразы, которую хочется перечитать.",
      quoteAuthor: "Ая К., участница клуба"
    },
    {
      slug: "text-only",
      name: "Только текст",
      accent: "#A5A3AA",
      mark: "pages",
      since: "2022",
      description:
        "Клуб новелл, писем и историй, где всё держится на слове. Здесь читают медленно, отмечают любимые абзацы и иногда спорят о том, что важнее — сюжет или одна точная фраза.",
      motto: "Слушай, как звучит фраза.",
      currentSlug: "pisma-k-severu",
      members: ["Ида Л.", "Тина Р.", "Марк В.", "Яна С.", "Лера К."],
      nextDay: 1,
      nextTime: "20:00",
      meeting: {
        topic: "Главы 1–8",
        duration: "45 минут",
        place: "Discord · текстовый чат",
        note: "Можно молчать и слушать. Текст никуда не спешит.",
        attending: 4,
        seats: 10
      },
      plan: [
        { label: "Неделя 1", from: 1, to: 8 },
        { label: "Неделя 2", from: 9, to: 17 },
        { label: "Неделя 3", from: 18, to: 26 },
        { label: "Неделя 4", from: 27, to: 34 }
      ],
      candidates: [
        { slug: "komnata-dozhdya", votes: 3 },
        { slug: "sol-i-zvezdy", votes: 2 },
        { slug: "posledniy-hranitel", votes: 1 }
      ],
      question: "Кому на самом деле адресованы письма?",
      quote:
        "Некоторые письма нужно читать медленно, иначе они не успевают дойти.",
      quoteAuthor: "Ида Л., участница клуба"
    },
    {
      slug: "after-midnight",
      name: "После полуночи",
      accent: "#B52D38",
      mark: "spark",
      since: "2024",
      description:
        "Триллеры, мистика и истории, после которых хочется проверить, закрыта ли дверь. Читаем по вечерам, обсуждаем шёпотом и не раскрываем развязку раньше времени.",
      motto: "Темнота любит внимательных.",
      currentSlug: "pod-zemley",
      members: [
        "Мина С.",
        "Рина Д.",
        "Ян С.",
        "Лера К.",
        "Тэра В.",
        "Нина В.",
        "Ая К.",
        "Ида Л.",
        "Хару М."
      ],
      nextDay: 4,
      nextTime: "23:00",
      meeting: {
        topic: "Главы 1–9",
        duration: "90 минут",
        place: "Telegram · голосовой чат",
        note: "Свет выключен, уведомления тоже. Обсуждаем шёпотом.",
        attending: 7,
        seats: 16
      },
      plan: [
        { label: "Неделя 1", from: 1, to: 9 },
        { label: "Неделя 2", from: 10, to: 18 },
        { label: "Неделя 3", from: 19, to: 27 },
        { label: "Неделя 4", from: 28, to: 36 }
      ],
      candidates: [
        { slug: "teni-na-stene", votes: 5 },
        { slug: "nochnoy-tramvay", votes: 3 },
        { slug: "gorod-bez-solntsa", votes: 2 }
      ],
      question: "Что страшнее — темнота или тишина?",
      quote:
        "Самые громкие истории начинаются с тишины под землёй.",
      quoteAuthor: "Рина Д., участница клуба"
    }
  ];
})();
