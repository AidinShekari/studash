// Downloaded website favicons are bundled for offline use.
(function (root) {
  const files = {
    "google.com": "google",
    "about.google": "google",
    "scholar.google.com": "scholar",
    "um.ac.ir": "fum",
    "vu.um.ac.ir": "fum",
    "pooya.um.ac.ir": "pooya",
    "chatgpt.com": "chatgpt",
    "chat.openai.com": "chatgpt",
    "openai.com": "chatgpt",
    "claude.ai": "claude",
    "gemini.google.com": "gemini",
    "mail.google.com": "gmail",
    "drive.google.com": "drive",
    "calendar.google.com": "calendar",
    "meet.google.com": "meet",
    "classroom.google.com": "classroom",
    "github.com": "github",
  };

  function urlFor(raw) {
    try {
      const url = new URL(raw);
      if (!["https:", "http:"].includes(url.protocol)) return "";
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (Object.hasOwn(files, host)) return "icons/sites/" + files[host] + ".png";
      const icon = new URL(chrome.runtime.getURL("_favicon/"));
      icon.searchParams.set("pageUrl", url.origin + "/");
      icon.searchParams.set("size", "64");
      return icon.href;
    } catch {
      return "";
    }
  }

  function render(container, url, title = "") {
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.src = urlFor(url);
    image.addEventListener("error", () => {
      container.textContent = title.slice(0, 1).toUpperCase();
    }, { once: true });
    container.replaceChildren(image);
  }

  root.StudashSiteIcons = { urlFor, render };
})(globalThis);
