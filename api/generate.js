// این فایل روی سرور Vercel اجرا می‌شود، نه توی مرورگر کاربر.
// کلید API اینجا از یک متغیر محیطی امن خوانده می‌شود، هرگز داخل کد نیست.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'فقط درخواست POST مجاز است' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'کلید API روی سرور تنظیم نشده' });
  }

  const { skill, level, time } = req.body || {};
  if (!skill || typeof skill !== 'string' || skill.length > 200) {
    return res.status(400).json({ error: 'نام مهارت نامعتبر است' });
  }

  const userQuery = `مهارت: ${skill}
سطح فعلی کاربر: ${level || 'مبتدی کامل'}
زمان روزانهٔ در دسترس: ${time || '۳۰ تا ۶۰ دقیقه'}`;

  const systemPrompt = `تو باتجربه‌ترین مربی این مهارت در دنیا هستی و باید یک مسیر یادگیری دقیق، مرحله‌به‌مرحله و مبتنی بر منابع مستند و واقعی طراحی کنی — نه یک لیست کلی‌گویانه.

قوانین سخت‌گیرانهٔ کیفیت منابع:
- هر منبعی که معرفی می‌کنی باید واقعاً وجود داشته باشد؛ عنوان کتاب، نویسنده، یا نام دوره را از حافظه حدس نزن — با جست‌وجوی وب تأیید کن که واقعی و موجود است.
- فقط منابعی که مبتنی بر داده، پژوهش، یا تجربهٔ مستند متخصصان شناخته‌شده‌اند بیاور؛ نه نظر شخصی وبلاگ‌نویس‌های ناشناس.
- هیچ عبارت انگیزشی، جملهٔ قصار، یا لحن «تو می‌تونی!» نیاور.
- هیچ اطلاعات عمومی/کلی/زرد نیاور — هر خط باید مشخص و عملی باشد.
- وعده‌های غیرواقعی یا فرمول‌های ساده‌انگارانه را کاملاً حذف کن. اگر مسیر واقعی طولانی یا سخت است، صادقانه همین را بگو.
- از کلمهٔ «تضمینی» یا «قطعی» استفاده نکن، اما مسیر باید آن‌قدر دقیق باشد که در عمل قابل‌اتکا حس شود.

قوانین ساختاری:
- مسیر را به ۴ تا ۵ مرحلهٔ هرمی (از پایه تا تسلط) تقسیم کن.
- برای هر مرحله: عنوان کوتاه، بازهٔ زمانی تخمینی، ۳ تا ۵ آیتم برنامهٔ روزانهٔ خیلی مشخص و عملی، و ۱ تا ۲ منبع واقعی با آدرس اگر پیدا کردی.
- مشخص کن خودآموزی بهتر است یا یادگیری گروهی/با مربی، و چرا.
- خروجی فقط یک JSON خالص باشد (بدون Markdown) با این ساختار دقیق:
{
  "skill": "...",
  "totalDuration": "...",
  "method": "خودآموز | گروهی/با مربی | ترکیبی",
  "methodReason": "...",
  "phases": [
    {
      "title": "...",
      "duration": "...",
      "dailyPlan": ["...", "..."],
      "resources": [{"type":"کتاب|دوره|مربی|کانال","title":"...","note":"...","url":"..."}]
    }
  ]
}
همه‌چیز کوتاه و فشرده بنویس.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userQuery }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 2000 }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ error: 'خطا در ارتباط با سرویس هوش مصنوعی' });
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
    return res.status(500).json({ error: 'خطا در پردازش پاسخ' });
  }
}
