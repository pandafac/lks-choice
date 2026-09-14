// netlify/functions/login.js
// 发起知乎 OAuth 授权：拼授权 URL 并 302 跳转到知乎授权页。
// 部署到 Netlify 后，前端点“知乎登录”会请求 /api/auth/login（经 netlify.toml 重定向到本函数）。
//
// 授权域名来自知乎黑客松官方文档：https://openapi.zhihu.com
// 用户完成授权后，知乎重定向到：{redirect_uri}?authorization_code={authorization_code}
//
// Netlify 环境变量：
//   ZHIHU_APP_ID       第三方 APP_ID
//   ZHIHU_REDIRECT_URI 回调地址，例如 https://你的域名.netlify.app/api/auth/callback
//   （可选）ZHIHU_AUTHORIZE_URL 若官方文档给了明确授权页地址就配置它

exports.handler = async function () {
  const appId = process.env.ZHIHU_APP_ID;
  const redirectUri = process.env.ZHIHU_REDIRECT_URI;
  const authorizeUrl = process.env.ZHIHU_AUTHORIZE_URL || 'https://openapi.zhihu.com/oauth/authorize';

  if (!appId || !redirectUri) {
    return {
      statusCode: 500,
      body: '缺少环境变量：请在 Netlify 配置 ZHIHU_APP_ID / ZHIHU_REDIRECT_URI',
    };
  }

  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
  });

  return {
    statusCode: 302,
    headers: { Location: `${authorizeUrl}?${params.toString()}` },
    body: '',
  };
};
