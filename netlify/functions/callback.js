// netlify/functions/callback.js
// 知乎授权后重定向到这里（知乎回调参数名是 authorization_code）。
// 后端用 authorization_code + app_id + app_key 换 access_token，
// 再用 token 拿知乎用户信息，最后把用户信息交回前端。
// app_key 只在这里（服务端）使用，绝不进前端、绝不进 git。
//
// 接口来自知乎黑客松官方文档：
//   换 token：POST https://openapi.zhihu.com/access_token
//   用户信息：GET  https://openapi.zhihu.com/user  (Header: Authorization: Bearer xxx)
//
// Netlify 环境变量（在 Site settings → Environment variables 配置）：
//   ZHIHU_APP_ID       第三方 APP_ID
//   ZHIHU_APP_KEY      第三方 APP_KEY（机密！）
//   ZHIHU_REDIRECT_URI 必须与 login、知乎后台申请时填的完全一致
//
// 访问路径（经 netlify.toml 重定向）：/api/auth/callback

exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const authorizationCode = params.authorization_code || params.code;

  const appId = process.env.ZHIHU_APP_ID;
  const appKey = process.env.ZHIHU_APP_KEY;
  const redirectUri = process.env.ZHIHU_REDIRECT_URI;

  const TOKEN_URL = 'https://openapi.zhihu.com/access_token';
  const USER_URL = 'https://openapi.zhihu.com/user';

  if (!authorizationCode) {
    return { statusCode: 400, body: '缺少 authorization_code，授权可能被取消。' };
  }
  if (!appId || !appKey || !redirectUri) {
    return {
      statusCode: 500,
      body: '后端环境变量未配置齐全：请检查 Netlify 的 ZHIHU_APP_ID / ZHIHU_APP_KEY / ZHIHU_REDIRECT_URI。',
    };
  }

  try {
    // ① authorization_code → access_token
    const tokenResp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: authorizationCode,
      }),
    });
    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return { statusCode: 502, body: '换取 access_token 失败：' + JSON.stringify(tokenData) };
    }

    // ② access_token → 用户信息
    const userResp = await fetch(USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'LiuKanShanChoice/1.0',
      },
    });
    const user = await userResp.json();

    if (user && user.code === 404) {
      return { statusCode: 200, body: '用户不存在，请重试。' };
    }

    // ③ 只回传展示所需的最小字段（不回传手机号/邮箱/token）
    const safeUser = {
      id: user.uid != null ? String(user.uid) : '',
      name: user.fullname || '知乎用户',
      avatar: user.avatar_path || '',
    };

    // 通过中转页把用户信息写进 sessionStorage，再跳回首页
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>登录中…</title></head>
<body style="font-family:sans-serif;padding:40px;color:#333">正在完成登录，请稍候…
<script>
  try {
    sessionStorage.setItem('ksl_zhihu_user', JSON.stringify(${JSON.stringify(safeUser)}));
  } catch (e) {}
  location.replace('/index.html');
</script>
</body></html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: html,
    };
  } catch (err) {
    return { statusCode: 500, body: '登录处理出错：' + (err && err.message ? err.message : String(err)) };
  }
};
