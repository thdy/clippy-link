const FORMATS = [
  {
    id: "title_space_url",
    label: "タイトル + URL",
    hint: "Title https://…",
    build: (title, url) => `${title} ${url}`,
  },
  {
    id: "title_newline_url",
    label: "タイトル + 改行 + URL",
    hint: "Title↵https://…",
    build: (title, url) => `${title}\n${url}`,
  },
  {
    id: "markdown",
    label: "Markdown",
    hint: "[Title](https://…)",
    build: (title, url) => `[${title}](${url})`,
  },
  {
    id: "url_only",
    label: "URLのみ",
    hint: "https://…",
    build: (title, url) => url,
  },
];

const DEFAULT_FORMAT_ID = "title_space_url";

let currentTitle = "";
let currentUrl = "";
let currentRawUrl = "";
let lastCopiedFormatId = null;

function stripQueryParams(url) {
  try {
    const u = new URL(url);
    u.search = "";
    return u.toString();
  } catch {
    return url;
  }
}

async function getStripQuery() {
  return new Promise((resolve) => {
    chrome.storage.sync.get("stripQuery", (result) => {
      resolve(result.stripQuery === true);
    });
  });
}

async function saveStripQuery(value) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ stripQuery: value }, resolve);
  });
}

async function getDefaultFormatId() {
  return new Promise((resolve) => {
    chrome.storage.sync.get("defaultFormat", (result) => {
      resolve(result.defaultFormat || DEFAULT_FORMAT_ID);
    });
  });
}

async function saveDefaultFormatId(formatId) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ defaultFormat: formatId }, resolve);
  });
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

function renderFormats(defaultId, excludeId) {
  const container = document.getElementById("formats");
  container.innerHTML = "";

  for (const fmt of FORMATS) {
    const btn = document.createElement("button");
    btn.className = "format-btn";
    if (fmt.id === defaultId) {
      btn.classList.add("is-default");
    }

    btn.innerHTML = `<span class="label">${fmt.label}</span><span class="hint">${fmt.hint}</span>`;

    btn.addEventListener("click", async () => {
      const text = fmt.build(currentTitle, currentUrl);
      await copyToClipboard(text);

      lastCopiedFormatId = fmt.id;

      // ステータスを更新
      document.getElementById("status-text").textContent = "コピーしました！";
      document.getElementById("preview").textContent = text;

      // ボタンのフィードバック（他のボタンのコピー済み状態をリセット）
      container.querySelectorAll(".format-btn").forEach((b) => {
        b.classList.remove("copied");
        const f = FORMATS.find((format) => b.querySelector(".label").textContent.replace(" (デフォルト)", "") === format.label);
        if (f) {
          b.querySelector(".hint").textContent = f.hint;
        }
      });
      btn.classList.add("copied");
      btn.querySelector(".hint").textContent = "✓ コピー済み";

      // デフォルト設定トグルを表示
      const toggle = document.getElementById("default-toggle");
      const checkbox = document.getElementById("set-default");
      if (fmt.id !== defaultId) {
        toggle.classList.add("visible");
        checkbox.checked = false;
      } else {
        toggle.classList.remove("visible");
      }
    });

    container.appendChild(btn);
  }
}

function recopyLastFormat() {
  if (!lastCopiedFormatId) return;
  const fmt = FORMATS.find((f) => f.id === lastCopiedFormatId);
  if (!fmt) return;

  const text = fmt.build(currentTitle, currentUrl);
  copyToClipboard(text);
  document.getElementById("preview").textContent = text;
}

function markCopiedButton(formatLabel) {
  const buttons = document.querySelectorAll(".format-btn");
  for (const btn of buttons) {
    const label = btn.querySelector(".label").textContent.replace(" (デフォルト)", "");
    if (label === formatLabel) {
      btn.classList.add("copied");
      btn.querySelector(".hint").textContent = "✓ コピー済み";
      break;
    }
  }
}

async function init() {
  // 現在のタブ情報を取得
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTitle = tab.title || "";
  currentRawUrl = tab.url || "";

  // クエリパラメータ除去の設定を取得
  const stripQuery = await getStripQuery();
  const stripCheckbox = document.getElementById("strip-query");
  stripCheckbox.checked = stripQuery;
  currentUrl = stripQuery ? stripQueryParams(currentRawUrl) : currentRawUrl;

  // デフォルトフォーマットを取得
  const defaultId = await getDefaultFormatId();
  const defaultFormat = FORMATS.find((f) => f.id === defaultId) || FORMATS[0];

  // デフォルト形式で即座にコピー
  const text = defaultFormat.build(currentTitle, currentUrl);
  await copyToClipboard(text);
  lastCopiedFormatId = defaultId;

  // プレビュー表示
  document.getElementById("preview").textContent = text;

  // フォーマットボタンを描画
  renderFormats(defaultId);

  // デフォルトフォーマットのボタンにcopied表示
  markCopiedButton(defaultFormat.label);

  // クエリパラメータ除去チェックボックス
  stripCheckbox.addEventListener("change", async (e) => {
    const strip = e.target.checked;
    await saveStripQuery(strip);
    currentUrl = strip ? stripQueryParams(currentRawUrl) : currentRawUrl;
    recopyLastFormat();
  });

  // デフォルト設定チェックボックス
  document.getElementById("set-default").addEventListener("change", async (e) => {
    if (e.target.checked && lastCopiedFormatId) {
      await saveDefaultFormatId(lastCopiedFormatId);

      // ボタンのデフォルト表示を更新
      renderFormats(lastCopiedFormatId);

      // 再度コピー済み表示
      const fmt = FORMATS.find((f) => f.id === lastCopiedFormatId);
      if (fmt) markCopiedButton(fmt.label);

      // トグルを非表示に
      document.getElementById("default-toggle").classList.remove("visible");
    }
  });
}

init();
