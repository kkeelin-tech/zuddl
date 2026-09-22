import React from 'react'

import { Dashboard } from './webinar-analytics/Dashboard'
import data from './webinar-analytics/data.json'
import type { DashboardData } from './webinar-analytics/types'

export default function HomePage() {
  return <Dashboard data={data as DashboardData} />
}
