'use client'

import { usePostHog } from 'posthog-js/react'

type EventMap = {
  bot_connected:             { bot_username?: string; is_first_bot?: boolean }
  flow_created:              { flow_name?: string; trigger_type?: string }
  flow_published:            { flow_name: string; node_count: number }
  flow_deleted:              Record<string, never>
  gateway_connected:         { gateway: string }
  gateway_disconnected:      { gateway: string }
  gateway_configured:        { gateway: string }
  gateway_connection_tested: { gateway: string; success: boolean }
  broadcast_sent:            { contacts_count: number; delivered: number; failed: number; audience?: string }
  onboarding_completed:      Record<string, never>
  onboarding_step_completed: { step: string }
  pix_payment_created:       { amount: number; product_name: string }
  avatar_updated:            Record<string, never>
  profile_avatar_updated:    Record<string, never>
  csv_exported:              { section: string; rows: number; period?: string }
  plan_upgraded:             { from: string; to: string }
  user_registered:           { method: string }
  // Aba Análises
  analytics_filter_changed:  {
    period: string
    compare: boolean
    bot_filtered: boolean
    product_filtered: boolean
    flow_filtered: boolean
    utm_filtered: boolean
  }
  analytics_cohort_error:    { error: string }
  // Aba Atividade
  activity_filter_changed:   { category: string; bot_filtered: boolean; period?: string; search?: string }
  activity_live_toggled:     { live: boolean }
  // Aba Financeiro
  withdrawal_requested:      { amount: number; account_kind: string }
  bank_account_added:        { kind: 'pix' | 'conta' | 'ted' }
  bank_account_deleted:      Record<string, never>
  finance_tab_changed:       { tab: string }
  finance_period_changed:    { period: string }
  // Aba Clientes
  customer_filter_changed:   { status: string; origin_filtered: boolean; tag_filtered: boolean; period: string }
  customer_profile_opened:   { status: 'buyer' | 'lead' }
  customer_tag_added:        { tag: string; bulk: boolean; count?: number }
  customer_added:            Record<string, never>
  customer_imported:         { rows: number }
  // Aba Afiliados
  affiliate_added:           { commission_pct: number }
  affiliate_status_changed:  { status: 'active' | 'paused' | 'archived' }
  affiliate_paid:            { count: number; total: number }
  affiliate_config_saved:    { percentage: number; attribution: string; cookie_window: number }
  affiliate_link_copied:     Record<string, never>
  // Aba Alertas Importantes
  alert_resolved:            { alert_type: string; severity: string }
  alert_reopened:            { alert_type: string }
  all_alerts_resolved:       { count: number }
  alert_action_clicked:      { alert_type: string; action: string }
  // Aba Redirecionadores
  redirect_created:          { slug: string; cloaking: boolean; utm_enabled: boolean; redirect_type: string }
  redirect_updated:          { slug: string }
  redirect_status_changed:   { status: string }
  redirect_deleted:          Record<string, never>
  // Aba Remarketing
  campaign_created:          { trigger: string; audience: string }
  campaign_saved:            { step_count: number }
  campaign_activated:        { trigger: string; step_count: number }
  campaign_paused:           { trigger: string }
  campaign_deleted:          Record<string, never>
  // Aba Trackeamento
  pixel_configured:          { provider: string; has_capi: boolean; events_enabled_count: number }
  pixel_verified:            { provider: string; status: 'ok' | 'error' }
  pixel_test_sent:           { provider: string }
  utm_link_copied:           { has_utm: boolean }
  // Aba Checkout
  checkout_created:          { layout: string; gateway: string }
  checkout_published:        { slug: string; price: number }
  checkout_deleted:          { status: string }
  checkout_duplicated:       Record<string, never>
  // Aba Ferramentas
  tool_opened:               { tool_id: string }
  test_message_sent:         { bot_id: string; success: boolean; time_ms: number; format: string }
  token_validated:           { valid: boolean }
  qr_generated:              { bot_username: string }
  qr_downloaded:             { bot_username: string }
  flow_previewed:            { flow_id: string; node_count: number }
  flow_sim_completed:        { flow_id: string; steps_taken: number; branches_chosen: number }
  config_exported:           { parts: string[]; total_sections: number }
  config_imported:           { flows: number; sequences: number; gateways: number; links: number; webhooks: number }
  diagnostics_run:           { checks: number; failed: number }
  cache_cleared:             Record<string, never>
  deep_link_generated:       { bot_username: string; param: string }
  lgpd_check_run:            { contacts: number; with_email: number; with_phone: number }
}

export function useAnalytics() {
  const posthog = usePostHog()

  function track<E extends keyof EventMap>(event: E, properties?: EventMap[E]) {
    posthog?.capture(event, properties as Record<string, unknown>)
  }

  function identify(userId: string, traits?: Record<string, unknown>) {
    posthog?.identify(userId, traits)
  }

  function reset() {
    posthog?.reset()
  }

  return { track, identify, reset }
}
