import type { DashboardData, MetricRow } from './types'

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function liveRate(row: Pick<MetricRow, 'registered' | 'attendedLive'>) {
  if (row.registered === 0) return 0
  return row.attendedLive / row.registered
}

export function briefingText(data: DashboardData) {
  const invite = data.campaigns.find((row) => row.id === 'Mar 24 office hours invite')
  const page = data.campaigns.find((row) => row.id === 'Apr 2 office hours page')
  const digest = data.campaigns.find((row) => row.id === 'Mar 26 French digest')
  const partner = data.campaigns.find((row) => row.id === 'BeJS partner email')
  const eventDay = data.timing.find((row) => row.id === 'Event day')

  return [
    `${data.event.name} · ${data.event.dateLabel}`,
    `${formatNumber(data.kpis.registered)} registered. ${formatNumber(data.kpis.attendedLive)} joined live (${formatPercent(data.kpis.liveRate)}). ${formatNumber(data.kpis.attendedOnDemand)} watched the recording. ${formatNumber(data.kpis.salesIntent)} asked for an Organization or Enterprise conversation.`,
    invite && page
      ? `The Mar 24 email invite brought ${formatNumber(invite.registered)} people — about half the list — at a ${formatPercent(liveRate(invite))} live rate. The office hours page added ${formatNumber(page.registered)} registrations, but only ${formatPercent(liveRate(page))} joined live.`
      : '',
    digest && partner
      ? `Smaller lists converted more reliably: the French digest at ${formatPercent(liveRate(digest))} and the BeJS partner email at ${formatPercent(liveRate(partner))}.`
      : '',
    eventDay
      ? `People who registered on the day showed up at ${formatPercent(liveRate(eventDay))}. ${data.kpis.brokenTag} registration arrived with a broken campaign merge tag.`
      : '',
    `Source: ${data.event.source}.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
