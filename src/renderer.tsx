import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children, title }: { children?: any; title?: string }) => {
  return (
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title ?? '경영지원 아카이브 | BizReady'}</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link
          href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css"
          rel="stylesheet"
        />
        <script
          src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"
        ></script>
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap');
            * { font-family: 'Noto Sans KR', sans-serif; }
            .gradient-bg { background: linear-gradient(135deg, #1e3a5f 0%, #0f6cbf 50%, #0ea5e9 100%); }
            .card-hover { transition: all 0.2s ease; }
            .card-hover:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
            .sidebar-item:hover { background: rgba(255,255,255,0.08); }
            .sidebar-item.active { background: rgba(255,255,255,0.15); border-left: 3px solid #38bdf8; }
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: #f1f5f9; }
            ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
          `,
          }}
        />
      </head>
      <body class="bg-gray-50">{children}</body>
    </html>
  )
})
