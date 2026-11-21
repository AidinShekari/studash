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

  function render(container, url) {
    const source = urlFor(url);
    container.replaceChildren();
    container.hidden = !source;
    if (!source) return;
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.src = source;
    image.addEventListener("error", () => {
      container.replaceChildren();
      container.hidden = true;
    }, { once: true });
    container.append(image);
  }

  root.StudashSiteIcons = { urlFor, render };
})(globalThis);
