// Downloaded website favicons are bundled for offline use.
(function (root) {
  const files = {
    "google.com": "google",
    "about.google": "google",
    "um.ac.ir": "fum",
    "vu.um.ac.ir": "fum",
    "chatgpt.com": "chatgpt",
    "chat.openai.com": "chatgpt",
    "openai.com": "chatgpt",
    "claude.ai": "claude",
    "gemini.google.com": "gemini",
    "mail.google.com": "gmail",
    "classroom.google.com": "classroom",
    "github.com": "github",
  };

  function urlFor(raw) {
    try {
      const url = new URL(raw);
      if (!["https:", "http:"].includes(url.protocol)) return "";
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (Object.hasOwn(files, host)) return "icons/sites/" + files[host] + ".png";
      return "";
    } catch {
      return "";
    }
  }

  function render(container, url, title = "") {
    const source = urlFor(url);
    let name = title;
    if (!String(name).trim()) {
      try { name = new URL(url).hostname.replace(/^www\./, ""); } catch { name = ""; }
    }
    const initial = String(name).normalize("NFC").match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() || "؟";
    const showInitial = () => {
      container.replaceChildren();
      container.hidden = false;
      container.classList.add("site-monogram");
      container.textContent = initial;
    };
    container.replaceChildren();
    container.hidden = false;
    container.classList.remove("site-monogram");
    if (!source) {
      showInitial();
      return;
    }
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.src = source;
    image.addEventListener("error", () => {
      showInitial();
    }, { once: true });
    container.append(image);
  }

  root.StudashSiteIcons = { urlFor, render };
})(globalThis);
