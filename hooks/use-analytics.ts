'use client'

import { usePostHog } from 'posthog-js/react'

type EventMap = {
  bot_connected:             { bot_username?: string; is_first_bot?: boolean }
  flow_created:              { flow_name?: string; trigger_type?: string }
  gateway_connected:         { gateway: string }
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
