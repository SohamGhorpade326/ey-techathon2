export async function translateText(text: string, lang: string) {
  if (lang === "en") return text;

  const res = await fetch("/translate", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ text, lang })
  });

  const data = await res.json();
  return data.translated || text;
}
