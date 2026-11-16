/* Kuroha prototype — genres and editorial collections. */
window.KUROHA_GENRES = [
  {
    slug: "fantasy",
    title: "Фэнтези",
    kicker: "Миры, где у желания есть цена",
    description: "Магия здесь не отменяет правил — она делает их заметнее. Истории о городах, которые помнят больше людей, и о выборе, который приходится делать без подсказок.",
    accent: "#c9a25e"
  },
  {
    slug: "romance",
    title: "Романтика",
    kicker: "Близость без громких слов",
    description: "Не про фейерверки, а про паузы. Про людей, которые учатся говорить важное шёпотом и возвращаться туда, где их ждут.",
    accent: "#d27a86"
  },
  {
    slug: "drama",
    title: "Драма",
    kicker: "То, что остаётся после",
    description: "Истории, где нет злодеев — только люди, их решения и утро, которое всё меняет. Читать лучше медленно.",
    accent: "#9db4ff"
  },
  {
    slug: "action",
    title: "Боевик",
    kicker: "Когда слова уже не работают",
    description: "Погони, клинки и точный расчёт. Но за каждым ударом — причина, о которой герой предпочёл бы молчать.",
    accent: "#e3c98f"
  },
  {
    slug: "mystery",
    title: "Мистика",
    kicker: "Вопросы без ответов",
    description: "Двери, которые открываются не туда. Письма без адреса. Люди, которые слишком хорошо помнят то, чего не было.",
    accent: "#9db4ff"
  },
  {
    slug: "slice",
    title: "Повседневность",
    kicker: "Тишина между главами",
    description: "Чай, дождь, разговоры на кухне. Истории, в которых ничего не происходит — и происходит всё.",
    accent: "#7fa88a"
  },
  {
    slug: "history",
    title: "История",
    kicker: "Прошлое не отпускает",
    description: "Караваны, дворцы и письма, которым сотни лет. Здесь прошлое — не декорация, а действующее лицо.",
    accent: "#e9e1d2"
  },
  {
    slug: "scifi",
    title: "Фантастика",
    kicker: "Будущее уже здесь",
    description: "Стеклянные города, фонари вместо солнца и технологии, которые обещали сделать людей ближе.",
    accent: "#9db4ff"
  },
  {
    slug: "horror",
    title: "Ужасы",
    kicker: "Не выключай свет",
    description: "Страх живёт не в темноте, а в привычном. В новой квартире, на знакомой станции, в отражении, которое чуть отстаёт.",
    accent: "#d27a86"
  },
  {
    slug: "comedy",
    title: "Комедия",
    kicker: "Смех на ночь",
    description: "Тёплые истории, где герои падают, встают и заказывают ещё чай. Без злых шуток и без спешки.",
    accent: "#7fa88a"
  },
  {
    slug: "adventure",
    title: "Приключения",
    kicker: "Дорога важнее цели",
    description: "Экспедиции, карты без белых пятен и попутчики, которых выбирает не герой, а погода.",
    accent: "#e3c98f"
  },
  {
    slug: "thriller",
    title: "Триллер",
    kicker: "Один шаг до развязки",
    description: "Напряжение, которое держится на деталях. Здесь важно, кто вошёл в комнату и что он не сказал.",
    accent: "#d27a86"
  }
];

window.KUROHA_COLLECTIONS = [
  {
    slug: "dark-side",
    title: "Тёмная сторона",
    label: "Для позднего вечера",
    description: "Мистика, ужасы и триллеры для часов, когда город уже спит, а история только начинается.",
    note: "Собрание для тех, кто читает с лампой. Здесь чем тише страница, тем громче она звучит.",
    curator: "Куро",
    accent: "#d27a86",
    c1: "#2a1f3d",
    c2: "#080b14",
    art: "moon",
    titleSlugs: [
      "pepel-i-luna",
      "poslednee-pismo",
      "krasnaya-nit",
      "steklyannyy-gorod",
      "pod-zemley",
      "nochnoy-tramvay",
      "teni-na-stene",
      "gorod-bez-solntsa"
    ]
  },
  {
    slug: "light-stories",
    title: "Светлые истории",
    label: "Чтобы выдохнуть",
    description: "Повседневность, романтика и немного тепла. Для вечера, когда хочется закрыть ноутбук и просто побыть рядом.",
    note: "Не все истории должны спасать мир. Иногда достаточно сохранить один вечер.",
    curator: "Куро",
    accent: "#7fa88a",
    c1: "#1f3a44",
    c2: "#0a0f1c",
    art: "window",
    titleSlugs: [
      "tihiy-okean",
      "dom-u-morya",
      "tihiy-sad",
      "chaynaya-na-uglu",
      "zimniy-svet",
      "medlennyy-rassvet",
      "letniy-dozhd",
      "malenkaya-biblioteka",
      "bumazhnye-ptitsy"
    ]
  },
  {
    slug: "until-dawn",
    title: "До рассвета",
    label: "Завершённые истории",
    description: "Истории, у которых уже есть финал. Можно прочитать за одну ночь и не ждать следующую главу.",
    note: "Для тех, кто устал от ожидания. Здесь всё уже сказано — осталось только дочитать.",
    curator: "Куро",
    accent: "#e3c98f",
    c1: "#3a2f22",
    c2: "#0a0f1c",
    art: "arch",
    titleSlugs: [
      "tihiy-okean",
      "dom-u-morya",
      "poslednee-pismo",
      "bumazhnye-ptitsy",
      "zimniy-svet",
      "pesnya-dlya-luny",
      "teplyy-sneg",
      "doch-vetra",
      "medlennyy-rassvet",
      "letniy-dozhd",
      "malenkaya-biblioteka"
    ]
  },
  {
    slug: "other-worlds",
    title: "Другие миры",
    label: "За пределами карты",
    description: "Фэнтези, фантастика и приключения. Места, где правила знакомы только местным — и им тоже не всегда.",
    note: "Хорошая карта всегда заканчивается там, где начинается история.",
    curator: "Куро",
    accent: "#9db4ff",
    c1: "#182a4a",
    c2: "#070b14",
    art: "grid",
    titleSlugs: [
      "klinok-vetra",
      "severnaya-zvezda",
      "steklyannyy-gorod",
      "zheleznyy-les",
      "doch-vetra",
      "kniga-zabytyh-imyon",
      "gorod-bez-solntsa",
      "malenkaya-biblioteka",
      "pesnya-dlya-luny"
    ]
  },
  {
    slug: "quiet-evening",
    title: "Тихий вечер",
    label: "Медленное чтение",
    description: "Драма, повседневность и романтика без спешки. Для дождя за окном и чашки, которая уже остыла.",
    note: "Это собрание лучше читать без таймера. Одна глава — один вечер.",
    curator: "Куро",
    accent: "#7fa88a",
    c1: "#24382e",
    c2: "#070b14",
    art: "leaf",
    titleSlugs: [
      "tihiy-okean",
      "tihiy-sad",
      "dom-u-morya",
      "zimniy-svet",
      "teplyy-sneg",
      "medlennyy-rassvet",
      "letniy-dozhd",
      "poslednee-pismo"
    ]
  },
  {
    slug: "paper-and-ink",
    title: "Бумага и чернила",
    label: "Истории о историях",
    description: "Письма, библиотеки и книги, которые помнят больше, чем люди. Для тех, кто верит, что страница может изменить день.",
    note: "Куро выбрала эти истории лично. У каждой на корешке остался след от пера.",
    curator: "Куро",
    accent: "#e9e1d2",
    c1: "#3a3440",
    c2: "#0a0f1c",
    art: "thread",
    titleSlugs: [
      "pepel-i-luna",
      "poslednee-pismo",
      "bumazhnye-ptitsy",
      "kniga-zabytyh-imyon",
      "malenkaya-biblioteka",
      "chaynaya-na-uglu",
      "nochnoy-tramvay"
    ]
  },
  {
    slug: "text-only",
    title: "Только текст",
    label: "Новеллы",
    description: "Истории, где мир держится на слове. Без картинок и панелей — только голос, пауза и страница, которую хочется перечитать.",
    note: "Иногда достаточно одной точной фразы. Всё остальное дорисует ночь.",
    curator: "Куро",
    accent: "#9db4ff",
    c1: "#1f2e44",
    c2: "#070b14",
    art: "thread",
    titleSlugs: [
      "pisma-k-severu",
      "sol-i-zvezdy",
      "komnata-dozhdya",
      "bumazhnyy-gorod",
      "tishina-na-vtorom-etazhe",
      "posledniy-hranitel"
    ]
  }
];
