/* Kuroha prototype — translation teams page. */
(function () {
  "use strict";

  if (document.body.dataset.page !== "teams") return;

  const teams = window.KUROHA_TEAMS || [];
  const titles = window.KUROHA_TITLES || [];
  const cards = window.KurohaCards;
  const teamsApi = window.KurohaTeams;
  const uploads = window.KurohaUploads;

  if (!teams.length) return;

  const bySlug = new Map(titles.map((item) => [item.slug, item]));
  let current = "";

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function totalChapters(item) {
    if (uploads && typeof uploads.totalFor === "function") {
      return uploads.totalFor(item.slug, item.chapters);
    }
    return item.chapters;
  }

  function teamItems(team) {
    return team.titleSlugs.map((slug) => bySlug.get(slug)).filter(Boolean);
  }

  function teamStats(team) {
    const items = teamItems(team);
    const chapters = items.reduce((sum, item) => sum + totalChapters(item), 0);
    const rating = items.length
      ? items.reduce((sum, item) => sum + Number(item.rating || 0), 0) / items.length
      : 0;
    return { items, chapters, rating };
  }

  function formatRating(value) {
    return String(value.toFixed(1)).replace(".", ",");
  }

  function initials(name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
  }

  function renderSummary() {
    const allItems = titles.filter((item) => teams.some((team) => team.titleSlugs.includes(item.slug)));
    const chapters = allItems.reduce((sum, item) => sum + totalChapters(item), 0);
    const total = $("#team-total");
    const titleTotal = $("#team-title-total");
    const chapterTotal = $("#team-chapter-total");
    if (total) total.textContent = teams.length;
    if (titleTotal) titleTotal.textContent = allItems.length;
    if (chapterTotal) chapterTotal.textContent = chapters;
  }

  function renderTabs() {
    const nav = $("#team-tabs");
    if (!nav) return;
    nav.innerHTML = teams
      .map((team) => {
        const stats = teamStats(team);
        return (
          '<button class="team-tab' + (team.slug === current ? " is-active" : "") +
          '" type="button" data-team="' + team.slug + '" aria-pressed="' +
          (team.slug === current ? "true" : "false") + '">' +
          teamsApi.markHTML(team, "team-mark--xs") +
          '<span class="team-tab__body"><b>' + team.name + '</b><small>' + stats.items.length + ' историй</small></span>' +
          '<span class="team-tab__arrow" aria-hidden="true">→</span>' +
          "</button>"
        );
      })
      .join("");

    const active = nav.querySelector('[aria-pressed="true"]');
    if (active && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = Math.max(
        0,
        active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2
      );
    }
  }

  function renderDetail(team) {
    const detail = $("#team-detail");
    if (!detail) return;
    const stats = teamStats(team);
    const count = $("#team-count");
    if (count) count.textContent = stats.items.length + " историй";

    detail.innerHTML =
      '<div class="team-hero">' +
        '<div class="team-hero__mark">' + teamsApi.markHTML(team, "team-mark--lg") + '</div>' +
        '<div class="team-hero__copy">' +
          '<p class="eyebrow">Команда · с ' + team.since + '</p>' +
          '<h2 id="team-name">' + team.name + '</h2>' +
          '<p class="team-motto">«' + team.motto + '»</p>' +
          '<p class="team-description">' + team.description + '</p>' +
          '<button class="team-follow" type="button" data-team-follow="' + team.slug + '" style="--team-accent:' + team.accent + '" aria-pressed="' + teamsApi.isFollowed(team.slug) + '">' +
            '<span class="team-follow__dot" aria-hidden="true"></span>' +
            '<span data-team-follow-label>' + (teamsApi.isFollowed(team.slug) ? 'Вы следите' : 'Следить за командой') + '</span>' +
          '</button>' +
          '<dl class="team-stats">' +
            '<div><dt>Историй</dt><dd>' + stats.items.length + '</dd></div>' +
            '<div><dt>Глав</dt><dd>' + stats.chapters + '</dd></div>' +
            '<div><dt>Средний рейтинг</dt><dd>' + formatRating(stats.rating) + '</dd></div>' +
          '</dl>' +
        '</div>' +
      '</div>' +
      '<div class="team-members">' +
        '<p class="team-members__label">В команде</p>' +
        '<ul class="team-member-list">' +
          team.members.map(function (member) {
            return '<li class="team-member"><span class="team-member__avatar">' + initials(member.name) +
              '</span><span><b>' + member.name + '</b><small>' + member.role + '</small></span></li>';
          }).join("") +
        '</ul>' +
      '</div>' +
      '<div class="team-titles">' +
        '<div class="team-titles__head"><h3>Истории команды</h3><span>' + stats.items.length + ' историй</span></div>' +
        '<div class="team-grid">' + stats.items.map(function (item) { return cards.cardHTML(item); }).join("") + '</div>' +
      '</div>';
  }

  function updateFollowUI(slug) {
    const button = document.querySelector('[data-team-follow="' + slug + '"]');
    const note = $("#team-follow-note");
    if (button) {
      const following = teamsApi.isFollowed(slug);
      button.classList.toggle("is-active", following);
      button.setAttribute("aria-pressed", String(following));
      const label = button.querySelector("[data-team-follow-label]");
      if (label) label.textContent = following ? "Вы следите" : "Следить за командой";
    }
    if (note) {
      const count = teamsApi.follows().length;
      note.textContent = count
        ? "Ты следишь за " + count + (count === 1 ? " командой." : " командами.")
        : "Подпишись на команду, чтобы не пропускать новые главы.";
    }
  }

  function render() {
    const team = teams.find((entry) => entry.slug === current) || teams[0];
    current = team.slug;
    renderSummary();
    renderTabs();
    renderDetail(team);
    updateFollowUI(team.slug);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("team", current);
      window.history.replaceState({}, "", url);
    } catch (error) {}
  }

  function selectTeam(slug) {
    if (!teams.some((team) => team.slug === slug)) return;
    current = slug;
    render();
    const detail = $("#team-detail");
    if (detail) detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const nav = $("#team-tabs");
  if (nav) {
    nav.addEventListener("click", function (event) {
      const button = event.target.closest("[data-team]");
      if (!button) return;
      selectTeam(button.dataset.team);
    });
  }

  const detail = $("#team-detail");
  if (detail) {
    detail.addEventListener("click", function (event) {
      const button = event.target.closest("[data-team-follow]");
      if (!button) return;
      const following = teamsApi.toggleFollow(button.dataset.teamFollow);
      updateFollowUI(button.dataset.teamFollow);
      const team = teams.find(function (entry) { return entry.slug === button.dataset.teamFollow; });
      if (window.KurohaToast) {
        window.KurohaToast(following
          ? "Ты следишь за командой «" + (team ? team.name : "") + "»."
          : "Подписка на команду отменена.");
      }
    });
  }

  window.addEventListener("kuroha:team-follow-change", function (event) {
    if (event.detail && event.detail.slug) updateFollowUI(event.detail.slug);
  });
  window.addEventListener("storage", function (event) {
    if (event.key === teamsApi.FOLLOWS_KEY) updateFollowUI(current);
  });

  const requested = new URLSearchParams(window.location.search).get("team");
  current = teams.some((team) => team.slug === requested) ? requested : teams[0].slug;
  render();
})();
