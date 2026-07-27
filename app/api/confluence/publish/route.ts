import { NextResponse } from "next/server";

type PublishRequest = {
  siteUrl?: string;
  email?: string;
  apiToken?: string;
  spaceId?: string;
  parentId?: string;
  title?: string;
  storage?: string;
};

export async function POST(request: Request) {
  let input: PublishRequest;
  try {
    input = await request.json() as PublishRequest;
  } catch {
    return NextResponse.json({ message: "بدنهٔ درخواست معتبر نیست." }, { status: 400 });
  }

  const siteUrl = input.siteUrl?.trim().replace(/\/+$/, "");
  const email = input.email?.trim();
  const token = input.apiToken?.trim();
  const title = input.title?.trim();
  const spaceId = input.spaceId?.trim();
  const parentId = input.parentId?.trim();
  const storage = input.storage?.trim();

  if (!siteUrl || !email || !token || !title || !spaceId || !storage) {
    return NextResponse.json({ message: "همهٔ فیلدهای ضروری را کامل کنید." }, { status: 400 });
  }
  if (!/^\d+$/.test(spaceId) || (parentId && !/^\d+$/.test(parentId))) {
    return NextResponse.json({ message: "Space ID و Parent Page ID باید عددی باشند." }, { status: 400 });
  }
  if (title.length > 255 || storage.length > 1_500_000) {
    return NextResponse.json({ message: "عنوان یا محتوای صفحه بیش از حد مجاز طولانی است." }, { status: 413 });
  }

  let base: URL;
  try {
    base = new URL(siteUrl);
  } catch {
    return NextResponse.json({ message: "آدرس کانفلوئنس معتبر نیست." }, { status: 400 });
  }
  if (base.protocol !== "https:" || !base.hostname.endsWith(".atlassian.net") || base.username || base.password || base.port) {
    return NextResponse.json({ message: "برای امنیت، فقط آدرس HTTPS رسمی *.atlassian.net پذیرفته می‌شود." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    spaceId,
    status: "current",
    title,
    body: { representation: "storage", value: storage },
  };
  if (parentId) payload.parentId = parentId;

  try {
    const response = await fetch(new URL("/wiki/api/v2/pages", base), {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${email}:${token}`)}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({})) as { id?: string; _links?: { webui?: string }; message?: string; errors?: Array<{ title?: string }> };
    if (!response.ok) {
      const detail = result.message || result.errors?.[0]?.title;
      const friendly = response.status === 401
        ? "ایمیل یا API Token صحیح نیست."
        : response.status === 403
          ? "این حساب اجازهٔ ساخت صفحه در Space انتخاب‌شده را ندارد."
          : response.status === 404
            ? "Space یا Parent Page پیدا نشد."
            : detail || `کانفلوئنس پاسخ ${response.status} برگرداند.`;
      return NextResponse.json({ message: friendly }, { status: response.status });
    }

    const pageUrl = result._links?.webui
      ? new URL(result._links.webui, base).toString()
      : result.id
        ? new URL(`/wiki/spaces/~${spaceId}/pages/${result.id}`, base).toString()
        : base.toString();
    return NextResponse.json({ id: result.id, url: pageUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "ارتباط با کانفلوئنس برقرار نشد. آدرس و وضعیت شبکه را بررسی کنید." }, { status: 502 });
  }
}
