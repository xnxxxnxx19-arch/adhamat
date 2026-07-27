# Gemini Live: الإعداد الآمن

هذا الملف لا يحتوي مفتاح API ولا يجب وضع المفتاح داخل GitHub.

1. افتح Cloudflare Dashboard > Workers & Pages > Create > Create Worker.
2. الصق محتوى `gemini-token-worker.js` وانشره.
3. من Settings > Variables and Secrets أضف Secret:
   - Name: `GEMINI_API_KEY`
   - Value: مفتاح Gemini الجديد (لا ترسله في محادثة أو GitHub).
4. استبدل `YOUR_GITHUB_USERNAME` في الملف باسم حساب GitHub الذي يستضيف الموقع، ثم انشر Worker مرة أخرى.
5. انسخ رابط Worker النهائي، مثل `https://english-voice-token.YOURNAME.workers.dev/token`.

الـ Worker يطلب رمز Gemini Live قصير العمر (10 دقائق)، ثم يرسله للموقع. الصوت يذهب مباشرة من متصفح المستخدم إلى Gemini؛ لذلك لا يظهر المفتاح الدائم للزائر ولا يمر الصوت عبر Worker.

لا تفعّل Billing داخل Google AI Studio ما دمت تريد التجربة ضمن Free Tier. إذا ظهر أن Free Tier غير متاح في بلدك، فلن يعمل Gemini Live من دون فوترة.
