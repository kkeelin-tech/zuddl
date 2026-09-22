import fs from 'node:fs'
import path from 'node:path'

const csvPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve('bg_attendee_registration_details (5).csv')
const outPath = path.resolve('src/app/(frontend)/webinar-analytics/data.json')

function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
        continue
      }
      if (char === '"') {
        inQuotes = false
        continue
      }
      field += char
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    if (char === '\r') continue
    field += char
  }

  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function parseStamp(value) {
  const match = value
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s+(AM|PM)$/)
  if (!match) return null

  let hour = Number(match[4])
  if (match[6] === 'PM' && hour !== 12) hour += 12
  if (match[6] === 'AM' && hour === 12) hour = 0

  return {
    month: Number(match[1]),
    day: Number(match[2]),
    year: Number(match[3]),
    hour,
    minute: Number(match[5]),
    iso: `${match[3]}-${match[1]}-${match[2]}`,
  }
}

function clean(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function campaignLabel(raw) {
  const value = clean(raw)
  if (!value) return 'No campaign tag'
  if (value.includes('{{')) return 'Broken merge tag'
  if (value.startsWith('032426')) return 'Mar 24 office hours invite'
  if (value === 'EN_APR02_OH_AIforDev') return 'Apr 2 office hours page'
  if (value === 'MAR26_Digest_FR') return 'Mar 26 French digest'
  if (value === 'FR_MAR11_OH_CodeGenAndDesignSystems') return 'Mar 11 office hours follow-up'
  if (value.startsWith('043026')) return 'Apr 30 French newsletter'
  if (value.startsWith('031326')) return 'Mar 13 Figma invite'
  if (/EMAIL_CAMPAIGN/.test(value)) return 'BeJS partner email'
  return value
}

function sourceLabel(raw) {
  const value = clean(raw)
  if (!value) return 'Direct / untagged'
  if (value === 'figma') return 'Figma'
  if (value === 'event') return 'Event site'
  if (value === 'BeJS') return 'BeJS'
  if (value === 'reactparis') return 'React Paris'
  return value
}

function mediumLabel(raw) {
  const value = clean(raw)
  if (!value) return 'Untagged'
  if (value === 'email') return 'Email'
  if (value === 'website') return 'Website'
  if (value === 'Fr_digest') return 'French digest'
  if (value === 'webinar') return 'Webinar follow-up'
  if (value === 'qrcode') return 'QR code'
  return value
}

function statusLabel(raw) {
  switch (clean(raw)) {
    case 'ATTENDED_VIRTUALLY':
      return 'Attended live'
    case 'NO_SHOW':
      return 'No-show'
    case 'ENTERED':
      return 'Joined early'
    case 'REGISTERED_FOR_ON_DEMAND':
      return 'Registered for recording'
    case 'ATTENDED_ON_DEMAND':
      return 'Watched recording'
    default:
      return clean(raw) || 'Unknown'
  }
}

function roleGroup(role) {
  const value = role.toLowerCase()
  if (!value) return 'Unspecified'
  if (/(student|intern|apprentice|stagiaire|trainee)/.test(value)) return 'Student / intern'
  if (/design.?ops/.test(value)) return 'Design ops'
  if (
    /(product design|ux\/ui|ui\/ux|ux-ui|ui-ux|\bux\b|\bui\b|user experience|visual design|interaction design|graphic design|creative director|art director|brand design|content design|service design|\bdesigner\b|design lead|head of design|design manager)/.test(
      value,
    )
  ) {
    return 'Design'
  }
  if (
    /\b(pm|p\.m\.|product owner|product manager|cpo|head of product|vp product|director of product|product lead)\b/.test(
      value,
    )
  ) {
    return 'Product'
  }
  if (
    /(engineer|developer|frontend|front-end|front end|software|cto|tech lead|technical lead|architect|sre|devops|programmer|engineering)/.test(
      value,
    )
  ) {
    return 'Engineering'
  }
  if (/(founder|ceo|co-founder|cofounder|managing director)/.test(value)) {
    return 'Founder / exec'
  }
  if (/(marketing|growth|communications)/.test(value)) return 'Marketing'
  if (/(research|researcher)/.test(value)) return 'Research'
  if (/(manager|director|head of|\blead\b|vp |vice president|chief )/.test(value)) {
    return 'Leadership'
  }
  return 'Other'
}

function titleCase(value) {
  return clean(value)
    .toLowerCase()
    .replace(/\b[\p{L}\p{N}]+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1))
}

function displayName(first, last) {
  const given = clean(first)
  const family = clean(last)
  if (given && family) return `${given} ${family.charAt(0).toUpperCase()}.`
  return given || family || 'Unnamed registrant'
}

function increment(map, key, field, amount = 1) {
  const current = map.get(key) ?? {
    id: key,
    registered: 0,
    attendedLive: 0,
    attendedOnDemand: 0,
    joinedEarly: 0,
    noShow: 0,
    salesIntent: 0,
    emailOptIn: 0,
  }
  current[field] += amount
  map.set(key, current)
}

function applyStatus(bucket, status) {
  bucket.registered += 1
  if (status === 'ATTENDED_VIRTUALLY') bucket.attendedLive += 1
  if (status === 'ATTENDED_ON_DEMAND') bucket.attendedOnDemand += 1
  if (status === 'ENTERED') bucket.joinedEarly += 1
  if (status === 'NO_SHOW') bucket.noShow += 1
}

const rows = parseCSV(fs.readFileSync(csvPath, 'utf8')).slice(1)
const EVENT_ISO = '2026-04-02'

const daily = new Map()
const joinTimes = new Map()
const channels = new Map()
const campaigns = new Map()
const timing = new Map()
const roleGroups = new Map()
const roles = new Map()
const companies = new Map()
const people = []

let attendedLive = 0
let attendedOnDemand = 0
let joinedEarly = 0
let noShow = 0
let onDemandRegistered = 0
let salesIntent = 0
let emailOptIn = 0
let brokenTag = 0

for (const row of rows) {
  const first = row[1] ?? ''
  const last = row[2] ?? ''
  const company = clean(row[5] ?? '')
  const role = clean(row[6] ?? '')
  const wantsSales = clean(row[9] ?? '') === 'Yes'
  const wantsEmail = clean(row[10] ?? '') === 'Yes'
  const status = clean(row[11] ?? '')
  const registered = parseStamp(row[12] ?? '')
  const attendedAt = parseStamp(row[13] ?? '')
  const source = clean(row[19] ?? '')
  const campaign = clean(row[20] ?? '')
  const medium = clean(row[21] ?? '')

  if (status === 'ATTENDED_VIRTUALLY') attendedLive += 1
  if (status === 'ATTENDED_ON_DEMAND') attendedOnDemand += 1
  if (status === 'ENTERED') joinedEarly += 1
  if (status === 'NO_SHOW') noShow += 1
  if (status === 'REGISTERED_FOR_ON_DEMAND') onDemandRegistered += 1
  if (wantsSales) salesIntent += 1
  if (wantsEmail) emailOptIn += 1
  if (campaign.includes('{{')) brokenTag += 1

  const dayKey = registered?.iso ?? 'unknown'
  if (!daily.has(dayKey)) {
    daily.set(dayKey, { date: dayKey, registered: 0, attendedLive: 0, salesIntent: 0 })
  }
  const day = daily.get(dayKey)
  day.registered += 1
  if (status === 'ATTENDED_VIRTUALLY') day.attendedLive += 1
  if (wantsSales) day.salesIntent += 1

  if (attendedAt) {
    const bucketMinute = Math.floor(attendedAt.minute / 5) * 5
    const joinKey = `${String(attendedAt.hour).padStart(2, '0')}:${String(bucketMinute).padStart(2, '0')}`
    joinTimes.set(joinKey, (joinTimes.get(joinKey) ?? 0) + 1)
  }

  const channelKey = `${sourceLabel(source)} · ${mediumLabel(medium)}`
  if (!channels.has(channelKey)) {
    channels.set(channelKey, {
      id: channelKey,
      label: channelKey,
      source: sourceLabel(source),
      medium: mediumLabel(medium),
      registered: 0,
      attendedLive: 0,
      attendedOnDemand: 0,
      joinedEarly: 0,
      noShow: 0,
      salesIntent: 0,
      emailOptIn: 0,
    })
  }
  const channel = channels.get(channelKey)
  applyStatus(channel, status)
  if (wantsSales) channel.salesIntent += 1
  if (wantsEmail) channel.emailOptIn += 1

  const campaignKey = campaignLabel(campaign)
  if (!campaigns.has(campaignKey)) {
    campaigns.set(campaignKey, {
      id: campaignKey,
      label: campaignKey,
      registered: 0,
      attendedLive: 0,
      attendedOnDemand: 0,
      joinedEarly: 0,
      noShow: 0,
      salesIntent: 0,
      emailOptIn: 0,
    })
  }
  const campaignRow = campaigns.get(campaignKey)
  applyStatus(campaignRow, status)
  if (wantsSales) campaignRow.salesIntent += 1
  if (wantsEmail) campaignRow.emailOptIn += 1

  let timingLabel = 'Unknown'
  if (registered) {
    const event = Date.UTC(2026, 3, 2)
    const signup = Date.UTC(registered.year, registered.month - 1, registered.day)
    const days = Math.round((event - signup) / 86400000)
    if (days > 14) timingLabel = '15+ days before'
    else if (days > 7) timingLabel = '8–14 days before'
    else if (days > 1) timingLabel = '2–7 days before'
    else if (days === 1) timingLabel = 'Day before'
    else if (days === 0) timingLabel = 'Event day'
    else timingLabel = 'After the live session'
  }
  if (!timing.has(timingLabel)) {
    timing.set(timingLabel, {
      id: timingLabel,
      label: timingLabel,
      registered: 0,
      attendedLive: 0,
      attendedOnDemand: 0,
      salesIntent: 0,
    })
  }
  const timingRow = timing.get(timingLabel)
  timingRow.registered += 1
  if (status === 'ATTENDED_VIRTUALLY') timingRow.attendedLive += 1
  if (status === 'ATTENDED_ON_DEMAND') timingRow.attendedOnDemand += 1
  if (wantsSales) timingRow.salesIntent += 1

  const group = roleGroup(role)
  increment(roleGroups, group, 'registered')
  const groupRow = roleGroups.get(group)
  if (status === 'ATTENDED_VIRTUALLY') groupRow.attendedLive += 1
  if (status === 'ATTENDED_ON_DEMAND') groupRow.attendedOnDemand += 1
  if (wantsSales) groupRow.salesIntent += 1

  const roleLabel = titleCase(role) || 'Unspecified'
  increment(roles, roleLabel, 'registered')
  const roleRow = roles.get(roleLabel)
  if (status === 'ATTENDED_VIRTUALLY') roleRow.attendedLive += 1

  const companyLabel = company || 'Unspecified'
  increment(companies, companyLabel, 'registered')
  const companyRow = companies.get(companyLabel)
  if (status === 'ATTENDED_VIRTUALLY') companyRow.attendedLive += 1
  if (wantsSales) companyRow.salesIntent += 1

  people.push({
    id: String(people.length + 1),
    name: displayName(first, last),
    company: companyLabel,
    role: role || 'Unspecified',
    roleGroup: group,
    status: statusLabel(status),
    statusId: status,
    source: sourceLabel(source),
    medium: mediumLabel(medium),
    campaign: campaignKey,
    salesIntent: wantsSales,
    emailOptIn: wantsEmail,
    registeredDate: registered?.iso ?? '',
  })
}

const registered = rows.length
const showedUp = attendedLive + attendedOnDemand

function rate(part, whole = registered) {
  return whole === 0 ? 0 : Number((part / whole).toFixed(3))
}

function sortByRegistered(items) {
  return [...items].sort((a, b) => b.registered - a.registered)
}

const timingOrder = [
  '15+ days before',
  '8–14 days before',
  '2–7 days before',
  'Day before',
  'Event day',
  'After the live session',
]

const campaignWindow = []
let beforeWindow = { date: 'before', label: 'Before Mar 24', registered: 0, attendedLive: 0, salesIntent: 0 }
let afterWindow = {
  date: 'after',
  label: 'After the live session',
  registered: 0,
  attendedLive: 0,
  salesIntent: 0,
}

for (const [date, row] of [...daily.entries()].sort()) {
  if (date < '2026-03-24') {
    beforeWindow.registered += row.registered
    beforeWindow.attendedLive += row.attendedLive
    beforeWindow.salesIntent += row.salesIntent
    continue
  }
  if (date > EVENT_ISO) {
    afterWindow.registered += row.registered
    afterWindow.attendedLive += row.attendedLive
    afterWindow.salesIntent += row.salesIntent
    continue
  }
  const [, month, day] = date.split('-')
  campaignWindow.push({
    ...row,
    label: `${Number(month)}/${Number(day)}`,
  })
}

const data = {
  event: {
    name: 'Office hours: AI for developers',
    dateLabel: 'April 2, 2026',
    timezone: 'GMT+02:00',
    source: 'Zuddl attendee registration details',
    note: 'Emails and phone numbers stay in the source report. Names are abbreviated in this view.',
  },
  kpis: {
    registered,
    attendedLive,
    attendedOnDemand,
    joinedEarly,
    noShow,
    onDemandRegistered,
    showedUp,
    liveRate: rate(attendedLive),
    showUpRate: rate(showedUp),
    salesIntent,
    salesIntentRate: rate(salesIntent),
    emailOptIn,
    emailOptInRate: rate(emailOptIn),
    companies: [...companies.keys()].filter((name) => name !== 'Unspecified').length,
    brokenTag,
  },
  funnel: [
    { id: 'registered', label: 'Registered', count: registered },
    { id: 'entered', label: 'Opened the room', count: attendedLive + joinedEarly },
    { id: 'live', label: 'Stayed for the live session', count: attendedLive },
    { id: 'recording', label: 'Watched the recording', count: attendedOnDemand },
  ],
  dailyRegistrations: [beforeWindow, ...campaignWindow, afterWindow],
  joinTimes: [...joinTimes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({ label, count })),
  channels: sortByRegistered(channels.values()),
  campaigns: sortByRegistered(campaigns.values()),
  timing: timingOrder.map((id) => timing.get(id)).filter(Boolean),
  roleGroups: sortByRegistered(roleGroups.values()).map(({ id, ...rest }) => ({
    id,
    label: id,
    ...rest,
  })),
  topRoles: sortByRegistered(roles.values())
    .slice(0, 12)
    .map(({ id, ...rest }) => ({ id, label: id, ...rest })),
  topCompanies: sortByRegistered(companies.values())
    .filter((row) => row.id !== 'Unspecified')
    .slice(0, 12)
    .map(({ id, ...rest }) => ({ id, label: id, ...rest })),
  people,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`)
console.log(`Wrote ${people.length} people to ${outPath}`)
