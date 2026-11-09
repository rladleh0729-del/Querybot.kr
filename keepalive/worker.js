// querybot.kr AI 서버(Render 무료) 깨우기 (2026-11-09)
// Render 무료 서버는 15분 동안 요청이 없으면 잠들고, 깨어나는 데 20초~1분이 걸린다(그동안 사이트에 '서버 깨우는 중'만 보임).
// GitHub Actions 예약 실행은 몇 시간씩 밀려서 못 깨워 둠 → Cloudflare Cron(제시간 실행)으로 10분마다 /state를 부른다.
// 한국 시각 오전 7시~새벽 2시에만(wrangler.jsonc의 crons) — Render 무료 750시간/월 안에 넉넉히 들어가게.
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      fetch("https://querybot-ai.onrender.com/state", { headers: { "User-Agent": "querybot-keepalive (Cloudflare cron)" } })
        .then((r) => console.log("ping", r.status))
        .catch((e) => console.log("ping failed", String(e)))
    );
  },
  async fetch() {
    return new Response("querybot keep-awake worker", { status: 404 });
  },
};
