const LANGUAGES = [
  {
    code: "en",
    name: "English",
    result: { yes: "Yes", no: "No" },
    labels: {
      language: "Language",
      loadingSources: "Loading sources",
      checkingNow: "Checking now",
      scanning: "Analyzing news with Groq",
      latestNews: "Latest news",
      loading: "Loading analysis",
      checking: "Checking...",
      refresh: "Refresh",
      sources: (count) => `${count} recent source${count === 1 ? "" : "s"}`,
      checked: (time) => `Checked ${time}`,
      matches: (count) => `${count} supporting source${count === 1 ? "" : "s"}`,
      noResult: "No current result",
      failed: "Request failed",
      noScan: "No scan result",
      loadError: "Unable to load Neymar news."
    }
  },
  {
    code: "zh",
    name: "中文",
    result: { yes: "是", no: "否" },
    labels: {
      language: "语言",
      loadingSources: "正在加载来源",
      checkingNow: "正在检查",
      scanning: "正在扫描伤病词",
      latestNews: "最新新闻",
      loading: "正在加载分析",
      checking: "正在检查...",
      refresh: "刷新",
      sources: (count) => `${count} 条近期来源`,
      checked: (time) => `检查时间 ${time}`,
      matches: (count) => `${count} 条伤病相关匹配`,
      noResult: "没有当前结果",
      failed: "请求失败",
      noScan: "没有扫描结果",
      loadError: "无法加载 Neymar 新闻。"
    }
  },
  {
    code: "hi",
    name: "हिन्दी",
    result: { yes: "हाँ", no: "नहीं" },
    labels: {
      language: "भाषा",
      loadingSources: "स्रोत लोड हो रहे हैं",
      checkingNow: "अभी जांच हो रही है",
      scanning: "चोट से जुड़े शब्द खोजे जा रहे हैं",
      latestNews: "ताज़ा खबरें",
      loading: "विश्लेषण लोड हो रहा है",
      checking: "जांच हो रही है...",
      refresh: "रीफ्रेश",
      sources: (count) => `${count} हालिया स्रोत`,
      checked: (time) => `${time} पर जांचा गया`,
      matches: (count) => `${count} चोट-संबंधित मिलान`,
      noResult: "अभी कोई परिणाम नहीं",
      failed: "अनुरोध विफल",
      noScan: "कोई स्कैन परिणाम नहीं",
      loadError: "Neymar की खबरें लोड नहीं हो सकीं।"
    }
  },
  {
    code: "es",
    name: "Español",
    result: { yes: "Sí", no: "No" },
    labels: {
      language: "Idioma",
      loadingSources: "Cargando fuentes",
      checkingNow: "Consultando ahora",
      scanning: "Buscando términos de lesión",
      latestNews: "Últimas noticias",
      loading: "Cargando análisis",
      checking: "Consultando...",
      refresh: "Actualizar",
      sources: (count) => `${count} fuente${count === 1 ? "" : "s"} reciente${count === 1 ? "" : "s"}`,
      checked: (time) => `Consultado ${time}`,
      matches: (count) => `${count} coincidencia${count === 1 ? "" : "s"} sobre lesión`,
      noResult: "Sin resultado actual",
      failed: "Solicitud fallida",
      noScan: "Sin resultado de análisis",
      loadError: "No se pudieron cargar las noticias de Neymar."
    }
  },
  {
    code: "fr",
    name: "Français",
    result: { yes: "Oui", no: "Non" },
    labels: {
      language: "Langue",
      loadingSources: "Chargement des sources",
      checkingNow: "Vérification en cours",
      scanning: "Recherche de termes de blessure",
      latestNews: "Dernières nouvelles",
      loading: "Chargement de l'analyse",
      checking: "Vérification...",
      refresh: "Actualiser",
      sources: (count) => `${count} source${count === 1 ? "" : "s"} récente${count === 1 ? "" : "s"}`,
      checked: (time) => `Vérifié ${time}`,
      matches: (count) => `${count} correspondance${count === 1 ? "" : "s"} liée${count === 1 ? "" : "s"} à une blessure`,
      noResult: "Aucun résultat actuel",
      failed: "Requête échouée",
      noScan: "Aucun résultat d'analyse",
      loadError: "Impossible de charger les nouvelles de Neymar."
    }
  },
  {
    code: "ar",
    name: "العربية",
    dir: "rtl",
    result: { yes: "نعم", no: "لا" },
    labels: {
      language: "اللغة",
      loadingSources: "جار تحميل المصادر",
      checkingNow: "جار التحقق الآن",
      scanning: "جار البحث عن كلمات الإصابة",
      latestNews: "آخر الأخبار",
      loading: "جار تحميل التحليل",
      checking: "جار التحقق...",
      refresh: "تحديث",
      sources: (count) => `${count} مصدر حديث`,
      checked: (time) => `تم التحقق ${time}`,
      matches: (count) => `${count} تطابق متعلق بالإصابة`,
      noResult: "لا توجد نتيجة حالية",
      failed: "فشل الطلب",
      noScan: "لا توجد نتيجة فحص",
      loadError: "تعذر تحميل أخبار Neymar."
    }
  },
  {
    code: "bn",
    name: "বাংলা",
    result: { yes: "হ্যাঁ", no: "না" },
    labels: {
      language: "ভাষা",
      loadingSources: "সূত্র লোড হচ্ছে",
      checkingNow: "এখন পরীক্ষা করা হচ্ছে",
      scanning: "চোট-সম্পর্কিত শব্দ খোঁজা হচ্ছে",
      latestNews: "সর্বশেষ খবর",
      loading: "বিশ্লেষণ লোড হচ্ছে",
      checking: "পরীক্ষা করা হচ্ছে...",
      refresh: "রিফ্রেশ",
      sources: (count) => `${count}টি সাম্প্রতিক সূত্র`,
      checked: (time) => `${time} পরীক্ষা করা হয়েছে`,
      matches: (count) => `${count}টি চোট-সম্পর্কিত মিল`,
      noResult: "বর্তমান ফল নেই",
      failed: "অনুরোধ ব্যর্থ",
      noScan: "স্ক্যানের ফল নেই",
      loadError: "Neymar-এর খবর লোড করা যায়নি।"
    }
  },
  {
    code: "pt",
    name: "Português",
    result: { yes: "Sim", no: "Não" },
    labels: {
      language: "Idioma",
      loadingSources: "Carregando fontes",
      checkingNow: "Verificando agora",
      scanning: "Buscando termos de lesão",
      latestNews: "Últimas notícias",
      loading: "Carregando análise",
      checking: "Verificando...",
      refresh: "Atualizar",
      sources: (count) => `${count} fonte${count === 1 ? "" : "s"} recente${count === 1 ? "" : "s"}`,
      checked: (time) => `Verificado ${time}`,
      matches: (count) => `${count} correspondência${count === 1 ? "" : "s"} sobre lesão`,
      noResult: "Sem resultado atual",
      failed: "Solicitação falhou",
      noScan: "Sem resultado da análise",
      loadError: "Não foi possível carregar notícias sobre Neymar."
    }
  },
  {
    code: "ru",
    name: "Русский",
    result: { yes: "Да", no: "Нет" },
    labels: {
      language: "Язык",
      loadingSources: "Загрузка источников",
      checkingNow: "Проверка сейчас",
      scanning: "Поиск слов о травме",
      latestNews: "Последние новости",
      loading: "Загрузка анализа",
      checking: "Проверка...",
      refresh: "Обновить",
      sources: (count) => `${count} недавних источников`,
      checked: (time) => `Проверено ${time}`,
      matches: (count) => `${count} совпадений о травме`,
      noResult: "Нет текущего результата",
      failed: "Запрос не выполнен",
      noScan: "Нет результата проверки",
      loadError: "Не удалось загрузить новости о Neymar."
    }
  },
  {
    code: "ur",
    name: "اردو",
    dir: "rtl",
    result: { yes: "ہاں", no: "نہیں" },
    labels: {
      language: "زبان",
      loadingSources: "ذرائع لوڈ ہو رہے ہیں",
      checkingNow: "ابھی جانچ ہو رہی ہے",
      scanning: "چوٹ سے متعلق الفاظ تلاش ہو رہے ہیں",
      latestNews: "تازہ خبریں",
      loading: "تجزیہ لوڈ ہو رہا ہے",
      checking: "جانچ ہو رہی ہے...",
      refresh: "تازہ کریں",
      sources: (count) => `${count} حالیہ ذرائع`,
      checked: (time) => `${time} پر جانچا گیا`,
      matches: (count) => `${count} چوٹ سے متعلق مماثلتیں`,
      noResult: "موجودہ نتیجہ نہیں",
      failed: "درخواست ناکام",
      noScan: "اسکین کا نتیجہ نہیں",
      loadError: "Neymar کی خبریں لوڈ نہیں ہو سکیں۔"
    }
  },
  {
    code: "id",
    name: "Bahasa Indonesia",
    result: { yes: "Ya", no: "Tidak" },
    labels: {
      language: "Bahasa",
      loadingSources: "Memuat sumber",
      checkingNow: "Memeriksa sekarang",
      scanning: "Memindai istilah cedera",
      latestNews: "Berita terbaru",
      loading: "Memuat analisis",
      checking: "Memeriksa...",
      refresh: "Segarkan",
      sources: (count) => `${count} sumber terbaru`,
      checked: (time) => `Diperiksa ${time}`,
      matches: (count) => `${count} kecocokan terkait cedera`,
      noResult: "Belum ada hasil",
      failed: "Permintaan gagal",
      noScan: "Tidak ada hasil pemindaian",
      loadError: "Tidak dapat memuat berita Neymar."
    }
  },
  {
    code: "de",
    name: "Deutsch",
    result: { yes: "Ja", no: "Nein" },
    labels: {
      language: "Sprache",
      loadingSources: "Quellen werden geladen",
      checkingNow: "Wird geprüft",
      scanning: "Verletzungsbegriffe werden gesucht",
      latestNews: "Aktuelle Nachrichten",
      loading: "Analyse wird geladen",
      checking: "Prüfen...",
      refresh: "Aktualisieren",
      sources: (count) => `${count} aktuelle Quelle${count === 1 ? "" : "n"}`,
      checked: (time) => `Geprüft ${time}`,
      matches: (count) => `${count} verletzungsbezogene Treffer`,
      noResult: "Kein aktuelles Ergebnis",
      failed: "Anfrage fehlgeschlagen",
      noScan: "Kein Prüfergebnis",
      loadError: "Neymar-Nachrichten konnten nicht geladen werden."
    }
  },
  {
    code: "ja",
    name: "日本語",
    result: { yes: "はい", no: "いいえ" },
    labels: {
      language: "言語",
      loadingSources: "情報源を読み込み中",
      checkingNow: "確認中",
      scanning: "負傷関連語を確認中",
      latestNews: "最新ニュース",
      loading: "分析を読み込み中",
      checking: "確認中...",
      refresh: "更新",
      sources: (count) => `${count}件の最新情報源`,
      checked: (time) => `${time}に確認`,
      matches: (count) => `${count}件の負傷関連一致`,
      noResult: "現在の結果はありません",
      failed: "リクエスト失敗",
      noScan: "確認結果なし",
      loadError: "Neymarのニュースを読み込めませんでした。"
    }
  }
];

const BRAND_NAMES = {
  en: "Neymar Injury Radar",
  zh: "内马尔伤病雷达",
  hi: "नेमार चोट रडार",
  es: "Radar de Lesiones de Neymar",
  fr: "Radar des Blessures de Neymar",
  ar: "رادار إصابة نيمار",
  bn: "নেইমার চোট রাডার",
  pt: "Radar de Lesões do Neymar",
  ru: "Радар травм Неймара",
  ur: "نیمار چوٹ ریڈار",
  id: "Radar Cedera Neymar",
  de: "Neymar-Verletzungsradar",
  ja: "ネイマール負傷レーダー"
};

const languageByCode = new Map(LANGUAGES.map((language) => [language.code, language]));
const brandName = document.querySelector("#brandName");
const resultText = document.querySelector("#resultText");
const injurySummary = document.querySelector("#injurySummary");
const sourceCount = document.querySelector("#sourceCount");
const checkedAt = document.querySelector("#checkedAt");
const matchCount = document.querySelector("#matchCount");
const newsTitle = document.querySelector("#newsTitle");
const newsList = document.querySelector("#newsList");
const languageLabel = document.querySelector("#languageLabel");
const languageSelect = document.querySelector("#languageSelect");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingText = document.querySelector("#loadingText");
const panel = document.querySelector(".status-panel");

let currentLanguage = getInitialLanguage();
let currentPayload = null;
let loading = false;
let hasError = false;

populateLanguageSelect();
applyLanguage();

languageSelect.addEventListener("change", () => {
  currentLanguage = languageByCode.get(languageSelect.value) || languageByCode.get("en");
  localStorage.setItem("language", currentLanguage.code);
  refreshStatus();
});

refreshStatus();

async function refreshStatus() {
  loading = true;
  hasError = false;
  currentPayload = null;
  applyLanguage();
  panel.classList.remove("error");
  document.body.classList.remove("result-yes", "result-no");

  try {
    const response = await fetch("/api/neymar-status", {
      headers: {
        "X-User-Language": currentLanguage.code
      }
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.details || payload.error || t().loadError);
    }

    currentPayload = payload;
    renderPayload();
  } catch (error) {
    currentPayload = null;
    hasError = true;
    panel.classList.add("error");
    resultText.textContent = error instanceof Error ? error.message : t().loadError;
    injurySummary.hidden = true;
    injurySummary.textContent = "";
    sourceCount.textContent = t().noResult;
    checkedAt.textContent = t().failed;
    matchCount.textContent = t().noScan;
    newsList.replaceChildren();
  } finally {
    loading = false;
    applyLanguage();
  }
}

function renderPayload() {
  if (!currentPayload) {
    return;
  }

  renderNews(currentPayload.sources || []);
  resultText.textContent = currentPayload.injured ? currentLanguage.result.yes : currentLanguage.result.no;
  document.body.classList.add(currentPayload.injured ? "result-yes" : "result-no");
  injurySummary.hidden = !currentPayload.validatedInjury;
  injurySummary.textContent = currentPayload.validatedInjury;
  sourceCount.textContent = t().sources(currentPayload.newsCount);
  checkedAt.textContent = t().checked(formatTime(currentPayload.checkedAt));
  matchCount.textContent = t().matches(currentPayload.matchedSources.length);
}

function renderNews(sources) {
  const items = sources.map((source) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const meta = document.createElement("span");

    item.classList.toggle("injury-related", Boolean(source.injuryRelated));
    link.href = source.link;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = source.title;
    meta.textContent = [source.source, formatDate(source.publishedAt)].filter(Boolean).join(" • ");

    item.append(link, meta);
    return item;
  });

  newsList.replaceChildren(...items);
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage.code;
  document.documentElement.dir = currentLanguage.dir || "ltr";
  brandName.textContent = BRAND_NAMES[currentLanguage.code] || BRAND_NAMES.en;
  document.title = BRAND_NAMES[currentLanguage.code] || BRAND_NAMES.en;
  languageSelect.value = currentLanguage.code;
  languageSelect.disabled = loading;
  languageLabel.textContent = t().language;
  newsTitle.textContent = t().latestNews;
  loadingOverlay.hidden = !loading;
  loadingText.textContent = t().loading;

  if (currentPayload) {
    renderPayload();
    return;
  }

  if (hasError) {
    sourceCount.textContent = t().noResult;
    checkedAt.textContent = t().failed;
    matchCount.textContent = t().noScan;
    return;
  }

  sourceCount.textContent = t().loadingSources;
  checkedAt.textContent = t().checkingNow;
  matchCount.textContent = t().scanning;
}

function populateLanguageSelect() {
  const options = LANGUAGES.map((language) => {
    const option = document.createElement("option");
    option.value = language.code;
    option.textContent = language.name;
    return option;
  });

  languageSelect.replaceChildren(...options);
}

function getInitialLanguage() {
  const saved = localStorage.getItem("language");

  if (languageByCode.has(saved)) {
    return languageByCode.get(saved);
  }

  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];

  for (const language of browserLanguages) {
    const code = normalizeLanguageCode(language);

    if (languageByCode.has(code)) {
      return languageByCode.get(code);
    }
  }

  return languageByCode.get("en");
}

function normalizeLanguageCode(value = "") {
  const baseCode = value.toLowerCase().split("-")[0];

  if (baseCode === "cmn" || baseCode === "zh") {
    return "zh";
  }

  return baseCode;
}

function t() {
  return currentLanguage.labels;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(currentLanguage.code, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTime(value) {
  if (!value) {
    return "now";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "now";
  }

  return date.toLocaleTimeString(currentLanguage.code, {
    hour: "2-digit",
    minute: "2-digit"
  });
}
