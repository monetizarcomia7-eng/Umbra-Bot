/**
 * Versão da Graph API usada pelo módulo Instagram.
 * Centralizada aqui para trocar em um só lugar. Versões expiram ~2 anos após o
 * lançamento (a v19.0 expirou em 21/05/2026): https://developers.facebook.com/docs/graph-api/changelog/versions
 */
export const META_API_VERSION = 'v25.0'
export const META_GRAPH_URL   = `https://graph.facebook.com/${META_API_VERSION}`
export const META_OAUTH_URL   = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth`
