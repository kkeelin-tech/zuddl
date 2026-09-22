'use client'

import { useMemo, useState } from 'react'

import { briefingText, formatNumber, formatPercent, liveRate } from './format'
import type { DashboardData, DashboardView, MetricRow, Person } from './types'
import './dashboard.css'

const VIEWS: { id: DashboardView; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'audience', label: 'Audience' },
  { id: 'people', label: 'People' },
]

const PAGE_SIZE = 20

type DashboardProps = {
  data: DashboardData
}

export function Dashboard({ data }: DashboardProps) {
  const [view, setView] = useState<DashboardView>('overview')
  const [copied, setCopied] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [source, setSource] = useState('all')
  const [sales, setSales] = useState('all')
  const [page, setPage] = useState(1)

  const briefing = useMemo(() => briefingText(data), [data])
  const statuses = useMemo(
    () => [...new Set(data.people.map((person) => person.status))].sort(),
    [data.people],
  )
  const sources = useMemo(
    () => [...new Set(data.people.map((person) => person.source))].sort(),
    [data.people],
  )

  const filteredPeople = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return data.people.filter((person) => {
      if (status !== 'all' && person.status !== status) return false
      if (source !== 'all' && person.source !== source) return false
      if (sales === 'asked' && !person.salesIntent) return false
      if (sales === 'not-asked' && person.salesIntent) return false
      if (!needle) return true
      return [person.name, person.company, person.role, person.campaign]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [data.people, query, sales, source, status])

  const pageCount = Math.max(1, Math.ceil(filteredPeople.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filteredPeople.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  async function copyBriefing() {
    try {
      await navigator.clipboard.writeText(briefing)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  function exportPeople() {
    const header = [
      'name',
      'company',
      'role',
      'status',
      'source',
      'medium',
      'campaign',
      'sales_follow_up',
      'email_opt_in',
      'registered_date',
    ]
    const lines = [
      header.join(','),
      ...filteredPeople.map((person) =>
        [
          person.name,
          person.company,
          person.role,
          person.status,
          person.source,
          person.medium,
          person.campaign,
          person.salesIntent ? 'Yes' : 'No',
          person.emailOptIn ? 'Yes' : 'No',
          person.registeredDate,
        ]
          .map(csvCell)
          .join(','),
      ),
    ]
    const blob = new Blob([`${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'webinar-people-filtered.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  function changeFilter<T>(setter: (value: T) => void, value: T) {
    setter(value)
    setPage(1)
  }

  return (
    <div className="dash">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="dash-top">
        <div className="dash-brand">
          <p className="eyebrow">Zuddl</p>
          <p className="dash-product">Webinar analytics</p>
        </div>
        <p className="dash-event">
          {data.event.name}
          <span className="dash-event-meta">
            {data.event.dateLabel} · {data.event.timezone}
          </span>
        </p>
        <button type="button" className="button-primary" onClick={copyBriefing}>
          {copied ? 'Briefing copied' : 'Copy briefing'}
        </button>
      </header>

      <main id="main-content" className="dash-main">
        <section className="dash-hero">
          <p className="eyebrow">Marketing dashboard</p>
          <h1>Who showed up</h1>
          <p className="lead">
            {formatNumber(data.kpis.registered)} people registered for the April 2 office hours on
            AI for developers. {formatNumber(data.kpis.attendedLive)} stayed for the live session.
            This view is built from the Zuddl registration report, with emails held back.
          </p>
        </section>

        <section className="kpi-grid" aria-label="Headline numbers">
          <Kpi label="Registered" value={formatNumber(data.kpis.registered)} hint="Every complete signup" />
          <Kpi
            label="Attended live"
            value={formatNumber(data.kpis.attendedLive)}
            hint={`${formatPercent(data.kpis.liveRate)} of the list`}
          />
          <Kpi
            label="Showed up overall"
            value={formatPercent(data.kpis.showUpRate)}
            hint={`${formatNumber(data.kpis.showedUp)} live or recording`}
          />
          <Kpi
            label="Asked for sales"
            value={formatNumber(data.kpis.salesIntent)}
            hint={`${formatPercent(data.kpis.salesIntentRate)} want an Enterprise conversation`}
          />
        </section>

        <aside className="insight" aria-label="Read of the report">
          <p className="eyebrow">What to take to standup</p>
          <p>
            The Mar 24 email invite did the heavy lifting. The office hours page added volume at a
            weaker live rate. If we run this again, put reminder energy into email, the French
            digest, and partner lists—those people actually arrived.
          </p>
        </aside>

        <div className="view-switch" role="tablist" aria-label="Dashboard sections">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={view === item.id}
              aria-controls={`panel-${item.id}`}
              className="view-tab"
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section
          id={`panel-${view}`}
          role="tabpanel"
          aria-labelledby={`tab-${view}`}
          className="view-panel"
        >
          {view === 'overview' ? <Overview data={data} /> : null}
          {view === 'acquisition' ? <Acquisition data={data} /> : null}
          {view === 'audience' ? <Audience data={data} /> : null}
          {view === 'people' ? (
            <People
              note={data.event.note}
              people={filteredPeople}
              pageRows={pageRows}
              statuses={statuses}
              sources={sources}
              query={query}
              status={status}
              source={source}
              sales={sales}
              page={currentPage}
              pageCount={pageCount}
              onQuery={(value) => changeFilter(setQuery, value)}
              onStatus={(value) => changeFilter(setStatus, value)}
              onSource={(value) => changeFilter(setSource, value)}
              onSales={(value) => changeFilter(setSales, value)}
              onPage={setPage}
              onExport={exportPeople}
            />
          ) : null}
        </section>
      </main>
    </div>
  )
}

function Overview({ data }: { data: DashboardData }) {
  const maxRegistered = Math.max(...data.dailyRegistrations.map((row) => row.registered), 1)
  const maxJoin = Math.max(...data.joinTimes.map((row) => row.count), 1)

  return (
    <div className="stack">
      <div className="split">
        <article className="panel">
          <h2>From signup to the room</h2>
          <p className="panel-copy">
            {formatNumber(data.kpis.joinedEarly)} people opened the room and left before the start.
            {` ${formatNumber(data.kpis.noShow)} never arrived. `}
            {formatNumber(data.kpis.attendedOnDemand)} caught the recording later.
          </p>
          <ol className="funnel">
            {data.funnel.map((step) => (
              <li key={step.id}>
                <div className="funnel-meta">
                  <span>{step.label}</span>
                  <span className="numeric">
                    {formatNumber(step.count)} · {formatPercent(step.count / data.kpis.registered)}
                  </span>
                </div>
                <div className="track" aria-hidden="true">
                  <div
                    className="fill"
                    style={{ width: `${(step.count / data.kpis.registered) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </article>

        <article className="panel">
          <h2>When they registered</h2>
          <p className="panel-copy">
            Bar height is registrations. The number under each bar is how many of those people
            joined live.
          </p>
          <div className="series" role="img" aria-label="Registrations by day">
            {data.dailyRegistrations.map((row) => (
              <div key={row.date} className="series-col">
                <span className="series-value numeric">{formatNumber(row.registered)}</span>
                <div className="series-track">
                  <div
                    className="series-bar"
                    style={{ height: `${(row.registered / maxRegistered) * 100}%` }}
                  />
                </div>
                <span className="series-label">{row.label}</span>
                <span className="series-sub numeric">{formatNumber(row.attendedLive)} live</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="split">
        <article className="panel">
          <h2>When the live audience arrived</h2>
          <p className="panel-copy">
            Join time is in {data.event.timezone}. {formatNumber(data.joinTimes[0]?.count ?? 0)}{' '}
            people joined at {data.joinTimes[0]?.label ?? 'the start'}.
          </p>
          <ul className="bars">
            {data.joinTimes.map((row) => (
              <BarRow
                key={row.label}
                label={row.label}
                value={formatNumber(row.count)}
                percent={(row.count / maxJoin) * 100}
              />
            ))}
          </ul>
        </article>

        <article className="panel">
          <h2>Signup timing vs. show-up</h2>
          <p className="panel-copy">
            People who registered on the day converted best. The long early tail is small and
            loyal; the mid-campaign wave is where most no-shows sit.
          </p>
          <MetricTable
            rows={data.timing}
            caption="Live attendance by how early people registered"
          />
        </article>
      </div>
    </div>
  )
}

function Acquisition({ data }: { data: DashboardData }) {
  return (
    <div className="stack">
      <article className="panel">
        <h2>Which channels filled the room</h2>
        <p className="panel-copy">
          Figma email brought the list. The website page added volume with a softer live rate.
          Untagged and partner traffic is smaller, and those people were more likely to stay.
        </p>
        <MetricTable rows={data.channels} caption="Live attendance and sales interest by channel" />
      </article>
      <article className="panel">
        <h2>Campaigns behind the tags</h2>
        <p className="panel-copy">
          Labels are cleaned from the raw UTM values. One row still has an unrendered merge tag,
          so that invite worked and the reporting did not.
        </p>
        <MetricTable rows={data.campaigns} caption="Campaign performance" />
      </article>
    </div>
  )
}

function Audience({ data }: { data: DashboardData }) {
  return (
    <div className="stack">
      <div className="split">
        <article className="panel">
          <h2>Who this office hours reached</h2>
          <p className="panel-copy">
            Engineering is the center of gravity, with design close behind. Role labels are grouped
            from free text, so treat the edges as directional.
          </p>
          <ul className="bars">
            {data.roleGroups.map((row) => (
              <BarRow
                key={row.id}
                label={row.label}
                value={`${formatNumber(row.registered)} · ${formatPercent(liveRate(row))} live`}
                percent={(row.registered / data.kpis.registered) * 100}
              />
            ))}
          </ul>
        </article>
        <article className="panel">
          <h2>Titles people typed</h2>
          <p className="panel-copy">The twelve most common roles after light cleanup.</p>
          <ul className="bars">
            {data.topRoles.map((row) => (
              <BarRow
                key={row.id}
                label={row.label}
                value={formatNumber(row.registered)}
                percent={(row.registered / (data.topRoles[0]?.registered ?? 1)) * 100}
              />
            ))}
          </ul>
        </article>
      </div>
      <article className="panel">
        <h2>Companies that sent more than a handful</h2>
        <p className="panel-copy">
          {formatNumber(data.kpis.companies)} companies appear on the list. These are the largest
          clusters—not a ranked account list.
        </p>
        <MetricTable
          rows={data.topCompanies}
          caption="Companies with the most registrations"
          includeSales
        />
      </article>
      <article className="panel">
        <h2>The list we can keep talking to</h2>
        <p className="panel-copy">
          {formatNumber(data.kpis.emailOptIn)} people ({formatPercent(data.kpis.emailOptInRate)})
          asked for promotional email. {formatNumber(data.kpis.salesIntent)} asked a sales teammate
          to follow up about Organization or Enterprise.
        </p>
      </article>
    </div>
  )
}

type PeopleProps = {
  note: string
  people: Person[]
  pageRows: Person[]
  statuses: string[]
  sources: string[]
  query: string
  status: string
  source: string
  sales: string
  page: number
  pageCount: number
  onQuery: (value: string) => void
  onStatus: (value: string) => void
  onSource: (value: string) => void
  onSales: (value: string) => void
  onPage: (page: number) => void
  onExport: () => void
}

function People({
  note,
  people,
  pageRows,
  statuses,
  sources,
  query,
  status,
  source,
  sales,
  page,
  pageCount,
  onQuery,
  onStatus,
  onSource,
  onSales,
  onPage,
  onExport,
}: PeopleProps) {
  const rangeStart = people.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, people.length)

  return (
    <div className="stack">
      <article className="panel">
        <div className="panel-head">
          <div>
            <h2>Scan the room</h2>
            <p className="panel-copy">{note}</p>
          </div>
          <button type="button" className="button-secondary" onClick={onExport} disabled={people.length === 0}>
            Export this view
          </button>
        </div>

        <div className="filters">
          <label className="field">
            <span>Search people</span>
            <input
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Company, role, or name"
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(event) => onStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Source</span>
            <select value={source} onChange={(event) => onSource(event.target.value)}>
              <option value="all">All sources</option>
              {sources.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sales follow-up</span>
            <select value={sales} onChange={(event) => onSales(event.target.value)}>
              <option value="all">Everyone</option>
              <option value="asked">Asked for a conversation</option>
              <option value="not-asked">Did not ask</option>
            </select>
          </label>
        </div>

        <p className="result-count" aria-live="polite">
          {people.length === 0
            ? 'No one matches these filters. Clear search or widen status.'
            : `Showing ${formatNumber(rangeStart)}–${formatNumber(rangeEnd)} of ${formatNumber(people.length)}`}
        </p>

        {people.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="visually-hidden">Filtered registrants</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Company</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source</th>
                  <th scope="col">Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((person) => (
                  <tr key={person.id}>
                    <td>{person.name}</td>
                    <td>{person.company}</td>
                    <td>{person.role}</td>
                    <td>
                      <span className="badge">{person.status}</span>
                    </td>
                    <td>{person.source}</td>
                    <td>{person.salesIntent ? <span className="badge badge-strong">Sales</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {pageCount > 1 ? (
          <div className="pager">
            <button
              type="button"
              className="button-secondary"
              onClick={() => onPage(page - 1)}
              disabled={page <= 1}
            >
              Previous page
            </button>
            <p className="numeric">
              Page {page} of {pageCount}
            </p>
            <button
              type="button"
              className="button-secondary"
              onClick={() => onPage(page + 1)}
              disabled={page >= pageCount}
            >
              Next page
            </button>
          </div>
        ) : null}
      </article>
    </div>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="kpi">
      <p className="eyebrow">{label}</p>
      <p className="kpi-value">{value}</p>
      <p className="kpi-hint">{hint}</p>
    </article>
  )
}

function BarRow({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <li className="bar-row">
      <div className="bar-meta">
        <span>{label}</span>
        <span className="numeric">{value}</span>
      </div>
      <div className="track" aria-hidden="true">
        <div className="fill" style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
    </li>
  )
}

function MetricTable({
  rows,
  caption,
  includeSales = true,
}: {
  rows: MetricRow[]
  caption: string
  includeSales?: boolean
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Registered</th>
            <th scope="col">Live</th>
            <th scope="col">Live rate</th>
            {includeSales ? <th scope="col">Sales follow-up</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td className="numeric">{formatNumber(row.registered)}</td>
              <td className="numeric">{formatNumber(row.attendedLive)}</td>
              <td className="numeric">{formatPercent(liveRate(row))}</td>
              {includeSales ? <td className="numeric">{formatNumber(row.salesIntent ?? 0)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}
