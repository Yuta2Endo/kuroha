/* Kuroha prototype — fictional translation teams. */
window.KUROHA_TEAMS = [
  {
    slug: "night-editorial",
    name: "Ночная редакция",
    motto: "Свет только там, где нужно.",
    description:
      "Собирают истории о городе, который не спит: тайны, ночные трамваи и людей, которые слишком долго ждут. Любят плотные тени, короткие главы и финалы, после которых хочется закрыть вкладку и посидеть в тишине.",
    since: "2022",
    accent: "#E63946",
    mark: "torii",
    members: [
      { name: "Мина С.", role: "автор" },
      { name: "Тэра В.", role: "перевод" },
      { name: "Ая К.", role: "редактура" }
    ],
    titleSlugs: [
      "pepel-i-luna",
      "pod-zemley",
      "teni-na-stene",
      "nochnoy-tramvay",
      "gorod-bez-solntsa",
      "tishina-na-vtorom-etazhe"
    ]
  },
  {
    slug: "quiet-pages",
    name: "Тихие страницы",
    motto: "Истории, которые не спешат.",
    description:
      "Море, чай, дождь за окном и люди, которым важно успеть сказать главное. Команда любит медленные паузы, тёплые диалоги и истории, где почти ничего не происходит — и происходит всё.",
    since: "2021",
    accent: "#6F8F7A",
    mark: "wave",
    members: [
      { name: "Ая К.", role: "перевод" },
      { name: "Хару М.", role: "редактура" },
      { name: "Нина В.", role: "леттеринг" }
    ],
    titleSlugs: [
      "tihiy-okean",
      "dom-u-morya",
      "chaynaya-na-uglu",
      "zimniy-svet",
      "medlennyy-rassvet",
      "malenkaya-biblioteka"
    ]
  },
  {
    slug: "north-wind",
    name: "Северный ветер",
    motto: "Дорога начинается за горизонтом.",
    description:
      "Приключения, ветер и дороги, которые не заканчиваются на последней странице. Здесь любят большие миры, упрямых героев и карты, на которых ещё остались белые пятна.",
    since: "2023",
    accent: "#A5A3AA",
    mark: "wind",
    members: [
      { name: "Линь В.", role: "перевод" },
      { name: "Альва К.", role: "редактура" },
      { name: "Ян С.", role: "тайпсет" }
    ],
    titleSlugs: [
      "klinok-vetra",
      "severnaya-zvezda",
      "zheleznyy-les",
      "doch-vetra",
      "sol-i-zvezdy",
      "bumazhnyy-gorod"
    ]
  },
  {
    slug: "paper-house",
    name: "Бумажный дом",
    motto: "Письма, которые находят адресата.",
    description:
      "Письма, бумажные птицы и тёплые истории, которые хочется перечитывать. Команда бережёт бумажную фактуру, длинные письма и маленькие детали, из которых собирается дом.",
    since: "2020",
    accent: "#9A8F82",
    mark: "paper",
    members: [
      { name: "Ида Л.", role: "перевод" },
      { name: "Рина Д.", role: "редактура" },
      { name: "Тэра М.", role: "корректура" }
    ],
    titleSlugs: [
      "poslednee-pismo",
      "bumazhnye-ptitsy",
      "krasnaya-nit",
      "teplyy-sneg",
      "letniy-dozhd",
      "pisma-k-severu"
    ]
  },
  {
    slug: "midnight",
    name: "Полночь",
    motto: "Когда история становится мифом.",
    description:
      "Мифы, сны и городские легенды для тех, кто читает после полуночи. Здесь не боятся странных финалов, необъяснимых встреч и историй, которые начинаются с одной фразы.",
    since: "2024",
    accent: "#B52D38",
    mark: "moon",
    members: [
      { name: "Мина С.", role: "автор" },
      { name: "Ида Л.", role: "перевод" },
      { name: "Рина Д.", role: "редактура" }
    ],
    titleSlugs: [
      "tihiy-sad",
      "steklyannyy-gorod",
      "pesnya-dlya-luny",
      "kniga-zabytyh-imyon",
      "komnata-dozhdya",
      "posledniy-hranitel"
    ]
  }
];

(function () {
  const MARKS = {
    torii: '<circle cx="32" cy="32" r="21" fill="currentColor" opacity=".12"/><path d="M13 21h38M17 27h30M20 27v24M44 27v24M25 38h14"/>',
    wave: '<path d="M7 27c6-8 12-8 18 0s12 8 18 0 12-8 18 0"/><path d="M7 40c6-6 12-6 18 0s12 6 18 0 12-6 18 0"/><path d="M16 49h32"/>',
    wind: '<path d="M8 23h27c7 0 7-10 0-10-3 0-5 2-5 4"/><path d="M8 33h38c8 0 8 11 0 11-3 0-5-2-5-4"/><path d="M8 43h17"/>',
    paper: '<path d="M20 10h19l9 9v35H20z"/><path d="M39 10v9h9M27 28h14M27 36h11M27 44h8"/>',
    moon: '<path d="M42 11a21 21 0 1 0 10 35A23 23 0 0 1 42 11Z"/><path d="m49 12 1.7 4.8L56 18.5l-5.3 1.7L49 25l-1.7-4.8L42 18.5l5.3-1.7Z"/>'
  };

  function markHTML(team, extraClass) {
    const mark = MARKS[team.mark] || MARKS.moon;
    return '<span class="team-mark ' + (extraClass || '') + '" style="--team-accent:' + team.accent + '" aria-hidden="true">' +
      '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      mark + '</svg></span>';
  }

  function forTitle(slug) {
    return (window.KUROHA_TEAMS || []).find(function (team) {
      return team.titleSlugs.indexOf(slug) !== -1;
    }) || null;
  }

  const FOLLOWS_KEY = "kuroha-team-follows";

  function readFollows() {
    try {
      const value = JSON.parse(localStorage.getItem(FOLLOWS_KEY) || "[]");
      return Array.isArray(value) ? value.filter(function (slug) { return typeof slug === "string"; }) : [];
    } catch (error) {
      return [];
    }
  }

  function isFollowed(slug) {
    return readFollows().indexOf(slug) !== -1;
  }

  function toggleFollow(slug) {
    const follows = readFollows();
    const index = follows.indexOf(slug);
    const following = index === -1;
    if (following) follows.push(slug);
    else follows.splice(index, 1);
    try {
      localStorage.setItem(FOLLOWS_KEY, JSON.stringify(follows));
    } catch (error) {}
    window.dispatchEvent(new CustomEvent("kuroha:team-follow-change", {
      detail: { slug: slug, following: following }
    }));
    return following;
  }

  window.KurohaTeams = {
    markHTML: markHTML,
    forTitle: forTitle,
    FOLLOWS_KEY: FOLLOWS_KEY,
    follows: readFollows,
    isFollowed: isFollowed,
    toggleFollow: toggleFollow
  };
})();
