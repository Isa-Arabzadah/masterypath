
// این فایل روی سرور Vercel اجرا می‌شود، نه توی مرورگر کاربر.
// کلید API از یک متغیر محیطی امن خوانده می‌شود، هرگز داخل کد نیست.
 
const PROMPTS = {
  fa: {
    system: (skill, level, time) => `تو باتجربه‌ترین مربی این مهارت در دنیا هستی و باید یک مسیر یادگیری دقیق، مرحله‌به‌مرحله و مبتنی بر منابع مستند و واقعی طراحی کنی — نه یک لیست کلی‌گویانه. کل خروجی باید به زبان فارسی باشد.
 
مهارت: ${skill}
سطح فعلی کاربر: ${level}
زمان روزانهٔ در دسترس: ${time}
 
قوانین سخت‌گیرانهٔ کیفیت منابع:
- هر منبعی که معرفی می‌کنی باید واقعاً وجود داشته باشد؛ با جست‌وجوی وب تأیید کن.
- هیچ عبارت انگیزشی یا اطلاعات عمومی/کلی نیاور.
- وعده‌های غیرواقعی را حذف کن. از کلمهٔ «تضمینی» یا «قطعی» استفاده نکن.
 
قوانین ساختاری:
- مسیر را به ۴ تا ۵ مرحلهٔ هرمی تقسیم کن.
- برای هر مرحله: عنوان، بازهٔ زمانی، ۳ تا ۵ آیتم برنامهٔ روزانهٔ عملی، و ۱ تا ۲ منبع واقعی با آدرس.
- خودآموزی یا گروهی بودن را با دلیل مشخص کن.
- خروجی فقط یک JSON خالص باشد (بدون Markdown) با ساختار زیر، همه‌چیز به فارسی:
{"skill":"...","totalDuration":"...","method":"...","methodReason":"...","phases":[{"title":"...","duration":"...","dailyPlan":["..."],"resources":[{"type":"...","title":"...","note":"...","url":"..."}]}]}`
  },
  en: {
    system: (skill, level, time) => `You are the world's most experienced mentor for this skill, and must design a precise, step-by-step learning path based on real, documented sources — not a generic list. The entire output must be in English.
 
Skill: ${skill}
User's current level: ${level}
Daily time available: ${time}
 
Strict source-quality rules:
- Every resource you recommend must actually exist; verify via web search.
- No motivational language or generic filler content.
- Remove unrealistic promises. Do not use the word "guaranteed" or "definite".
 
Structural rules:
- Divide the path into 4-5 pyramid-shaped phases.
- For each phase: title, time range, 3-5 concrete daily plan items, and 1-2 real resources with URLs.
- State whether self-study or group learning is better, with a reason.
- Output ONLY pure JSON (no Markdown), all content in English, with this structure:
{"skill":"...","totalDuration":"...","method":"...","methodReason":"...","phases":[{"title":"...","duration":"...","dailyPlan":["..."],"resources":[{"type":"...","title":"...","note":"...","url":"..."}]}]}`
  },
  de: {
    system: (skill, level, time) => `Du bist der erfahrenste Mentor der Welt für diese Fähigkeit und musst einen präzisen, schrittweisen Lernpfad basierend auf echten, dokumentierten Quellen entwerfen — keine allgemeine Liste. Die gesamte Ausgabe muss auf Deutsch sein.
 
Fähigkeit: ${skill}
Aktuelles Niveau des Nutzers: ${level}
Verfügbare tägliche Zeit: ${time}
 
Strenge Regeln zur Quellenqualität:
- Jede empfohlene Quelle muss tatsächlich existieren; per Websuche bestätigen.
- Keine motivierende Sprache oder allgemeine Füllinhalte.
- Unrealistische Versprechen entfernen. Verwende nicht das Wort "garantiert" oder "definitiv".
 
Strukturregeln:
- Teile den Pfad in 4-5 pyramidenförmige Phasen.
- Für jede Phase: Titel, Zeitrahmen, 3-5 konkrete tägliche Planpunkte und 1-2 echte Quellen mit URLs.
- Gib an, ob Selbststudium oder Gruppenlernen besser ist, mit Begründung.
- Gib NUR reines JSON aus (kein Markdown), gesamter Inhalt auf Deutsch, mit dieser Struktur:
{"skill":"...","totalDuration":"...","method":"...","methodReason":"...","phases":[{"title":"...","duration":"...","dailyPlan":["..."],"resources":[{"type":"...","title":"...","note":"...","url":"..."}]}]}`
  }
};
 
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST is allowed' });
  }
 
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }
 
  const { skill, level, time, lang } = req.body || {};
  if (!skill || typeof skill !== 'string' || skill.length > 200) {
    return res.status(400).json({ error: 'Invalid skill name' });
  }
 
  const langKey = PROMPTS[lang] ? lang : 'en';
  const systemPrompt = PROMPTS[langKey].system(skill, level || '', time || '');
 
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `Skill: ${skill}` }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 2000 }
        })
      }
    );
 
    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ error: 'Error connecting to AI service' });
    }
 
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('\n');
 
    let clean = text.trim().replace(/```json|```/g, '').trim();
    const first = clean.indexOf('{');
    const last = clean.lastIndexOf('}');
    if (first !== -1 && last !== -1) clean = clean.slice(first, last + 1);
 
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error processing response' });
  }
}
