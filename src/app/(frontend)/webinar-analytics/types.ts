export type MetricRow = {
  id: string
  label: string
  registered: number
  attendedLive: number
  attendedOnDemand?: number
  joinedEarly?: number
  noShow?: number
  salesIntent?: number
  emailOptIn?: number
}

export type Person = {
  id: string
  name: string
  company: string
  role: string
  roleGroup: string
  status: string
  statusId: string
  source: string
  medium: string
  campaign: string
  salesIntent: boolean
  emailOptIn: boolean
  registeredDate: string
}

export type DashboardData = {
  event: {
    name: string
    dateLabel: string
    timezone: string
    source: string
    note: string
  }
  kpis: {
    registered: number
    attendedLive: number
    attendedOnDemand: number
    joinedEarly: number
    noShow: number
    onDemandRegistered: number
    showedUp: number
    liveRate: number
    showUpRate: number
    salesIntent: number
    salesIntentRate: number
    emailOptIn: number
    emailOptInRate: number
    companies: number
    brokenTag: number
  }
  funnel: { id: string; label: string; count: number }[]
  dailyRegistrations: {
    date: string
    label: string
    registered: number
    attendedLive: number
    salesIntent: number
  }[]
  joinTimes: { label: string; count: number }[]
  channels: MetricRow[]
  campaigns: MetricRow[]
  timing: MetricRow[]
  roleGroups: MetricRow[]
  topRoles: MetricRow[]
  topCompanies: MetricRow[]
  people: Person[]
}

export type DashboardView = 'overview' | 'acquisition' | 'audience' | 'people'
