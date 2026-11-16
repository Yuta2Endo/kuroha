(function () {
  "use strict";

  window.KUROHA_READERS = [
    {
      slug: "aya",
      name: "Ая К.",
      handle: "@aya",
      role: "редактор",
      online: true,
      since: 2021,
      accent: "#e63946",
      initials: "АК",
      bio: "Редактор и ночной читатель. Люблю истории, где почти ничего не происходит — и всё меняется.",
      stats: { shelf: 24, chapters: 812, ratings: 63, notes: 18, followers: 184 },
      genres: ["slice", "drama", "romance"],
      current: { slug: "chaynaya-na-uglu", chapter: 14 },
      favorites: ["tihiy-okean", "dom-u-morya", "medlennyy-rassvet"],
      quote: {
        text: "Иногда достаточно одной страницы, чтобы понять: тебя уже кто-то ждал.",
        slug: "tihiy-okean",
        chapter: 12
      },
      club: "night-reading"
    },
    {
      slug: "quiet",
      name: "Тихий читатель",
      handle: "@quiet",
      role: "ночной читатель",
      online: true,
      since: 2022,
      accent: "#a5a3aa",
      initials: "ТЧ",
      bio: "Читаю после полуночи и пишу редко, но метко. Чем тише история, тем внимательнее я слушаю.",
      stats: { shelf: 31, chapters: 1240, ratings: 88, notes: 7, followers: 262 },
      genres: ["mystery", "horror", "thriller"],
      current: { slug: "pod-zemley", chapter: 21 },
      favorites: ["teni-na-stene", "nochnoy-tramvay", "gorod-bez-solntsa"],
      quote: {
        text: "Темнота не пустая. Она просто ждёт, когда ты перестанешь смотреть.",
        slug: "teni-na-stene",
        chapter: 8
      },
      club: "after-midnight"
    },
    {
      slug: "mina",
      name: "Мина С.",
      handle: "@mina",
      role: "автор",
      online: false,
      since: 2020,
      accent: "#b52d38",
      initials: "МС",
      bio: "Пишу о людях, которые ищут свет в местах, где его давно не включали. Иногда нахожу его сама.",
      stats: { shelf: 18, chapters: 640, ratings: 41, notes: 22, followers: 431 },
      genres: ["fantasy", "mystery", "drama"],
      current: { slug: "pepel-i-luna", chapter: 30 },
      favorites: ["pepel-i-luna", "kniga-zabytyh-imyon", "posledniy-hranitel"],
      quote: {
        text: "Не ищи меня среди имён. Я останусь между строк — там, где ты ещё не смотрел.",
        slug: "pepel-i-luna",
        chapter: 12
      },
      club: "night-reading"
    },
    {
      slug: "rin",
      name: "Рина Д.",
      handle: "@rin",
      role: "редактор",
      online: true,
      since: 2021,
      accent: "#6f8f7a",
      initials: "РД",
      bio: "Собираю письма, дожди и короткие главы. Верю, что у каждой книги есть адресат.",
      stats: { shelf: 27, chapters: 930, ratings: 57, notes: 12, followers: 149 },
      genres: ["drama", "romance", "slice"],
      current: { slug: "pisma-k-severu", chapter: 18 },
      favorites: ["pisma-k-severu", "komnata-dozhdya", "bumazhnye-ptitsy"],
      quote: {
        text: "Дождь не мешает слушать. Он просто даёт паузу.",
        slug: "komnata-dozhdya",
        chapter: 7
      },
      club: "text-only"
    },
    {
      slug: "haru",
      name: "Хару М.",
      handle: "@haru",
      role: "леттеринг",
      online: false,
      since: 2023,
      accent: "#8a7f72",
      initials: "ХМ",
      bio: "Рисую буквы и читаю то, что пахнет чаем, бумагой и поздним вечером.",
      stats: { shelf: 15, chapters: 420, ratings: 33, notes: 5, followers: 97 },
      genres: ["romance", "comedy", "slice"],
      current: { slug: "chaynaya-na-uglu", chapter: 8 },
      favorites: ["tihiy-sad", "letniy-dozhd", "malenkaya-biblioteka"],
      quote: {
        text: "Тишина тоже умеет цвести. Просто для этого нужно немного места.",
        slug: "tihiy-sad",
        chapter: 9
      },
      club: "night-reading"
    },
    {
      slug: "yan",
      name: "Ян С.",
      handle: "@yan",
      role: "тайпсет",
      online: false,
      since: 2022,
      accent: "#ff6b73",
      initials: "ЯС",
      bio: "Люблю карты, длинные дороги и шрифты, которые держат строку, как ветер — парус.",
      stats: { shelf: 22, chapters: 760, ratings: 46, notes: 9, followers: 113 },
      genres: ["adventure", "fantasy", "history"],
      current: { slug: "severnaya-zvezda", chapter: 40 },
      favorites: ["severnaya-zvezda", "doch-vetra", "zheleznyy-les"],
      quote: {
        text: "Ветер не спрашивает дороги. Он просто знает, куда ему лететь.",
        slug: "doch-vetra",
        chapter: 18
      },
      club: null
    }
  ];

  window.KurohaReaders = window.KurohaReaders || {};
})();
